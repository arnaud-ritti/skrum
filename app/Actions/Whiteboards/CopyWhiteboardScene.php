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
        $copiedFileIds = $this->copyFiles($board, $author, $scene);
        $elements = [];

        foreach ($scene['elements'] as $raw) {
            $element = $this->sanitizeWhiteboardElement->handle($raw);

            if ($element === null || $element['isDeleted']) {
                continue;
            }

            if ($element['type'] === 'image' && ! isset($copiedFileIds[$element['fileId']])) {
                continue;
            }

            $elements[] = $element;
        }

        $rows = [];

        foreach ($this->remapWhiteboardScene->handle(array_slice($elements, 0, Whiteboard::MaxLiveElements)) as $position => $element) {
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
     * Only the images a live element shows are copied; one whose stored file
     * is gone or cannot be copied is left out, and so is the element that
     * shows it. Disks do not throw, so the result of the copy is the only
     * sign of a failure.
     *
     * @param  Scene  $scene
     * @return array<string, true>
     */
    private function copyFiles(Whiteboard $board, WhiteboardMember $author, array $scene): array
    {
        $shown = [];

        foreach ($scene['elements'] as $element) {
            if (($element['type'] ?? null) === 'image' && ! ($element['isDeleted'] ?? false) && is_string($element['fileId'] ?? null)) {
                $shown[$element['fileId']] = true;
            }
        }

        $copied = [];

        foreach ($scene['files'] as $file) {
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
