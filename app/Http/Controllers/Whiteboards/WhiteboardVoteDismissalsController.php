<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\WhiteboardGuard;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVoteSession;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WhiteboardVoteDismissalsController extends Controller
{
    public function store(Request $request, Whiteboard $board, WhiteboardVoteSession $voteSession): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::facilitator($board, $member);

        DB::transaction(function () use ($board, $voteSession, $member): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            $session = $locked->voteSessions()->whereKey($voteSession->id)->firstOrFail();

            if ($session->isOpen()) {
                throw ValidationException::withMessages(['votes' => __('Close the vote first.')]);
            }

            if ($session->dismissed_at !== null) {
                return;
            }

            $session->update(['dismissed_at' => now()]);

            (new WhiteboardChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }
}
