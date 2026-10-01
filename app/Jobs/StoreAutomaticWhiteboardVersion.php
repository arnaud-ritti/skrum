<?php

namespace App\Jobs;

use App\Actions\Whiteboards\StoreWhiteboardVersion;
use App\Models\Whiteboard;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class StoreAutomaticWhiteboardVersion implements ShouldQueue
{
    use Queueable;

    public const DelayMinutes = 5;

    public function __construct(public string $boardId) {}

    /**
     * The job carries the board only: what it stores is decided when it
     * runs, under the lock. A younger automatic version means another job,
     * queued by the write that followed it, is still due.
     */
    public function handle(StoreWhiteboardVersion $storeWhiteboardVersion): void
    {
        DB::transaction(function () use ($storeWhiteboardVersion): void {
            $locked = Whiteboard::query()->whereKey($this->boardId)->lockForUpdate()->first();

            if ($locked === null || $locked->seq <= $locked->last_versioned_seq) {
                return;
            }

            $hasYoungVersion = $locked->versions()
                ->whereNull('name')
                ->where('created_at', '>', now()->subMinutes(self::DelayMinutes))
                ->exists();

            if ($hasYoungVersion) {
                return;
            }

            $storeWhiteboardVersion->handle($locked, null, null);
        });
    }
}
