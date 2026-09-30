<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\BuildPokerSnapshot;
use App\Enums\PokerDeck;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PokerGamesController extends Controller
{
    public function show(Request $request, PokerGame $game, BuildPokerSnapshot $buildPokerSnapshot): Response
    {
        return Inertia::render('poker/show', [
            'snapshot' => $buildPokerSnapshot->handle($game, PokerPlayer::current($request)),
            'deckOptions' => PokerDeck::options(),
        ]);
    }
}
