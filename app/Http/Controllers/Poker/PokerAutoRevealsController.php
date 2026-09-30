<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\AutoRevealPokerRound;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerAutoRevealsController extends Controller
{
    /**
     * Any player may ask: every condition is re-checked on the server.
     */
    public function store(Request $request, PokerGame $game, PokerRound $round, AutoRevealPokerRound $autoRevealPokerRound): JsonResponse
    {
        PokerPlayer::current($request);

        return response()->json(['revealed' => $autoRevealPokerRound->handle($round)]);
    }
}
