<?php

namespace App\Actions\Whiteboards;

use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardVersion;
use Illuminate\Support\Facades\DB;

/**
 * @phpstan-import-type SceneFile from CopyWhiteboardScene
 */
class CopyWhiteboardVersion
{
    public function __construct(
        private CreateWhiteboard $createWhiteboard,
        private DuplicateWhiteboard $duplicateWhiteboard,
    ) {}

    /**
     * The same copy path as a template or a duplicate: fresh ids, version 1,
     * the board's images copied; an image the board lost is left out.
     */
    public function handle(Whiteboard $board, User $user, WhiteboardVersion $version): Whiteboard
    {
        return DB::transaction(function () use ($board, $user, $version): Whiteboard {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            $chosen = $locked->versions()->whereKey($version->id)->firstOrFail();

            return $this->createWhiteboard->handle($locked->team, $user, $this->duplicateWhiteboard->title($locked->title), [
                'elements' => $chosen->scene['elements'],
                'files' => $this->files($locked, $chosen),
            ]);
        });
    }

    /**
     * @return list<SceneFile>
     */
    private function files(Whiteboard $locked, WhiteboardVersion $chosen): array
    {
        return array_values($locked->files()
            ->whereIn('file_id', $chosen->scene['fileIds'])
            ->orderBy('file_id')
            ->get()
            ->map(fn (WhiteboardFile $file): array => [
                'fileId' => $file->file_id,
                'path' => $file->path,
                'mimeType' => $file->mime_type,
                'size' => $file->size,
            ])
            ->all());
    }
}
