<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class CloseGifRound
{
    public function __construct(private EndGameRound $endGameRound) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $host): array
    {
        return DB::transaction(function () use ($room, $round, $host): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::host($lockedRoom, $host);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::SprintGif);

            if ($lockedRound->revealed_at === null) {
                throw new ConflictHttpException(__('Voting has not started.'));
            }

            return $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Revealed)
                ?? throw new ConflictHttpException(__('This round is over.'));
        });
    }
}
