<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\BuildWhiteboardSnapshot;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhiteboardSnapshotsController extends Controller
{
    public function show(Request $request, Whiteboard $board, BuildWhiteboardSnapshot $buildWhiteboardSnapshot): JsonResponse
    {
        return response()->json($buildWhiteboardSnapshot->handle($board, WhiteboardMember::current($request)));
    }
}
