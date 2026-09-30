<?php

namespace App\Actions\Poker;

use App\Events\Poker\PokerRoundChanged;
use App\Models\PokerGame;
use App\Models\PokerTask;

class SelectPokerTask
{
    public function __construct(private StartPokerRound $startPokerRound) {}

    /**
     * Selecting a task never discards anything: an open round resumes with
     * its hidden votes, a revealed one is shown until the facilitator re-votes.
     */
    public function handle(PokerGame $locked, ?PokerTask $task): void
    {
        $locked->update(['current_task_id' => $task?->id]);

        if ($task !== null && ! $task->rounds()->exists()) {
            $this->startPokerRound->handle($locked, $task);
        }

        (new PokerRoundChanged($locked->id))->sendToOthers();
    }
}
