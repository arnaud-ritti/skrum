<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\BuildTeamSurveySnapshot;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamSurveySnapshotsController extends Controller
{
    public function show(Request $request, TeamSurvey $teamSurvey, BuildTeamSurveySnapshot $buildTeamSurveySnapshot): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::viewable($teamSurvey, $respondent);

        return response()->json($buildTeamSurveySnapshot->handle($teamSurvey, $respondent));
    }
}
