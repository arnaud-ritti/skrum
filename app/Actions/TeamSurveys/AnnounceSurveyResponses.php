<?php

namespace App\Actions\TeamSurveys;

use App\Events\TeamSurveys\TeamSurveyResponsesChanged;
use App\Models\TeamSurvey;

class AnnounceSurveyResponses
{
    public function handle(TeamSurvey $survey): void
    {
        TeamSurveyResponsesChanged::for($survey)->sendToOthers();
    }
}
