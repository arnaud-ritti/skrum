<?php

namespace App\Jobs;

use App\Models\GameRound;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CloseExpiredGameTurn implements ShouldQueue
{
    use ClosesExpiredGameDeadline;
    use Queueable;

    public function __construct(
        public string $roundId,
        public string $turnEndsAt,
        public int $earlyRuns = 0,
    ) {}

    protected function endsAt(GameRound $round): ?CarbonInterface
    {
        return $round->turn_ends_at;
    }

    protected function deadline(): string
    {
        return $this->turnEndsAt;
    }

    protected function again(int $earlyRuns): ShouldQueue
    {
        return new self($this->roundId, $this->turnEndsAt, $earlyRuns);
    }
}
