<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\UndoDrawingOp;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameLastDrawingOpsController extends Controller
{
    public function destroy(Request $request, GameRoom $room, GameRound $round, UndoDrawingOp $undoDrawingOp): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-draw:{$player->id}", GameDrawingOpsController::RateLimitPerSecond, GameDrawingOpsController::SecondsPerDrawingToken);

        return response()->json($undoDrawingOp->handle($room, $round, $player));
    }
}
