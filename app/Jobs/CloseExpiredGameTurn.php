<?php

namespace App\Jobs;

use App\Actions\Games\ExpireGameRound;
use App\Models\GameRound;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CloseExpiredGameTurn implements ShouldQueue
{
    use Queueable;

    public const MaxEarlyRuns = 3;

    public function __construct(
        public string $roundId,
        public string $turnEndsAt,
        public int $earlyRuns = 0,
    ) {}

    /**
     * The job belongs to one deadline of one turn: a turn that moved on, or
     * an ended round, makes it a no-op, and the action re-checks the rest.
     */
    public function handle(ExpireGameRound $expireGameRound): void
    {
        $round = GameRound::query()->with('room.retro')->find($this->roundId);

        if ($round === null || ! $round->isActive() || $round->turn_ends_at === null) {
            return;
        }

        if (! $round->turn_ends_at->startOfSecond()->equalTo(CarbonImmutable::parse($this->turnEndsAt)->startOfSecond())) {
            return;
        }

        if ($round->turn_ends_at->isFuture()) {
            $this->runAgainWhenExpired($round->turn_ends_at);

            return;
        }

        $expireGameRound->handle($round->room);
    }

    /**
     * Queues deliver up to a second early; run again for the remainder
     * instead of leaving the turn to the next request.
     */
    private function runAgainWhenExpired(CarbonInterface $endsAt): void
    {
        if ($this->earlyRuns >= self::MaxEarlyRuns) {
            return;
        }

        $delay = max(1, (int) ceil(now()->diffInSeconds($endsAt, true)));

        dispatch(new self($this->roundId, $this->turnEndsAt, $this->earlyRuns + 1))->delay(now()->addSeconds($delay));
    }
}
