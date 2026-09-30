<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PlayPokerCard;
use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerVotesController extends Controller
{
    public function update(Request $request, PokerGame $game, PokerRound $round, PlayPokerCard $playPokerCard): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canVote($player);

        $validated = $request->validate([
            'value' => ['required', 'string', 'max:8'],
        ]);

        return response()->json($playPokerCard->handle($game, $round, $player, $validated['value']));
    }

    public function destroy(Request $request, PokerGame $game, PokerRound $round, PlayPokerCard $playPokerCard): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canVote($player);

        return response()->json($playPokerCard->handle($game, $round, $player, null));
    }
}
