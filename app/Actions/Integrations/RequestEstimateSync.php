<?php

namespace App\Actions\Integrations;

use App\Actions\Poker\PokerGuard;
use App\Jobs\SyncTaskEstimate;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Validation\ValidationException;

class RequestEstimateSync
{
    /**
     * Spec 6 §6.5: every saved or cleared estimate of an imported task is
     * written back when the connection allows it; otherwise the task shows
     * why it is not synced and nothing is queued.
     */
    public function afterEstimateChange(PokerGame $game, PokerTask $task): void
    {
        if ($task->external_source === null) {
            return;
        }

        if (PokerTaskSync::for($game)->unsupportedReason($task) !== null) {
            return;
        }

        $this->queue($task);
    }

    /**
     * The facilitator's retry, which also forces a rewrite of an estimate
     * already synced (spec 6 §6.5, MCP `poker.game.task.sync`).
     */
    public function retry(PokerGame $game, PokerTask $task, PokerPlayer $player): void
    {
        PokerGuard::facilitator($game, $player);

        if ($task->external_source === null) {
            throw ValidationException::withMessages(['task' => __('This task was not imported from a tracker.')]);
        }

        if ($task->estimate === null) {
            throw ValidationException::withMessages(['task' => __('Set an estimate before syncing it.')]);
        }

        $reason = PokerTaskSync::for($game)->unsupportedReason($task);

        if ($reason !== null) {
            throw ValidationException::withMessages(['task' => $reason]);
        }

        $this->queue($task);
    }

    private function queue(PokerTask $task): void
    {
        $task->forceFill(['needs_sync' => true, 'sync_error' => null])->save();

        SyncTaskEstimate::dispatch($task->id)->afterCommit();
    }
}
