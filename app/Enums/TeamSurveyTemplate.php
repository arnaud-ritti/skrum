<?php

namespace App\Enums;

enum TeamSurveyTemplate: string
{
    case HealthCheck = 'health_check';
    case TeamPulse = 'team_pulse';
    case Enps = 'enps';

    public function hasLockedQuestions(): bool
    {
        return $this === self::HealthCheck;
    }
}
