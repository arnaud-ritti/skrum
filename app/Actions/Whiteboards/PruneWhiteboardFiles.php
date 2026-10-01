<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use Illuminate\Support\Facades\Storage;

class PruneWhiteboardFiles
{
    private const KeepHours = 24;

    private const Root = 'whiteboards';

    public function handle(): int
    {
        $pruned = 0;

        WhiteboardFile::query()
            ->where('created_at', '<', now()->subHours(self::KeepHours))
            ->lazyById()
            ->each(function (WhiteboardFile $file) use (&$pruned): void {
                if ($this->isUsed($file)) {
                    return;
                }

                Storage::delete($file->path);
                $file->delete();
                $pruned++;
            });

        $this->deleteFoldersOfGoneBoards();

        return $pruned;
    }

    /**
     * Plans 17b and 17d add templates and versions as further users of a file.
     */
    private function isUsed(WhiteboardFile $file): bool
    {
        return WhiteboardElement::query()
            ->where('whiteboard_id', $file->whiteboard_id)
            ->where('type', 'image')
            ->where('is_deleted', false)
            ->where('data->fileId', $file->file_id)
            ->exists();
    }

    /**
     * A team or workspace deletion cascades in the database without model
     * events, so the board's folder outlives it.
     */
    private function deleteFoldersOfGoneBoards(): void
    {
        foreach (Storage::directories(self::Root) as $directory) {
            if (Whiteboard::query()->whereKey(basename($directory))->exists()) {
                continue;
            }

            Storage::deleteDirectory($directory);
        }
    }
}
