<?php

namespace App\Jobs;

use App\Actions\Poker\AutoRevealPokerRound;
use App\Models\PokerRound;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RevealPokerRoundOnTimer implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $roundId, public string $timerEndsAt) {}

    /**
     * The job belongs to one end time of one round: a changed, cleared or
     * superseded timer makes it a no-op, and the action re-checks the rest.
     */
    public function handle(AutoRevealPokerRound $autoRevealPokerRound): void
    {
        $round = PokerRound::query()->find($this->roundId);

        if ($round === null || $round->timer_ends_at === null) {
            return;
        }

        if (! $round->timer_ends_at->equalTo(CarbonImmutable::parse($this->timerEndsAt))) {
            return;
        }

        if ($round->timer_ends_at->isFuture()) {
            return;
        }

        $autoRevealPokerRound->handle($round);
    }
}
