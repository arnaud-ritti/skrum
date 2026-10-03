<?php

namespace App\Http\Controllers;

use App\Actions\Sessions\ListTeamSessions;
use App\Actions\Teams\PresentNewSessionOptions;
use App\Enums\SessionState;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Sessions\SessionCursor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamSessionsController extends Controller
{
    public function index(
        Request $request,
        Workspace $workspace,
        Team $team,
        ListTeamSessions $listTeamSessions,
        PresentNewSessionOptions $presentNewSessionOptions,
    ): Response {
        Gate::authorize('view', $team);

        $validated = $request->validate([
            'tab' => ['sometimes', Rule::enum(SessionState::class)],
            'before' => ['sometimes', 'nullable', 'string', 'max:80'],
        ]);

        $state = SessionState::from($validated['tab'] ?? SessionState::Live->value);
        $page = $listTeamSessions->handle($team, $request->user(), $state, SessionCursor::parse($validated['before'] ?? null));

        return Inertia::render('teams/sessions', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'tab' => $state->value,
            'sessions' => $page['sessions'],
            'total' => $page['total'],
            'nextCursor' => $page['nextCursor'],
            ...$presentNewSessionOptions->handle($request->user(), $workspace, $team),
        ]);
    }
}
