<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\BuildPokerSnapshot;
use App\Actions\Poker\PokerGuard;
use App\Enums\PokerDeck;
use App\Events\Poker\PokerGameDeleted;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
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

    public function destroy(Request $request, PokerGame $game): HttpResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::canDelete($game, $player);

        DB::transaction(function () use ($game, $player): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::canDelete($locked, $player);

            $gameId = $locked->id;

            $locked->delete();

            new PokerGameDeleted($gameId)->sendToOthers();
        });

        return response()->noContent();
    }
}
