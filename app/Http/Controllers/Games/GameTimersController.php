<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\ScheduleRoundExpiry;
use App\Events\Games\GameTimerChanged;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GameTimersController extends Controller
{
    public const int MaxSeconds = 7200;

    public function update(Request $request, GameRoom $room, ScheduleRoundExpiry $scheduleRoundExpiry): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);
        GameGuard::host($room, $player);

        $validated = $request->validate([
            'seconds' => ['present', 'nullable', 'integer', 'min:10', 'max:'.self::MaxSeconds],
        ]);

        // Whole seconds: the column keeps no fraction, and the job compares
        // its scheduled instant with the stored one.
        $endsAt = $validated['seconds'] === null
            ? null
            : now()->addSeconds((int) $validated['seconds'])->startOfSecond();

        DB::transaction(function () use ($room, $player, $endsAt, $scheduleRoundExpiry): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::host($locked, $player);

            $locked->update(['timer_ends_at' => $endsAt]);

            new GameTimerChanged($locked, $endsAt?->toIso8601String())->sendToOthers();

            $round = $locked->activeRound();

            if ($round !== null) {
                $scheduleRoundExpiry->handle($locked, $round);
            }
        });

        return response()->json(['timerEndsAt' => $endsAt?->toIso8601String()]);
    }
}
