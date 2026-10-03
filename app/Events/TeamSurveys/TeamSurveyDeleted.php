<?php

namespace App\Events\TeamSurveys;

class TeamSurveyDeleted extends TeamSurveyBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'survey.deleted';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
