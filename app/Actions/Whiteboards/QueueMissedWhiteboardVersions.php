<?php

namespace App\Actions\Whiteboards;

use App\Jobs\StoreAutomaticWhiteboardVersion;
use App\Models\Whiteboard;

/**
 * A board with changes no version holds, untouched for an hour: the job
 * that should have stored them is gone and no write will queue another.
 */
class QueueMissedWhiteboardVersions
{
    private const IdleHours = 1;

    public function handle(): int
    {
        return Whiteboard::query()
            ->whereColumn('seq', '>', 'last_versioned_seq')
            ->where('updated_at', '<', now()->subHours(self::IdleHours))
            ->pluck('id')
            ->each(fn (string $boardId) => StoreAutomaticWhiteboardVersion::dispatch($boardId))
            ->count();
    }
}
