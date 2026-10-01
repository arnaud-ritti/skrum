<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;

/**
 * The live scene of a board as it is stored, with the files its images show:
 * what a copy made on the server starts from.
 *
 * @phpstan-import-type Scene from CopyWhiteboardScene
 */
class ReadWhiteboardScene
{
    public function __construct(private OrderWhiteboardElements $orderWhiteboardElements) {}

    /**
     * @return Scene
     */
    public function handle(Whiteboard $board): array
    {
        $elements = $this->orderWhiteboardElements
            ->handle($board->elements()->where('is_deleted', false)->get())
            ->map(fn (WhiteboardElement $element): array => $element->data)
            ->all();

        $shownFileIds = collect($elements)
            ->where('type', 'image')
            ->pluck('fileId')
            ->filter(fn (mixed $fileId): bool => is_string($fileId))
            ->unique()
            ->values();

        $files = $board->files()
            ->whereIn('file_id', $shownFileIds)
            ->orderBy('file_id')
            ->get()
            ->map(fn (WhiteboardFile $file): array => [
                'fileId' => $file->file_id,
                'path' => $file->path,
                'mimeType' => $file->mime_type,
                'size' => $file->size,
            ])
            ->all();

        return ['elements' => array_values($elements), 'files' => array_values($files)];
    }
}
