<?php

namespace App\Actions\TeamSurveys;

use App\Models\TeamSurvey;

class PresentSurveyProgress
{
    /**
     * @return array{responses: int, completed: int, audience: int}
     */
    public function handle(TeamSurvey $survey): array
    {
        return [
            'responses' => $survey->responseCount(),
            'completed' => $survey->completedCount(),
            'audience' => $survey->audienceCount(),
        ];
    }
}
