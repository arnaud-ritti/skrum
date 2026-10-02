<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Games\ScheduleIcebreakerExpiry;
use App\Actions\Retros\RetroGuard;
use App\Events\Retros\TimerChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RetroTimerExtensionsController extends Controller
{
    public const ExtensionSeconds = 120;

    public function store(Request $request, Retro $retro, ScheduleIcebreakerExpiry $scheduleIcebreakerExpiry): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        $endsAt = DB::transaction(function () use ($retro, $participant, $scheduleIcebreakerExpiry): CarbonInterface {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            if ($locked->timer_ends_at === null || $locked->timer_ends_at->isPast()) {
                throw ValidationException::withMessages(['timer' => __('No timer is running.')]);
            }

            $endsAt = $locked->timer_ends_at->copy()->addSeconds(self::ExtensionSeconds);

            if (now()->diffInSeconds($endsAt) > RetroTimersController::MaxSeconds) {
                throw ValidationException::withMessages(['timer' => __('A timer cannot run longer than two hours.')]);
            }

            $locked->update(['timer_ends_at' => $endsAt]);

            (new TimerChanged($locked->id, $endsAt->toIso8601String()))->sendToOthers();

            $scheduleIcebreakerExpiry->handle($locked);

            return $endsAt;
        });

        return response()->json(['timerEndsAt' => $endsAt->toIso8601String()]);
    }
}
