<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerTimerChanged;
use App\Http\Controllers\Controller;
use App\Jobs\RevealPokerRoundOnTimer;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PokerTimersController extends Controller
{
    public function update(Request $request, PokerGame $game, PokerRound $round): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'seconds' => ['present', 'nullable', 'integer', 'min:10', 'max:3600'],
        ]);

        // Whole seconds: the column keeps no fraction, and the job compares
        // its scheduled instant with the stored one.
        $endsAt = $validated['seconds'] === null
            ? null
            : now()->addSeconds((int) $validated['seconds'])->startOfSecond();

        DB::transaction(function () use ($game, $round, $player, $endsAt): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedRound = PokerRound::query()->whereKey($round->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);
            PokerGuard::openRound($locked, $lockedRound);

            $lockedRound->update(['timer_ends_at' => $endsAt]);

            (new PokerTimerChanged($locked->id, $lockedRound->id, $endsAt?->toIso8601String()))->sendToOthers();

            if ($endsAt !== null) {
                dispatch(new RevealPokerRoundOnTimer($lockedRound->id, $endsAt->toIso8601String()))
                    ->delay($endsAt)
                    ->afterCommit();
            }
        });

        return response()->json(['timerEndsAt' => $endsAt?->toIso8601String()]);
    }
}
