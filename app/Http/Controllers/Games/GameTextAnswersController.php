<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\RemoveTextAnswer;
use App\Actions\Games\SetTextAnswer;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameTextAnswersController extends Controller
{
    /**
     * A bucket of its own, wider than game-play's: writing, fixing and
     * withdrawing an answer is typing, not a move of the game.
     */
    private const int Burst = 5;

    public function update(Request $request, GameRoom $room, GameRound $round, SetTextAnswer $setTextAnswer): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-text-answer:{$player->id}", self::Burst, 1);

        $validated = $request->validate([
            'text' => ['required', 'string', 'max:120'],
        ]);

        return response()->json([
            'myAnswer' => $setTextAnswer->handle($room, $round, $player, $validated['text']),
        ]);
    }

    public function destroy(Request $request, GameRoom $room, GameRound $round, RemoveTextAnswer $removeTextAnswer): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-text-answer:{$player->id}", self::Burst, 1);

        $removeTextAnswer->handle($room, $round, $player);

        return response()->noContent();
    }
}
