<?php

namespace App\Actions\Poker;

use App\Actions\Integrations\RequestEstimateSync;
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
    public function __construct(
        private PresentPokerTask $presentPokerTask,
        private RequestEstimateSync $requestEstimateSync,
    ) {}

    public function handle(PokerGame $locked, PokerTask $task, ?string $value): PokerTask
    {
        if ($value !== null) {
            $this->ensureEstimable($locked, $task, $value);
        }

        return $this->apply($locked, $task, $value, writeBack: true);
    }

    /**
     * "Use :source estimate" (spec 8 §5.8): the same deck check and
     * broadcasts as the facilitator's pick, without a revealed round — the
     * task already has an estimate — and no write-back: the source already
     * holds this value (spec 8 §5.9).
     */
    public function fromSource(PokerGame $locked, PokerTask $task, string $card): PokerTask
    {
        if (! in_array($card, $locked->cards, true) || PokerDeck::isSpecial($card)) {
            throw ValidationException::withMessages(['value' => __('Choose a card from the deck.')]);
        }

        return $this->apply($locked, $task, $card, writeBack: false);
    }

    private function apply(PokerGame $locked, PokerTask $task, ?string $value, bool $writeBack): PokerTask
    {
        $previous = $task->estimate;

        if ($value === null) {
            $task->update([
                'estimate' => null,
                'estimate_numeric' => null,
                'estimated_at' => null,
            ]);
        }

        if ($value !== null && $value !== $previous) {
            $task->update([
                'estimate' => $value,
                'estimate_numeric' => PokerDeck::numericValue($value),
                'estimated_at' => now(),
            ]);
        }

        if ($writeBack && $task->estimate !== $previous) {
            $this->requestEstimateSync->afterEstimateChange($locked, $task);
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
