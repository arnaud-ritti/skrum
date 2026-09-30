<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\MakeGameGuess;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameGuessesController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, MakeGameGuess $makeGameGuess): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        $validated = $request->validate([
            'text' => ['required', 'string', 'max:50'],
        ]);

        return response()->json($makeGameGuess->handle($room, $round, $player, trim($validated['text'])));
    }
}
