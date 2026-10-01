<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardTemplate;
use App\Models\WhiteboardVersion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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

        $this->deleteFoldersWithoutOwner(self::Root, Whiteboard::class);
        $this->deleteFoldersWithoutOwner(WhiteboardTemplate::StorageRoot, WhiteboardTemplate::class);

        return $pruned;
    }

    /**
     * A file lives while a live element or a version of its board shows it
     * (spec §6.5). A template keeps its own copy of every image (spec §10).
     */
    private function isUsed(WhiteboardFile $file): bool
    {
        $shownOnTheBoard = WhiteboardElement::query()
            ->where('whiteboard_id', $file->whiteboard_id)
            ->where('type', 'image')
            ->where('is_deleted', false)
            ->where('data->fileId', $file->file_id)
            ->exists();

        if ($shownOnTheBoard) {
            return true;
        }

        return WhiteboardVersion::query()
            ->where('whiteboard_id', $file->whiteboard_id)
            ->whereJsonContains('scene->fileIds', $file->file_id)
            ->exists();
    }

    /**
     * A team or workspace deletion cascades in the database without model
     * events, so the folder of a board or template outlives it. A folder
     * with a recent file is left alone: a copy writes its files before the
     * transaction that creates their owner commits.
     *
     * @param  class-string<Model>  $owner
     */
    private function deleteFoldersWithoutOwner(string $root, string $owner): void
    {
        $recent = now()->subHours(self::KeepHours)->getTimestamp();

        foreach (Storage::directories($root) as $directory) {
            $ownerId = basename($directory);

            if (! Str::isUuid($ownerId)) {
                continue;
            }

            if ($owner::query()->whereKey($ownerId)->exists()) {
                continue;
            }

            if (collect(Storage::allFiles($directory))->contains(fn (string $path): bool => Storage::lastModified($path) >= $recent)) {
                continue;
            }

            Storage::deleteDirectory($directory);
        }
    }
}
