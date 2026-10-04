<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use Illuminate\Support\Facades\Storage;

/**
 * The one way a scene becomes the content of a new board: a built-in or
 * workspace template at creation, and the duplicate of a board. The board
 * must be new (no element, seq 0) and the caller holds the transaction.
 *
 * @phpstan-type SceneFile array{fileId: string, path: string, mimeType: string, size: int}
 * @phpstan-type Scene array{elements: list<array<string, mixed>>, files: list<SceneFile>}
 */
class CopyWhiteboardScene
{
    private const int ChunkSize = 500;

    public function __construct(
        private SanitizeWhiteboardElement $sanitizeWhiteboardElement,
        private RemapWhiteboardScene $remapWhiteboardScene,
    ) {}

    /**
     * @param  Scene  $scene
     */
    public function handle(Whiteboard $board, WhiteboardMember $author, array $scene): void
    {
        $elements = [];

        foreach ($scene['elements'] as $raw) {
            $element = $this->sanitizeWhiteboardElement->handle($raw);

            if ($element === null || $element['isDeleted']) {
                continue;
            }

            $elements[] = $element;
        }

        $elements = array_slice($elements, 0, Whiteboard::MaxLiveElements);
        $copiedFileIds = $this->copyFiles($board, $author, $elements, $scene['files']);
        $elements = array_values(array_filter(
            $elements,
            fn (array $element): bool => $element['type'] !== 'image' || isset($copiedFileIds[$element['fileId']]),
        ));

        $rows = [];

        foreach ($this->remapWhiteboardScene->handle($elements) as $position => $element) {
            $rows[] = [
                'whiteboard_id' => $board->id,
                'element_id' => $element['id'],
                'type' => $element['type'],
                'data' => $element,
                'version' => $element['version'],
                'version_nonce' => $element['versionNonce'],
                'author_member_id' => $author->id,
                'is_sticky' => isset($element['customData']),
                'is_deleted' => false,
                'seq' => $position + 1,
            ];
        }

        foreach (array_chunk($rows, self::ChunkSize) as $chunk) {
            WhiteboardElement::query()->fillAndInsert($chunk);
        }

        $board->update(['seq' => count($rows)]);
    }

    /**
     * Only the images a kept element shows are copied; one whose stored file
     * is gone or cannot be copied is left out, and so is the element that
     * shows it. Disks do not throw, so the result of the copy is the only
     * sign of a failure.
     *
     * @param  list<array<string, mixed>>  $elements  sanitized, live and within the cap
     * @param  list<SceneFile>  $files
     * @return array<string, true>
     */
    private function copyFiles(Whiteboard $board, WhiteboardMember $author, array $elements, array $files): array
    {
        $shown = [];

        foreach ($elements as $element) {
            if ($element['type'] === 'image' && is_string($element['fileId'] ?? null)) {
                $shown[$element['fileId']] = true;
            }
        }

        $copied = [];

        foreach ($files as $file) {
            if (! isset($shown[$file['fileId']]) || isset($copied[$file['fileId']])) {
                continue;
            }

            if (! Storage::exists($file['path'])) {
                continue;
            }

            $path = "{$board->storageDirectory()}/{$file['fileId']}";

            if (! Storage::copy($file['path'], $path)) {
                continue;
            }

            $board->files()->create([
                'file_id' => $file['fileId'],
                'path' => $path,
                'mime_type' => $file['mimeType'],
                'size' => $file['size'],
                'uploaded_by_member_id' => $author->id,
            ]);

            $copied[$file['fileId']] = true;
        }

        return $copied;
    }
}
