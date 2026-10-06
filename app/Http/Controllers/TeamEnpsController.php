<?php

namespace App\Http\Controllers;

use App\Actions\TeamSurveys\BuildTeamEnps;
use App\Enums\TeamSurveyTemplate;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamEnpsController extends Controller
{
    /**
     * Read by whoever reads the results of a closed survey of the team: anyone who may view the team.
     */
    public function show(Request $request, Workspace $workspace, Team $team, BuildTeamEnps $buildTeamEnps): Response
    {
        Gate::authorize('view', $team);

        return Inertia::render('teams/enps', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'enps' => $buildTeamEnps->handle($team),
            'canStart' => $request->user()->can('createSurvey', $team),
            'startUrl' => route('teams.show', [$workspace, $team, 'new' => 'survey', 'template' => TeamSurveyTemplate::Enps->value]),
        ]);
    }
}
