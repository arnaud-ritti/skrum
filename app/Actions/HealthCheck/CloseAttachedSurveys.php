<?php

namespace App\Actions\HealthCheck;

use App\Enums\TeamSurveyStatus;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\Retro;
use App\Models\TeamSurvey;

class CloseAttachedSurveys
{
    /**
     * Closed at the retro's completion time, so that the retro's own
     * health check is never "after" it in a trend.
     */
    public function handle(Retro $locked): void
    {
        $open = TeamSurvey::query()->where('retro_id', $locked->id)->where('status', TeamSurveyStatus::Open)->orderBy('id')->get();

        foreach ($open as $survey) {
            $survey->update([
                'status' => TeamSurveyStatus::Closed,
                'closed_at' => $locked->completed_at ?? now(),
                'version' => $survey->version + 1,
            ]);

            TeamSurveyChanged::for($survey)->sendToOthers();
        }
    }
}
