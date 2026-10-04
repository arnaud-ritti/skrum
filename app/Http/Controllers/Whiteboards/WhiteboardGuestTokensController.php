<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\WhiteboardGuard;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Support\Sessions\JoinCodes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WhiteboardGuestTokensController extends Controller
{
    public function store(Request $request, Whiteboard $board, JoinCodes $joinCodes): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::facilitator($board, $member);

        $guestToken = DB::transaction(function () use ($board, $member): string {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            $locked->update(['guest_token' => Str::random(40)]);

            $locked->members()
                ->whereNull('user_id')
                ->whereNotNull('guest_secret_hash')
                ->update(['guest_secret_hash' => null]);

            new WhiteboardChanged($locked->id)->sendToOthers();

            return $locked->guest_token;
        });

        return response()->json([
            'guestUrl' => route('whiteboards.join.show', $guestToken),
            'joinCode' => $joinCodes->rotate($board),
        ]);
    }
}
