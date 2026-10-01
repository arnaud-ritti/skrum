<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Support\Facades\DB;

/**
 * The purge mark is written through the base query so that the board's
 * `updated_at`, the sort key of the team page, does not move.
 */
class PurgeWhiteboardTombstones
{
    private const int KeepHours = 24;

    public function handle(): int
    {
        $purged = 0;

        $expired = fn () => WhiteboardElement::query()
            ->where('is_deleted', true)
            ->where('updated_at', '<', now()->subHours(self::KeepHours));

        $expired()->distinct()->pluck('whiteboard_id')->each(function (string $boardId) use (&$purged, $expired): void {
            $purged += DB::transaction(function () use ($boardId, $expired): int {
                $board = Whiteboard::query()->whereKey($boardId)->lockForUpdate()->first();

                if ($board === null) {
                    return 0;
                }

                $highest = (int) $expired()->where('whiteboard_id', $boardId)->max('seq');

                Whiteboard::query()->whereKey($boardId)->toBase()->update(['purged_seq' => max($board->purged_seq, $highest)]);

                return $expired()->where('whiteboard_id', $boardId)->delete();
            });
        });

        return $purged;
    }
}
