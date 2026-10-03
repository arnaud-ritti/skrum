<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\BuildTeamSurveySnapshot;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TeamSurveyResultsController extends Controller
{
    public function show(Request $request, TeamSurvey $teamSurvey, BuildTeamSurveySnapshot $buildTeamSurveySnapshot): Response|RedirectResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::viewable($teamSurvey, $respondent);

        if ($teamSurvey->status === TeamSurveyStatus::Draft) {
            return to_route('surveys.edit', $teamSurvey);
        }

        return Inertia::render('surveys/results', [
            'snapshot' => $buildTeamSurveySnapshot->handle($teamSurvey, $respondent),
        ]);
    }
}
