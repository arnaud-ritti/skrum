<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GuessWholeWord;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameWordGuessesController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, GuessWholeWord $guessWholeWord): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-letter:{$player->id}", 3, 1);

        $validated = $request->validate([
            'text' => ['required', 'string', 'max:50'],
        ]);

        return response()->json($guessWholeWord->handle($room, $round, $player, $validated['text']));
    }
}
