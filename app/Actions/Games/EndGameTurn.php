<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class EndGameTurn
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private EndGameRound $endGameRound,
    ) {}

    /**
     * "Done" from the turn's player or "Skip" from the host. The expected
     * player makes a second click, or a host and a player at once, end one
     * turn only; the late one hears that the turn moved on, whoever sent it.
     *
     * @return array{turn: array{roundId: string, turnPlayerId: ?string, turnEndsAt: ?string}, ended: ?array<string, mixed>}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $actor, string $expectedPlayerId): array
    {
        return DB::transaction(function () use ($room, $round, $actor, $expectedPlayerId): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::activeRound($lockedRoom, $lockedRound);

            if (! $lockedRound->takesTurns()) {
                throw ValidationException::withMessages(['round' => __('This game is not played in turns.')]);
            }

            if ($lockedRound->turn_player_id !== $expectedPlayerId) {
                throw new ConflictHttpException(__('The turn has already moved on.'));
            }

            if (! $lockedRoom->isHost($actor) && $actor->id !== $lockedRound->turn_player_id) {
                throw new AuthorizationException(__('Only the host or the player whose turn it is can do this.'));
            }

            $outcome = $this->gameRulesRegistry->for($lockedRound->game)->expireTurn($lockedRoom, $lockedRound);
            $ended = $outcome === null ? null : $this->endGameRound->handle($lockedRoom, $lockedRound, $outcome);

            return ['turn' => AdvanceGameTurn::payload($lockedRound), 'ended' => $ended];
        });
    }
}
