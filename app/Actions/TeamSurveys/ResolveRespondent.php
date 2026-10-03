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
     * (spec §6.3), and the middleware sends its visitors there first.
     */
    public function handle(Request $request, TeamSurvey $survey): ?TeamSurveyRespondent
    {
        if ($survey->retro_id !== null) {
            return null;
        }

        $user = $request->user();

        if ($user !== null && $user->can('view', $survey->team)) {
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
        if (! $survey->guest_access_enabled) {
            return null;
        }

        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name(GuestCookie::SurveyScope, $survey->id)));

        if ($credentials === null) {
            return null;
        }

        [$respondentId, $secret] = $credentials;

        $respondent = $survey->respondents()
            ->whereKey($respondentId)
            ->whereNull('user_id')
            ->whereNotNull('guest_secret_hash')
            ->first();

        if ($respondent === null) {
            return null;
        }

        if (! hash_equals((string) $respondent->guest_secret_hash, hash('sha256', $secret))) {
            return null;
        }

        return $respondent;
    }
}
