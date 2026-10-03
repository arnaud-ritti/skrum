<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\RemoveStatementSet;
use App\Actions\Games\WriteStatementSet;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameStatementsController extends Controller
{
    public function update(Request $request, GameRoom $room, WriteStatementSet $writeStatementSet): JsonResponse
    {
        $player = GamePlayer::current($request);

        $validated = $request->validate([
            'statements' => ['required', 'array', 'size:3'],
            'statements.*' => ['required', 'string', 'max:120', 'distinct:ignore_case'],
            'lie_index' => ['required', 'integer', 'between:0,2'],
        ]);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        return response()->json([
            'mine' => $writeStatementSet->handle($room, $player, $validated['statements'], (int) $validated['lie_index']),
        ]);
    }

    public function destroy(Request $request, GameRoom $room, RemoveStatementSet $removeStatementSet): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        $removeStatementSet->handle($room, $player);

        return response()->noContent();
    }
}
