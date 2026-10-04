<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\SetGameClue;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Rules\ClueEmoji;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRoundCluesController extends Controller
{
    public const RateLimitPerSecond = 5;

    public const SecondsPerClueToken = 0.2;

    public function update(Request $request, GameRoom $room, GameRound $round, SetGameClue $setGameClue): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-clue:{$player->id}", self::RateLimitPerSecond, self::SecondsPerClueToken);

        $validated = $request->validate([
            'clue' => ['present', 'array', 'list', 'max:'.SetGameClue::MaxEmoji],
            'clue.*' => [new ClueEmoji],
        ], [
            'clue.max' => __('A clue holds five emoji at most.'),
        ]);

        return response()->json($setGameClue->handle($room, $round, $player, $validated['clue']));
    }
}
