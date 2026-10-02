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

class RetroTimersController extends Controller
{
    public const MaxSeconds = 7200;

    public function update(Request $request, Retro $retro, ScheduleIcebreakerExpiry $scheduleIcebreakerExpiry): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        $validated = $request->validate([
            'seconds' => ['present', 'nullable', 'integer', 'min:10', 'max:'.self::MaxSeconds],
        ]);

        // Whole seconds: a game expiry job compares its end time with the stored one.
        $endsAt = $validated['seconds'] === null
            ? null
            : now()->addSeconds((int) $validated['seconds'])->startOfSecond();

        DB::transaction(function () use ($retro, $participant, $endsAt, $scheduleIcebreakerExpiry): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            $locked->update(['timer_ends_at' => $endsAt]);

            (new TimerChanged($locked->id, $endsAt?->toIso8601String()))->sendToOthers();

            $scheduleIcebreakerExpiry->handle($locked);
        });

        return response()->json(['timerEndsAt' => $endsAt?->toIso8601String()]);
    }
}
