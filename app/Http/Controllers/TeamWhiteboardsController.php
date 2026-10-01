<?php

namespace App\Http\Controllers;

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeamWhiteboardsController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, CreateWhiteboard $createWhiteboard): RedirectResponse
    {
        Gate::authorize('createWhiteboard', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
        ]);

        $board = $createWhiteboard->handle($team, $request->user(), $validated['title']);

        return to_route('whiteboards.show', $board);
    }
}
