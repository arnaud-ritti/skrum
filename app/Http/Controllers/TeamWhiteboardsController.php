<?php

namespace App\Http\Controllers;

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeamWhiteboardsController extends Controller
{
    public function __construct(private BuiltInTemplates $builtInTemplates) {}

    public function store(Request $request, Workspace $workspace, Team $team, CreateWhiteboard $createWhiteboard): RedirectResponse
    {
        Gate::authorize('createWhiteboard', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'template' => ['sometimes', 'nullable', 'string', Rule::in(BuiltInTemplates::keys())],
        ]);

        $board = $createWhiteboard->handle($team, $request->user(), $validated['title'], [
            'elements' => $this->builtInTemplates->elements($validated['template'] ?? BuiltInTemplates::Blank),
            'files' => [],
        ]);

        return to_route('whiteboards.show', $board);
    }
}
