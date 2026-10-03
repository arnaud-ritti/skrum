<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Games\ScheduleIcebreakerExpiry;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The pause of the retro's timer: `update` pauses, `destroy` resumes. The
 * icebreaker's timer is the game's round clock and is never paused.
 */
class RetroTimerPausesController extends Controller
{
    public function update(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        $paused = DB::transaction(function () use ($retro, $participant): Retro {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            if ($locked->phase === RetroPhase::Icebreaker) {
                throw ValidationException::withMessages(['timer' => __("The icebreaker's timer cannot be paused.")]);
            }

            if ($locked->timer_ends_at === null || ! $locked->timer_ends_at->isFuture()) {
                throw ValidationException::withMessages(['timer' => __('No timer is running.')]);
            }

            $seconds = max(1, (int) ceil(now()->diffInMilliseconds($locked->timer_ends_at, true) / 1000));

            $locked->update(['timer_ends_at' => null, 'timer_paused_seconds' => $seconds]);

            TimerChanged::of($locked)->sendToOthers();

            return $locked;
        });

        return response()->json(TimerChanged::of($paused)->broadcastWith());
    }

    public function destroy(Request $request, Retro $retro, ScheduleIcebreakerExpiry $scheduleIcebreakerExpiry): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        $resumed = DB::transaction(function () use ($retro, $participant, $scheduleIcebreakerExpiry): Retro {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            if ($locked->timer_paused_seconds === null) {
                throw ValidationException::withMessages(['timer' => __('The timer is not paused.')]);
            }

            $locked->update([
                'timer_ends_at' => now()->addSeconds($locked->timer_paused_seconds)->startOfSecond(),
                'timer_paused_seconds' => null,
            ]);

            TimerChanged::of($locked)->sendToOthers();

            $scheduleIcebreakerExpiry->handle($locked);

            return $locked;
        });

        return response()->json(TimerChanged::of($resumed)->broadcastWith());
    }
}
