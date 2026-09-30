<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;

/**
 * Ends (or moves on) the active round once the room's timer has run out,
 * both from the delayed job and lazily on every game request, so a late
 * queue never shows a stale round.
 */
class ExpireGameRound
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private EndGameRound $endGameRound,
    ) {}

    public function handle(GameRoom $room): void
    {
        $round = $room->activeRound();

        if ($round === null || ! $this->hasExpired($room, $round)) {
            return;
        }

        DB::transaction(function () use ($room, $round): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            if ($lockedRoom->current_round_id !== $lockedRound->id || ! $lockedRound->isActive()) {
                return;
            }

            if (! $this->hasExpired($lockedRoom, $lockedRound)) {
                return;
            }

            $outcome = $this->gameRulesRegistry->for($lockedRound->game)->expire($lockedRoom, $lockedRound);

            if ($outcome !== null) {
                $this->endGameRound->handle($lockedRoom, $lockedRound, $outcome);
            }
        });

        $room->refresh();
    }

    /**
     * A timer that ran out before the round's anchor (its start, or a later
     * stage such as a reveal) belongs to an earlier turn.
     */
    public function hasExpired(GameRoom $room, GameRound $round): bool
    {
        $endsAt = $room->effectiveTimerEndsAt();

        if ($endsAt === null || $endsAt->isFuture()) {
            return false;
        }

        $rules = $this->gameRulesRegistry->find($round->game);

        return $rules !== null && $endsAt->greaterThan($rules->expiryAnchor($round));
    }
}
