<?php

namespace App\Events\Retros;

class SurveyDeleted extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $surveyId)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'survey.deleted';
    }

    public function broadcastWith(): array
    {
        return ['surveyId' => $this->surveyId];
    }
}
