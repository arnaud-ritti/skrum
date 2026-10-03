<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

class TeamSurveyGuard
{
    public static function editor(TeamSurvey $survey, TeamSurveyRespondent $respondent): void
    {
        if ($survey->isEditor($respondent)) {
            return;
        }

        throw new AuthorizationException(__('Only the survey\'s facilitator or a workspace admin can do this.'));
    }

    public static function notGuest(TeamSurveyRespondent $respondent): void
    {
        if (! $respondent->isGuest()) {
            return;
        }

        throw new AuthorizationException(__('Guests cannot do this.'));
    }

    public static function viewable(TeamSurvey $survey, TeamSurveyRespondent $respondent): void
    {
        if ($survey->status !== TeamSurveyStatus::Draft) {
            return;
        }

        self::editor($survey, $respondent);
    }

    public static function structureEditable(TeamSurvey $survey): void
    {
        if ($survey->status !== TeamSurveyStatus::Draft) {
            throw ValidationException::withMessages(['survey' => __('Questions can only change while the survey is a draft.')]);
        }

        if ($survey->hasLockedQuestions()) {
            throw ValidationException::withMessages(['survey' => __('The questions of a health check come from the team\'s statements.')]);
        }
    }

    public static function open(TeamSurvey $survey): void
    {
        if ($survey->status === TeamSurveyStatus::Open) {
            return;
        }

        throw ValidationException::withMessages(['survey' => __('This survey is not open.')]);
    }
}
