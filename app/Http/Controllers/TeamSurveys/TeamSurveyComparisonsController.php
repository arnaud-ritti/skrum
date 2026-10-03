<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\CompareSurveys;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamSurveyComparisonsController extends Controller
{
    public function show(Request $request, TeamSurvey $teamSurvey, CompareSurveys $compareSurveys): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::notGuest($respondent);
        abort_unless($teamSurvey->resultsVisibleTo($respondent), 403);

        $validated = $request->validate(['with' => ['sometimes', 'uuid']]);

        $other = isset($validated['with'])
            ? TeamSurvey::query()
                ->where('team_id', $teamSurvey->team_id)
                ->where('status', TeamSurveyStatus::Closed)
                ->whereKeyNot($teamSurvey->id)
                ->whereKey($validated['with'])
                ->firstOrFail()
            : $compareSurveys->defaultFor($teamSurvey);

        return response()->json([
            'comparison' => $other === null ? null : $compareSurveys->handle($teamSurvey, $other),
        ]);
    }
}
