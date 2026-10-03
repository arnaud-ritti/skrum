<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\ChooseGameOption;
use App\Actions\Games\RetractGameChoice;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameChoicesController extends Controller
{
    public function update(Request $request, GameRoom $room, GameRound $round, ChooseGameOption $chooseGameOption): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        $validated = $request->validate([
            'choice' => ['required', 'string', 'max:36'],
        ]);

        $chooseGameOption->handle($room, $round, $player, $validated['choice']);

        return response()->noContent();
    }

    public function destroy(Request $request, GameRoom $room, GameRound $round, RetractGameChoice $retractGameChoice): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        $retractGameChoice->handle($room, $round, $player);

        return response()->noContent();
    }
}
