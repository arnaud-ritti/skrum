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
    /**
     * @return array{roundId: string, count: int}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): array
    {
        return DB::transaction(function () use ($room, $round, $player): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess);

            $drawing = $lockedRound->drawing;

            if ($drawing === []) {
                return ['roundId' => $lockedRound->id, 'count' => 0];
            }

            array_pop($drawing);

            $lockedRound->forceFill([
                'drawing' => $drawing,
                'drawing_points' => array_sum(array_map(DrawingOp::pointCount(...), $drawing)),
            ])->save();

            (new GameDrawingUndone($lockedRoom, $lockedRound->id, count($drawing)))->sendToOthers();

            return ['roundId' => $lockedRound->id, 'count' => count($drawing)];
        });
    }
}
