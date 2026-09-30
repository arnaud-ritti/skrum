<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class RevealGifAnswers
{
    public function __construct(private RevealGifRound $revealGifRound) {}

    public function handle(GameRoom $room, GameRound $round, GamePlayer $host): void
    {
        DB::transaction(function () use ($room, $round, $host): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::host($lockedRoom, $host);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::SprintGif);

            if ($lockedRound->revealed_at !== null) {
                throw new ConflictHttpException(__('The GIFs are already revealed.'));
            }

            $this->revealGifRound->handle($lockedRoom, $lockedRound);
        });
    }
}
