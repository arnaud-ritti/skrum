<?php

namespace App\Actions\TeamSurveys;

use App\Actions\Retros\GuestCookie;
use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\Request;

class ResolveRespondent
{
    /**
     * A standalone survey only: an attached health check lives in its retro
     * (spec §6.3), and the middleware sends its visitors there first. A draft
     * makes no new respondent but for a workspace manager: its facilitator
     * already has one, and anyone else is refused, so none is left behind.
     */
    public function handle(Request $request, TeamSurvey $survey): ?TeamSurveyRespondent
    {
        if ($survey->retro_id !== null) {
            return null;
        }

        $user = $request->user();

        if ($user !== null && $user->can('view', $survey->team)) {
            if ($survey->status === TeamSurveyStatus::Draft && ! $user->canManage($survey->team->workspace)) {
                return $survey->respondents()->where('user_id', $user->id)->first();
            }

            return TeamSurveyRespondent::query()->firstOrCreate([
                'team_survey_id' => $survey->id,
                'user_id' => $user->id,
            ]);
        }

        if ($survey->status === TeamSurveyStatus::Draft) {
            return null;
        }

        return $this->guest($request, $survey);
    }

    private function guest(Request $request, TeamSurvey $survey): ?TeamSurveyRespondent
    {
        return $survey->guest_access_enabled
            ? GuestCookie::findGuest($survey->respondents(), $request, GuestCookie::SurveyScope, $survey->id)
            : null;
    }
}
