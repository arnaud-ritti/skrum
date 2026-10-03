<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\ChangeDrawWord;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameWordChangesController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, ChangeDrawWord $changeDrawWord): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        return response()->json($changeDrawWord->handle($room, $round, $player));
    }
}
