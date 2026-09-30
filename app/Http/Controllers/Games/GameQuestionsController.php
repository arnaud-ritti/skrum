<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\ChangeGifQuestion;
use App\Actions\Games\GameGuard;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameQuestionsController extends Controller
{
    public function update(Request $request, GameRoom $room, GameRound $round, ChangeGifQuestion $changeGifQuestion): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::mutable($room);
        GameGuard::host($room, $player);

        $validated = $request->validate([
            'text' => ['sometimes', 'string', 'max:200'],
        ]);

        return response()->json([
            'question' => $changeGifQuestion->handle($room, $round, $player, $validated['text'] ?? null),
        ]);
    }
}
