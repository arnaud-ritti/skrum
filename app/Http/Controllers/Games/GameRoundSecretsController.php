<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRoundSecretsController extends Controller
{
    public function show(Request $request, GameRoom $room, GameRound $round): JsonResponse
    {
        GameGuard::leader($round, GamePlayer::current($request));
        GameGuard::activeRound($room, $round);

        return response()->json(['word' => $round->word]);
    }
}
