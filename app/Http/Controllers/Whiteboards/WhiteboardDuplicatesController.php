<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\DuplicateWhiteboard;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class WhiteboardDuplicatesController extends Controller
{
    public function store(Request $request, Whiteboard $board, DuplicateWhiteboard $duplicateWhiteboard): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));

        Gate::authorize('createWhiteboard', $board->team);

        $copy = $duplicateWhiteboard->handle($board, $request->user());

        return response()->json(['url' => route('whiteboards.show', $copy, absolute: false)], 201);
    }
}
