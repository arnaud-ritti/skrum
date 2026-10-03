<?php

namespace App\Events\TeamSurveys;

use App\Models\TeamSurvey;

class TeamSurveyResponsesChanged extends TeamSurveyBroadcastEvent
{
    public function __construct(string $surveyId, public int $responses, public int $completed, public int $audience)
    {
        parent::__construct($surveyId);
    }

    public static function for(TeamSurvey $survey): self
    {
        return new self($survey->id, $survey->responseCount(), $survey->completedCount(), $survey->audienceCount());
    }

    public function broadcastAs(): string
    {
        return 'survey.responses.changed';
    }

    public function broadcastWith(): array
    {
        return ['responses' => $this->responses, 'completed' => $this->completed, 'audience' => $this->audience];
    }
}
