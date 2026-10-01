<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\CopyWhiteboardVersion;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhiteboardVersionCopiesController extends Controller
{
    public function store(Request $request, Whiteboard $board, WhiteboardVersion $version, CopyWhiteboardVersion $copyWhiteboardVersion): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));

        $copy = $copyWhiteboardVersion->handle($board, $request->user(), $version);

        return response()->json(['url' => route('whiteboards.show', $copy, absolute: false)], 201);
    }
}
