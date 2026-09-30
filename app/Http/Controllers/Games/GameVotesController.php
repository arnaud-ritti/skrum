<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\CastGifVote;
use App\Actions\Games\RetractGifVote;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameVotesController extends Controller
{
    public function update(Request $request, GameRoom $room, GameRound $round, CastGifVote $castGifVote): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        $validated = $request->validate([
            'answer_id' => ['required', 'uuid'],
        ]);

        $castGifVote->handle($room, $round, $player, $validated['answer_id']);

        return response()->noContent();
    }

    public function destroy(Request $request, GameRoom $room, GameRound $round, RetractGifVote $retractGifVote): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 1);

        $retractGifVote->handle($room, $round, $player);

        return response()->noContent();
    }
}
