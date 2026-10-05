<?php

namespace App\Http\Controllers;

use App\Actions\Sessions\ListTeamSessions;
use App\Actions\Teams\PresentNewSessionOptions;
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
            'kind' => ['sometimes', 'nullable', Rule::in(ListTeamSessions::Kinds)],
            'before' => ['sometimes', 'nullable', 'string', 'max:80'],
            'q' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $kind = $validated['kind'] ?? null;
        $search = $request->string('q')->trim()->toString();
        $search = $search === '' ? null : $search;
        $page = $listTeamSessions->timeline($team, $request->user(), $kind, SessionCursor::parse($validated['before'] ?? null), search: $search);

        return Inertia::render('teams/sessions', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'kind' => $kind,
            'q' => $search,
            'live' => $page['live'],
            'sessions' => Inertia::merge($page['sessions'])->matchOn('id'),
            'counts' => $page['counts'],
            'total' => $page['total'],
            'nextCursor' => $page['nextCursor'],
            'hasSprints' => $team->sprints()->exists(),
            ...$presentNewSessionOptions->handle($request->user(), $workspace, $team),
        ]);
    }
}
