<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerTimerChanged;
use App\Http\Controllers\Controller;
use App\Jobs\RevealPokerRoundOnTimer;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PokerTimerExtensionsController extends Controller
{
    public const ExtensionSeconds = 120;

    public function store(Request $request, PokerGame $game, PokerRound $round): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $endsAt = DB::transaction(function () use ($game, $round, $player): CarbonInterface {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedRound = PokerRound::query()->whereKey($round->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);
            PokerGuard::openRound($locked, $lockedRound);

            if ($lockedRound->timer_ends_at === null || $lockedRound->timer_ends_at->isPast()) {
                throw ValidationException::withMessages(['timer' => __('No timer is running.')]);
            }

            $endsAt = $lockedRound->timer_ends_at->copy()->addSeconds(self::ExtensionSeconds);

            if (now()->diffInSeconds($endsAt) > PokerTimersController::MaxSeconds) {
                throw ValidationException::withMessages(['timer' => __('A timer cannot run longer than one hour.')]);
            }

            $lockedRound->update(['timer_ends_at' => $endsAt]);

            (new PokerTimerChanged($locked->id, $lockedRound->id, $endsAt->toIso8601String()))->sendToOthers();

            dispatch(new RevealPokerRoundOnTimer($lockedRound->id, $endsAt->toIso8601String()))
                ->delay($endsAt)
                ->afterCommit();

            return $endsAt;
        });

        return response()->json(['timerEndsAt' => $endsAt->toIso8601String()]);
    }
}
