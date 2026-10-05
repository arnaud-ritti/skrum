<?php

namespace App\Jobs;

use App\Actions\Games\ExpireGameRound;
use App\Models\GameRound;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * The job belongs to one deadline of one round: a changed, cleared or
 * superseded deadline, or an ended round, makes it a no-op, and the action
 * re-checks the rest.
 */
trait ClosesExpiredGameDeadline
{
    public const MaxEarlyRuns = 3;

    abstract protected function endsAt(GameRound $round): ?CarbonInterface;

    abstract protected function deadline(): string;

    abstract protected function again(int $earlyRuns): ShouldQueue;

    public function handle(ExpireGameRound $expireGameRound): void
    {
        $round = GameRound::query()->with('room.retro')->find($this->roundId);

        if ($round === null || ! $round->isActive()) {
            return;
        }

        $endsAt = $this->endsAt($round);

        if ($endsAt === null || ! $endsAt->startOfSecond()->equalTo(CarbonImmutable::parse($this->deadline())->startOfSecond())) {
            return;
        }

        if ($endsAt->isFuture()) {
            $this->runAgainWhenExpired($endsAt);

            return;
        }

        $expireGameRound->handle($round->room);
    }

    /**
     * Queues deliver up to a second early; run again for the remainder
     * instead of leaving the deadline to the next request.
     */
    private function runAgainWhenExpired(CarbonInterface $endsAt): void
    {
        if ($this->earlyRuns >= self::MaxEarlyRuns) {
            return;
        }

        $delay = max(1, (int) ceil(now()->diffInSeconds($endsAt, true)));

        dispatch($this->again($this->earlyRuns + 1))->delay(now()->addSeconds($delay));
    }
}
