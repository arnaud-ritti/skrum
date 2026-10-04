<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\SaveWhiteboardTemplate;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class WhiteboardTemplatesController extends Controller
{
    public function store(Request $request, Whiteboard $board, SaveWhiteboardTemplate $saveWhiteboardTemplate): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));

        Gate::authorize('createWhiteboard', $board->team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:300'],
        ]);

        $template = $saveWhiteboardTemplate->handle($board, $request->user(), $validated['name'], $validated['description'] ?? null);

        return response()->json(['id' => $template->id, 'name' => $template->name], 201);
    }
}
