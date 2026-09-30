<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\CloseGifRound;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameClosuresController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, CloseGifRound $closeGifRound): JsonResponse
    {
        return response()->json(['ended' => $closeGifRound->handle($room, $round, GamePlayer::current($request))]);
    }
}
