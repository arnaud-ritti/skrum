<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\AddDrawingOp;
use App\Actions\Games\UndoDrawingOp;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameDrawingOpsController extends Controller
{
    public const RateLimitPerSecond = 20;

    public const SecondsPerDrawingToken = 0.05;

    public function store(Request $request, GameRoom $room, GameRound $round, AddDrawingOp $addDrawingOp): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-draw:{$player->id}", self::RateLimitPerSecond, self::SecondsPerDrawingToken);

        $validated = $request->validate([
            'client_op_id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,64}$/'],
            'op' => ['required', 'array'],
        ]);

        return response()->json($addDrawingOp->handle($room, $round, $player, $validated['op'], $validated['client_op_id']), 201);
    }

    public function destroyLast(Request $request, GameRoom $room, GameRound $round, UndoDrawingOp $undoDrawingOp): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-draw:{$player->id}", self::RateLimitPerSecond, self::SecondsPerDrawingToken);

        return response()->json($undoDrawingOp->handle($room, $round, $player));
    }
}
