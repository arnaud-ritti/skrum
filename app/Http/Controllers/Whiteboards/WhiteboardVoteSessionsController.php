<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\OpenWhiteboardVote;
use App\Actions\Whiteboards\PresentWhiteboardVoting;
use App\Actions\Whiteboards\SanitizeWhiteboardElement;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVoteSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhiteboardVoteSessionsController extends Controller
{
    public function store(Request $request, Whiteboard $board, OpenWhiteboardVote $openWhiteboardVote): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::facilitator($board, $member);

        $validated = $request->validate([
            'votes_per_member' => ['required', 'integer', 'min:1', 'max:20'],
            'frame_element_id' => ['nullable', 'string', 'regex:'.SanitizeWhiteboardElement::IdPattern],
            'allow_multiple' => ['required', 'boolean'],
        ]);

        $session = $openWhiteboardVote->handle(
            $board,
            $member,
            (int) $validated['votes_per_member'],
            $validated['frame_element_id'] ?? null,
            $request->boolean('allow_multiple'),
        );

        return response()->json(['id' => $session->id], 201);
    }

    public function show(Request $request, Whiteboard $board, WhiteboardVoteSession $voteSession, PresentWhiteboardVoting $presentWhiteboardVoting): JsonResponse
    {
        return response()->json($presentWhiteboardVoting->session($voteSession, WhiteboardMember::current($request)));
    }
}
