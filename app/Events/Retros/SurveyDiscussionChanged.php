<?php

namespace App\Events\Retros;

class SurveyDiscussionChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $surveyId, public int $commentCount)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'survey.discussion.changed';
    }

    public function broadcastWith(): array
    {
        return ['surveyId' => $this->surveyId, 'commentCount' => $this->commentCount];
    }
}
