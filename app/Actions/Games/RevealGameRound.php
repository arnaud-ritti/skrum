<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use App\Support\Games\RevealsInStages;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class RevealGameRound
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private EndGameRound $endGameRound,
    ) {}

    /**
     * @return array<string, mixed>|null the ended payload, or null when the round moved to its next stage
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $actor): ?array
    {
        return DB::transaction(function () use ($room, $round, $actor): ?array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);

            $rules = $this->gameRulesRegistry->for($lockedRound->game);

            if (! $rules instanceof RevealsInStages) {
                throw ValidationException::withMessages(['round' => __('This action does not apply to this game.')]);
            }

            GameGuard::activeRound($lockedRoom, $lockedRound);

            $outcome = $rules->reveal($lockedRoom, $lockedRound, $actor);

            if ($outcome === null) {
                return null;
            }

            return $this->endGameRound->handle($lockedRoom, $lockedRound, $outcome)
                ?? throw new ConflictHttpException(__('This round is over.'));
        });
    }
}
