<?php

namespace App\Http\Controllers;

use App\Actions\Teams\BuildTeamMoodTrend;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamHealthChecksController extends Controller
{
    public function show(Request $request, Workspace $workspace, Team $team, BuildTeamMoodTrend $buildTeamMoodTrend): Response
    {
        Gate::authorize('view', $team);

        return Inertia::render('teams/health-check', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'canEditStatements' => $request->user()->can('update', $team),
            'statementsUrl' => route('teams.healthStatements.index', [$workspace, $team]),
            'canCreateSurvey' => $request->user()->can('createSurvey', $team),
            'moodTrend' => Inertia::defer(fn (): array => $buildTeamMoodTrend->handle($team), 'trend', rescue: true),
        ]);
    }
}
