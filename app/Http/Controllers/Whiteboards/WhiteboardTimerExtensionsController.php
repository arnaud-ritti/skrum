<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\WhiteboardGuard;
use App\Events\Whiteboards\WhiteboardTimerChanged;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WhiteboardTimerExtensionsController extends Controller
{
    public const ExtensionSeconds = 120;

    public function store(Request $request, Whiteboard $board): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::facilitator($board, $member);

        $endsAt = DB::transaction(function () use ($board, $member): CarbonInterface {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            if ($locked->timer_ends_at === null || $locked->timer_ends_at->isPast()) {
                throw ValidationException::withMessages(['timer' => __('No timer is running.')]);
            }

            $endsAt = $locked->timer_ends_at->copy()->addSeconds(self::ExtensionSeconds);

            if (now()->diffInSeconds($endsAt) > WhiteboardTimersController::MaxSeconds) {
                throw ValidationException::withMessages(['timer' => __('A timer cannot run longer than one hour.')]);
            }

            $locked->update(['timer_ends_at' => $endsAt]);

            (new WhiteboardTimerChanged($locked->id, $endsAt->toIso8601String()))->sendToOthers();

            return $endsAt;
        });

        return response()->json(['timerEndsAt' => $endsAt->toIso8601String()]);
    }
}
