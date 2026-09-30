<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameDrawingCleared;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;

class ClearDrawing
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): void
    {
        DB::transaction(function () use ($room, $round, $player): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess);

            $lockedRound->forceFill(['drawing' => [], 'drawing_points' => 0])->save();

            (new GameDrawingCleared($lockedRoom, $lockedRound->id))->sendToOthers();
        });
    }
}
