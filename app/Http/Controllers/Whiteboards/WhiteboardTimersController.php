<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\WhiteboardGuard;
use App\Events\Whiteboards\WhiteboardTimerChanged;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WhiteboardTimersController extends Controller
{
    public const MaxSeconds = 3600;

    public function update(Request $request, Whiteboard $board): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::facilitator($board, $member);

        $validated = $request->validate([
            'seconds' => ['present', 'nullable', 'integer', 'min:10', 'max:'.self::MaxSeconds],
        ]);

        $endsAt = $validated['seconds'] === null ?
            null :
            now()->addSeconds((int) $validated['seconds'])->startOfSecond();

        DB::transaction(function () use ($board, $member, $endsAt): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            $locked->update(['timer_ends_at' => $endsAt]);

            new WhiteboardTimerChanged($locked->id, $endsAt?->toIso8601String())->sendToOthers();
        });

        return response()->json(['timerEndsAt' => $endsAt?->toIso8601String()]);
    }
}
