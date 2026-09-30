<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameDrawingUndone;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\DrawingOp;
use Illuminate\Support\Facades\DB;

class UndoDrawingOp
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): void
    {
        DB::transaction(function () use ($room, $round, $player): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess);

            $drawing = $lockedRound->drawing;

            if ($drawing === []) {
                return;
            }

            array_pop($drawing);

            $lockedRound->forceFill([
                'drawing' => $drawing,
                'drawing_points' => array_sum(array_map(fn (array $op): int => DrawingOp::pointCount($op), $drawing)),
            ])->save();

            (new GameDrawingUndone($lockedRoom, $lockedRound->id))->sendToOthers();
        });
    }
}
