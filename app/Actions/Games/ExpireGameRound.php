<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;

/**
 * Ends (or moves on) the active round once the room's timer, or the
 * current turn's deadline, has run out, both from the delayed jobs and
 * lazily on every game request, so a late queue never shows a stale round.
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

        if ($round === null) {
            return;
        }

        if (! $this->hasExpired($room, $round) && ! self::turnHasExpired($round)) {
            return;
        }

        DB::transaction(function () use ($room, $round): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            if ($lockedRoom->current_round_id !== $lockedRound->id || ! $lockedRound->isActive()) {
                return;
            }

            $rules = $this->gameRulesRegistry->for($lockedRound->game);

            if ($this->hasExpired($lockedRoom, $lockedRound)) {
                $outcome = $rules->expire($lockedRoom, $lockedRound);

                if ($outcome !== null) {
                    $this->endGameRound->handle($lockedRoom, $lockedRound, $outcome);
                }

                return;
            }

            if (! self::turnHasExpired($lockedRound)) {
                return;
            }

            $outcome = $rules->expireTurn($lockedRoom, $lockedRound);

            if ($outcome !== null) {
                $this->endGameRound->handle($lockedRoom, $lockedRound, $outcome);
            }
        });

        $room->refresh();
    }

    /**
     * The round's own deadline (a turn, or a round that is its own turn)
     * has passed.
     */
    public static function turnHasExpired(GameRound $round): bool
    {
        return $round->turn_ends_at !== null && ! $round->turn_ends_at->isFuture();
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
