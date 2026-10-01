<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Support\Facades\DB;

class PurgeWhiteboardTombstones
{
    private const KeepHours = 24;

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

                Whiteboard::query()->whereKey($boardId)->update(['purged_seq' => max($board->purged_seq, $highest)]);

                return $expired()->where('whiteboard_id', $boardId)->delete();
            });
        });

        return $purged;
    }
}
