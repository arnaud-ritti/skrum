<?php

namespace App\Events\TeamSurveys;

use App\Models\TeamSurvey;

class TeamSurveyChanged extends TeamSurveyBroadcastEvent
{
    public function __construct(string $surveyId, public int $version, public string $status)
    {
        parent::__construct($surveyId);
    }

    public static function for(TeamSurvey $survey): self
    {
        return new self($survey->id, $survey->version, $survey->status->value);
    }

    public function broadcastAs(): string
    {
        return 'survey.changed';
    }

    public function broadcastWith(): array
    {
        return ['version' => $this->version, 'status' => $this->status];
    }
}
