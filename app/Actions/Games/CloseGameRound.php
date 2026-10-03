<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\ClosesVoting;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class CloseGameRound
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private EndGameRound $endGameRound,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $actor): array
    {
        return DB::transaction(function () use ($room, $round, $actor): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);

            $rules = $this->gameRulesRegistry->for($lockedRound->game);

            if (! $rules instanceof ClosesVoting) {
                throw ValidationException::withMessages(['round' => __('This action does not apply to this game.')]);
            }

            GameGuard::activeRound($lockedRoom, $lockedRound);

            $outcome = $rules->close($lockedRoom, $lockedRound, $actor);

            return $this->endGameRound->handle($lockedRoom, $lockedRound, $outcome)
                ?? throw new ConflictHttpException(__('This round is over.'));
        });
    }
}
