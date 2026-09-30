<?php

namespace App\Jobs;

use App\Actions\Games\ExpireGameRound;
use App\Models\GameRound;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CloseExpiredGameRound implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $roundId, public string $timerEndsAt) {}

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

        if ($endsAt === null || ! $endsAt->equalTo(CarbonImmutable::parse($this->timerEndsAt))) {
            return;
        }

        $expireGameRound->handle($room);
    }
}
