<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\CloseWhiteboardVote;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVoteSession;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class WhiteboardVoteClosuresController extends Controller
{
    public function store(Request $request, Whiteboard $board, WhiteboardVoteSession $voteSession, CloseWhiteboardVote $closeWhiteboardVote): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::facilitator($board, $member);

        $closeWhiteboardVote->handle($board, $voteSession, $member);

        return response()->noContent();
    }
}
