<?php

namespace App\Actions\Games;

use App\Events\Games\GameTurnChanged;
use App\Models\GameRoom;
use App\Models\GameRound;

/**
 * Spec §6.4. The caller holds the room and round locks.
 */
class AdvanceGameTurn
{
    public function __construct(private ScheduleTurnExpiry $scheduleTurnExpiry) {}

    /**
     * Gives the turn to the next player of the round's order (back to the
     * first when the order wraps) with a fresh deadline, and says so.
     * False when the order is played once and its last turn is over.
     */
    public function handle(GameRoom $lockedRoom, GameRound $lockedRound, bool $wraps = true): bool
    {
        $order = $lockedRound->turnOrder();

        if ($order === []) {
            return false;
        }

        $index = array_search($lockedRound->turn_player_id, $order, true);
        $next = $index === false ? 0 : $index + 1;

        if ($next >= count($order) && ! $wraps) {
            return false;
        }

        $lockedRound->forceFill([
            'turn_player_id' => $order[$next % count($order)],
            'turn_ends_at' => $lockedRound->turn_seconds === null ? null : now()->startOfSecond()->addSeconds($lockedRound->turn_seconds),
        ])->save();

        $this->scheduleTurnExpiry->handle($lockedRound);

        new GameTurnChanged($lockedRoom, self::payload($lockedRound))->sendToOthers();

        return true;
    }

    /**
     * @return array{roundId: string, turnPlayerId: ?string, turnEndsAt: ?string}
     */
    public static function payload(GameRound $round): array
    {
        return [
            'roundId' => $round->id,
            'turnPlayerId' => $round->turn_player_id,
            'turnEndsAt' => $round->turn_ends_at?->toIso8601String(),
        ];
    }
}
