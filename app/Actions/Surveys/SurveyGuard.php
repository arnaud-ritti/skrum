<?php

namespace App\Actions\Surveys;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

class SurveyGuard
{
    public static function activePhase(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing);
    }

    public static function open(Survey $survey): void
    {
        if (! $survey->is_closed) {
            return;
        }

        throw ValidationException::withMessages(['survey' => __('This survey is closed.')]);
    }

    public static function unanswered(Survey $survey): void
    {
        if (! $survey->responses()->exists() && ! $survey->textAnswers()->exists()) {
            return;
        }

        throw ValidationException::withMessages(['survey' => __('This survey already has answers.')]);
    }

    public static function namesAllowed(Retro $retro, bool $showVoters): void
    {
        if (! $showVoters || ! $retro->is_anonymous) {
            return;
        }

        throw ValidationException::withMessages(['show_voters' => __('Names are never shown on anonymous retros.')]);
    }

    public static function resultsVisible(Survey $survey, Participant $participant): void
    {
        if ($survey->isVisibleTo($participant)) {
            return;
        }

        throw new AuthorizationException(__('Answer the survey to join the discussion.'));
    }
}
