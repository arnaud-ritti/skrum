<?php

namespace App\Actions\HealthCheck;

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Retro;
use App\Models\TeamSurvey;
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
