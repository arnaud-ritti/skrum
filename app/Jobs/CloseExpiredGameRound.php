<?php

namespace App\Jobs;

use App\Models\GameRound;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CloseExpiredGameRound implements ShouldQueue
{
    use ClosesExpiredGameDeadline;
    use Queueable;

    public function __construct(
        public string $roundId,
        public string $timerEndsAt,
        public int $earlyRuns = 0,
    ) {}

    protected function endsAt(GameRound $round): ?CarbonInterface
    {
        return $round->room->effectiveTimerEndsAt();
    }

    protected function deadline(): string
    {
        return $this->timerEndsAt;
    }

    protected function again(int $earlyRuns): ShouldQueue
    {
        return new self($this->roundId, $this->timerEndsAt, $earlyRuns);
    }
}
