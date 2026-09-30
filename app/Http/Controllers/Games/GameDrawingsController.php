<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\ClearDrawing;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameDrawingsController extends Controller
{
    public function destroy(Request $request, GameRoom $room, GameRound $round, ClearDrawing $clearDrawing): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-draw:{$player->id}", GameDrawingOpsController::RateLimitPerSecond, GameDrawingOpsController::SecondsPerDrawingToken);

        $clearDrawing->handle($room, $round, $player);

        return response()->noContent();
    }
}
