<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\PickGameLetter;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GameLettersController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, PickGameLetter $pickGameLetter): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-letter:{$player->id}", 3, 1);

        $validated = $request->validate([
            'letter' => ['required', 'string', 'regex:/^[A-Za-z]$/'],
        ]);

        return response()->json($pickGameLetter->handle($room, $round, $player, Str::lower($validated['letter'])));
    }
}
