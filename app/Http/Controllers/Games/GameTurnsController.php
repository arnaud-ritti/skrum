<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\EndGameTurn;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameTurnsController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, EndGameTurn $endGameTurn): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        $validated = $request->validate([
            'expected_player_id' => ['required', 'string', 'uuid'],
        ]);

        return response()->json($endGameTurn->handle($room, $round, $player, $validated['expected_player_id']));
    }
}
