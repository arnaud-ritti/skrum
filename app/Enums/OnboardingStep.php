<?php

namespace App\Enums;

enum OnboardingStep: string
{
    case Workspace = 'workspace';
    case Team = 'team';
    case Invite = 'invite';
    case Ritual = 'ritual';

    public function number(): int
    {
        return match ($this) {
            self::Workspace => 1,
            self::Team => 2,
            self::Invite => 3,
            self::Ritual => 4,
        };
    }
}
