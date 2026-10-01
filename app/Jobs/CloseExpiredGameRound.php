<?php

namespace App\Jobs;

use App\Actions\Games\ExpireGameRound;
use App\Models\GameRound;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CloseExpiredGameRound implements ShouldQueue
{
    use Queueable;

    public const MaxEarlyRuns = 3;

    public function __construct(
        public string $roundId,
        public string $timerEndsAt,
        public int $earlyRuns = 0,
    ) {}

    /**
     * The job belongs to one end time of one round: a changed, cleared or
     * superseded timer makes it a no-op, and the action re-checks the rest.
     */
    public function handle(ExpireGameRound $expireGameRound): void
    {
        $round = GameRound::query()->with('room.retro')->find($this->roundId);

        if ($round === null || ! $round->isActive()) {
            return;
        }

        $room = $round->room;
        $endsAt = $room->effectiveTimerEndsAt();

        if ($endsAt === null || ! $endsAt->startOfSecond()->equalTo(CarbonImmutable::parse($this->timerEndsAt)->startOfSecond())) {
            return;
        }

        if ($endsAt->isFuture()) {
            $this->runAgainWhenExpired($endsAt);

            return;
        }

        $expireGameRound->handle($room);
    }

    /**
     * Queues deliver up to a second early; run again for the remainder
     * instead of leaving the round to the next request.
     */
    private function runAgainWhenExpired(CarbonInterface $endsAt): void
    {
        if ($this->earlyRuns >= self::MaxEarlyRuns) {
            return;
        }

        $delay = max(1, (int) ceil(now()->diffInSeconds($endsAt, true)));

        dispatch(new self($this->roundId, $this->timerEndsAt, $this->earlyRuns + 1))->delay(now()->addSeconds($delay));
    }
}
