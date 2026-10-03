<?php

namespace App\Actions\HealthCheck;

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use Illuminate\Database\Eloquent\Builder;

class HealthCheckSurvey
{
    public function forRetro(Retro $retro): ?TeamSurvey
    {
        return $this->query($retro)->where('status', '!=', TeamSurveyStatus::Draft)->first();
    }

    /**
     * A health check that was removed: kept, with its answers, as a draft.
     */
    public function hidden(Retro $retro): ?TeamSurvey
    {
        return $this->query($retro)->where('status', TeamSurveyStatus::Draft)->first();
    }

    /**
     * Whether anyone answered a health check of the retro, a removed one included.
     */
    public function hasAnyAnswers(Retro $retro): bool
    {
        return TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', TeamSurveyQuestion::query()
                ->whereIn('team_survey_id', $this->query($retro)->reorder()->select('id'))
                ->select('id'))
            ->exists();
    }

    /** @return Builder<TeamSurvey> */
    private function query(Retro $retro): Builder
    {
        return TeamSurvey::query()
            ->where('retro_id', $retro->id)
            ->where('template', TeamSurveyTemplate::HealthCheck)
            ->oldest()
            ->orderBy('id');
    }
}
