<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\RemoveGifAnswer;
use App\Actions\Games\SetGifAnswer;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameAnswersController extends Controller
{
    public function update(Request $request, GameRoom $room, GameRound $round, SetGifAnswer $setGifAnswer): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        $validated = $request->validate([
            'gif_id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,64}$/'],
            'caption' => ['sometimes', 'nullable', 'string', 'max:60'],
        ]);

        return response()->json([
            'myAnswer' => $setGifAnswer->handle(
                $room,
                $round,
                $player,
                $validated['gif_id'],
                $validated['caption'] ?? null,
                keepsCaption: ! array_key_exists('caption', $validated),
            ),
        ]);
    }

    public function destroy(Request $request, GameRoom $room, GameRound $round, RemoveGifAnswer $removeGifAnswer): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        $removeGifAnswer->handle($room, $round, $player);

        return response()->noContent();
    }
}
