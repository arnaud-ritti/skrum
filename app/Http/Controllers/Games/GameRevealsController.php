<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\PresentGameRound;
use App\Actions\Games\RevealGifAnswers;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRevealsController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, RevealGifAnswers $revealGifAnswers, PresentGameRound $presentGameRound): JsonResponse
    {
        $player = GamePlayer::current($request);

        $revealGifAnswers->handle($room, $round, $player);

        return response()->json($presentGameRound->handle($round->refresh(), $room->refresh(), $player));
    }
}
