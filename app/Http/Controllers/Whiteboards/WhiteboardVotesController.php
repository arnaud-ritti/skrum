<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\CastWhiteboardVote;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVoteSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhiteboardVotesController extends Controller
{
    public function update(Request $request, Whiteboard $board, WhiteboardVoteSession $voteSession, string $elementId, CastWhiteboardVote $castWhiteboardVote): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        $validated = $request->validate([
            'count' => ['required', 'integer', 'min:0', 'max:20'],
        ]);

        return response()->json($castWhiteboardVote->handle($board, $voteSession, $member, $elementId, (int) $validated['count']));
    }
}
