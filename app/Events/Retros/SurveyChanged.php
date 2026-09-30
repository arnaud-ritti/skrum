<?php

namespace App\Events\Retros;

use App\Models\Survey;

class SurveyChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $surveyId, public int $version, public int $responseCount)
    {
        parent::__construct($retroId);
    }

    public static function for(Survey $survey): self
    {
        return new self($survey->retro_id, $survey->id, $survey->version, $survey->responseCount());
    }

    public function broadcastAs(): string
    {
        return 'survey.changed';
    }

    public function broadcastWith(): array
    {
        return ['surveyId' => $this->surveyId, 'version' => $this->version, 'responseCount' => $this->responseCount];
    }
}
