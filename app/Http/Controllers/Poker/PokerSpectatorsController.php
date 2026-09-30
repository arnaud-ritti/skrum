<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\AutoRevealPokerRound;
use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\SetPokerSpectator;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PokerSpectatorsController extends Controller
{
    public function update(Request $request, PokerGame $game, PokerPlayer $player, SetPokerSpectator $setPokerSpectator, AutoRevealPokerRound $autoRevealPokerRound): Response
    {
        $requester = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        $this->authorizeSwitch($game, $requester, $player);

        $validated = $request->validate([
            'spectator' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($game, $requester, $player, $validated, $setPokerSpectator): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            $this->authorizeSwitch($locked, $requester, $player);

            $setPokerSpectator->handle($locked, $player, (bool) $validated['spectator']);
        });

        if ((bool) $validated['spectator']) {
            $this->revealIfEveryoneVoted($game, $autoRevealPokerRound);
        }

        return response()->noContent();
    }

    private function revealIfEveryoneVoted(PokerGame $game, AutoRevealPokerRound $autoRevealPokerRound): void
    {
        $openRound = $game->fresh()?->latestRoundOfCurrentTask();

        if ($openRound !== null) {
            $autoRevealPokerRound->handle($openRound);
        }
    }

    private function authorizeSwitch(PokerGame $game, PokerPlayer $requester, PokerPlayer $target): void
    {
        if ($requester->id === $target->id) {
            return;
        }

        PokerGuard::facilitator($game, $requester);
    }
}
