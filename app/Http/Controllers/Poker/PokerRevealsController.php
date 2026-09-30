<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerRound;
use App\Actions\Poker\RevealPokerRound;
use App\Enums\PokerRevealReason;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PokerRevealsController extends Controller
{
    public function store(Request $request, PokerGame $game, PokerRound $round, RevealPokerRound $revealPokerRound, PresentPokerRound $presentPokerRound): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        DB::transaction(function () use ($game, $round, $player, $revealPokerRound): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $lockedRound = PokerRound::query()->whereKey($round->id)->lockForUpdate()->firstOrFail();

            $revealPokerRound->handle($locked, $lockedRound, PokerRevealReason::Manual);
        });

        return response()->json(
            $presentPokerRound->handle($round->refresh()->load('votes'), $game->load('players'), $player->id),
        );
    }
}
