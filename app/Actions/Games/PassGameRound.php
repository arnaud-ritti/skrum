<?php

namespace App\Actions\Games;

use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class PassGameRound
{
    public function __construct(private EndGameRound $endGameRound) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): array
    {
        return DB::transaction(function () use ($room, $round, $player): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leaderOrHost($lockedRoom, $lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);

            $outcome = $lockedRound->keepsFinding() && $lockedRound->hasFinders()
                ? GameRoundOutcome::Guessed
                : GameRoundOutcome::Passed;

            return $this->endGameRound->handle($lockedRoom, $lockedRound, $outcome)
                ?? throw new ConflictHttpException(__('This round is over.'));
        });
    }
}
