<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\PassGameRound;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRoundPassesController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, PassGameRound $passGameRound): JsonResponse
    {
        return response()->json(['ended' => $passGameRound->handle($room, $round, GamePlayer::current($request))]);
    }
}
