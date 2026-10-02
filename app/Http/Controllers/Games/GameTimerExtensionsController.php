<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\ScheduleRoundExpiry;
use App\Events\Games\GameTimerChanged;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GameTimerExtensionsController extends Controller
{
    public const ExtensionSeconds = 120;

    public function store(Request $request, GameRoom $room, ScheduleRoundExpiry $scheduleRoundExpiry): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);
        GameGuard::host($room, $player);

        $endsAt = DB::transaction(function () use ($room, $player, $scheduleRoundExpiry): CarbonInterface {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::host($locked, $player);

            if ($locked->timer_ends_at === null || $locked->timer_ends_at->isPast()) {
                throw ValidationException::withMessages(['timer' => __('No timer is running.')]);
            }

            $endsAt = $locked->timer_ends_at->copy()->addSeconds(self::ExtensionSeconds);

            if (now()->diffInSeconds($endsAt) > GameTimersController::MaxSeconds) {
                throw ValidationException::withMessages(['timer' => __('A timer cannot run longer than two hours.')]);
            }

            $locked->update(['timer_ends_at' => $endsAt]);

            (new GameTimerChanged($locked, $endsAt->toIso8601String()))->sendToOthers();

            $round = $locked->activeRound();

            if ($round !== null) {
                $scheduleRoundExpiry->handle($locked, $round);
            }

            return $endsAt;
        });

        return response()->json(['timerEndsAt' => $endsAt->toIso8601String()]);
    }
}
