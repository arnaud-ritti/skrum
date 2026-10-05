<?php

namespace App\Events\TeamSurveys;

use App\Events\BroadcastEvent;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PresenceChannel;

abstract class TeamSurveyBroadcastEvent extends BroadcastEvent
{
    public function __construct(public string $surveyId) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel("survey.{$this->surveyId}");
    }
}
