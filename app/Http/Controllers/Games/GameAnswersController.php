<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\RemoveGifAnswer;
use App\Actions\Games\SetGifAnswer;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameAnswersController extends Controller
{
    public function update(Request $request, GameRoom $room, GameRound $round, SetGifAnswer $setGifAnswer): JsonResponse
    {
        $validated = $request->validate([
            'gif_id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,64}$/'],
        ]);

        return response()->json([
            'myAnswer' => $setGifAnswer->handle($room, $round, GamePlayer::current($request), $validated['gif_id']),
        ]);
    }

    public function destroy(Request $request, GameRoom $room, GameRound $round, RemoveGifAnswer $removeGifAnswer): Response
    {
        $removeGifAnswer->handle($room, $round, GamePlayer::current($request));

        return response()->noContent();
    }
}
