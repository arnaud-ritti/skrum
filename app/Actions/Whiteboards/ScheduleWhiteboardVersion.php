<?php

namespace App\Actions\Whiteboards;

use App\Jobs\StoreAutomaticWhiteboardVersion;
use App\Models\Whiteboard;

class ScheduleWhiteboardVersion
{
    /**
     * Call inside the board lock after a change of `seq`, with the seq the
     * change started from: the first change after the last version queues
     * the next one, the following ones find it already queued.
     */
    public function handle(Whiteboard $locked, int $fromSeq): void
    {
        if ($fromSeq !== $locked->last_versioned_seq) {
            return;
        }

        StoreAutomaticWhiteboardVersion::dispatch($locked->id)
            ->delay(now()->addMinutes(StoreAutomaticWhiteboardVersion::DelayMinutes))
            ->afterCommit();
    }
}
