<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\RestoreWhiteboardVersion;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVersion;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class WhiteboardVersionRestoresController extends Controller
{
    public function store(Request $request, Whiteboard $board, WhiteboardVersion $version, RestoreWhiteboardVersion $restoreWhiteboardVersion): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::notGuest($member);
        WhiteboardGuard::facilitator($board, $member);

        $restoreWhiteboardVersion->handle($board, $member, $version);

        return response()->noContent();
    }
}
