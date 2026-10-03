<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\DuplicateTeamSurvey;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeamSurveyDuplicatesController extends Controller
{
    public function store(Request $request, TeamSurvey $teamSurvey, DuplicateTeamSurvey $duplicateTeamSurvey): RedirectResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::notGuest($respondent);
        TeamSurveyGuard::viewable($teamSurvey, $respondent);
        Gate::authorize('createSurvey', $teamSurvey->team);

        return to_route('surveys.edit', $duplicateTeamSurvey->handle($teamSurvey, $request->user()));
    }
}
