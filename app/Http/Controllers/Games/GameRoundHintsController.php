<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\RevealGameHint;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRoundHintsController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, RevealGameHint $revealGameHint): JsonResponse
    {
        return response()->json($revealGameHint->handle($room, $round, GamePlayer::current($request)));
    }
}
