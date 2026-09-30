<?php

namespace App\Actions\Poker;

use App\Enums\PokerDeck;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use Illuminate\Validation\ValidationException;

class SetPokerEstimate
{
    public function __construct(private PresentPokerTask $presentPokerTask) {}

    public function handle(PokerGame $locked, PokerTask $task, ?string $value): PokerTask
    {
        $previous = $task->estimate;

        if ($value === null) {
            $task->update([
                'estimate' => null,
                'estimate_numeric' => null,
                'estimated_at' => null,
            ]);
        }

        if ($value !== null) {
            $this->ensureEstimable($locked, $task, $value);

            if ($value !== $previous) {
                $task->update([
                    'estimate' => $value,
                    'estimate_numeric' => PokerDeck::numericValue($value),
                    'estimated_at' => now(),
                ]);
            }
        }

        $task->loadCount('rounds');

        (new PokerTaskSaved($locked->id, $this->presentPokerTask->handle($task)))->sendToOthers();

        if ($value !== null && $value !== $previous) {
            PokerTaskEstimated::dispatch($task);
        }

        return $task;
    }

    private function ensureEstimable(PokerGame $locked, PokerTask $task, string $value): void
    {
        if (! in_array($value, $locked->cards, true) || PokerDeck::isSpecial($value)) {
            throw ValidationException::withMessages(['value' => __('Choose a card from the deck.')]);
        }

        $latestRound = $task->latestRound()->with('votes')->first();

        if ($latestRound === null || ! $latestRound->isRevealed() || ! $this->hasCountableVote($latestRound)) {
            throw ValidationException::withMessages(['value' => __('Reveal the votes before setting an estimate.')]);
        }
    }

    private function hasCountableVote(PokerRound $round): bool
    {
        return $round->votes->contains(fn (PokerVote $vote): bool => ! PokerDeck::isSpecial($vote->value));
    }
}
