<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Games\ScheduleIcebreakerExpiry;
use App\Actions\Retros\RetroGuard;
use App\Events\Retros\TimerChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RetroTimerExtensionsController extends Controller
{
    public const int ExtensionSeconds = 120;

    public function store(Request $request, Retro $retro, ScheduleIcebreakerExpiry $scheduleIcebreakerExpiry): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        $extended = DB::transaction(function () use ($retro, $participant, $scheduleIcebreakerExpiry): Retro {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            if ($locked->timer_paused_seconds !== null) {
                $paused = $locked->timer_paused_seconds + self::ExtensionSeconds;

                if ($paused > RetroTimersController::MaxSeconds) {
                    throw ValidationException::withMessages(['timer' => __('A timer cannot run longer than two hours.')]);
                }

                $locked->update(['timer_paused_seconds' => $paused]);

                TimerChanged::of($locked)->sendToOthers();

                return $locked;
            }

            if ($locked->timer_ends_at === null || $locked->timer_ends_at->isPast()) {
                throw ValidationException::withMessages(['timer' => __('No timer is running.')]);
            }

            $endsAt = $locked->timer_ends_at->copy()->addSeconds(self::ExtensionSeconds);

            if (now()->diffInSeconds($endsAt) > RetroTimersController::MaxSeconds) {
                throw ValidationException::withMessages(['timer' => __('A timer cannot run longer than two hours.')]);
            }

            $locked->update(['timer_ends_at' => $endsAt]);

            TimerChanged::of($locked)->sendToOthers();

            $scheduleIcebreakerExpiry->handle($locked);

            return $locked;
        });

        return response()->json(TimerChanged::of($extended)->broadcastWith());
    }
}
