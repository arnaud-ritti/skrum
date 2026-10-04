<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use App\Support\Sessions\JoinCodes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TeamSurveyGuestTokensController extends Controller
{
    public function store(Request $request, TeamSurvey $teamSurvey, JoinCodes $joinCodes): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $rotated = DB::transaction(function () use ($teamSurvey, $respondent): TeamSurvey {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);

            $locked->update(['guest_token' => Str::random(40), 'version' => $locked->version + 1]);

            $locked->respondents()
                ->whereNull('user_id')
                ->whereNotNull('guest_secret_hash')
                ->update(['guest_secret_hash' => null]);

            return $locked;
        });

        $joinCode = $joinCodes->rotate($teamSurvey);

        TeamSurveyChanged::for($rotated)->sendToOthers();

        return response()->json([
            'guestUrl' => route('surveys.join.show', $rotated->guest_token),
            'joinCode' => $joinCode,
        ]);
    }
}
