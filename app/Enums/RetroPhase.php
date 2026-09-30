<?php

namespace App\Enums;

enum RetroPhase: string
{
    case HealthCheck = 'health_check';
    case Icebreaker = 'icebreaker';
    case Writing = 'writing';
    case Grouping = 'grouping';
    case Voting = 'voting';
    case Discussing = 'discussing';
    case Completed = 'completed';

    public function isOpen(): bool
    {
        return $this !== self::Completed;
    }

    public function hidesOthersCards(): bool
    {
        return in_array($this, [self::HealthCheck, self::Icebreaker, self::Writing], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::HealthCheck => __('Health check'),
            self::Icebreaker => __('Icebreaker'),
            self::Writing => __('Writing'),
            self::Grouping => __('Grouping'),
            self::Voting => __('Voting'),
            self::Discussing => __('Discussing'),
            self::Completed => __('Completed'),
        };
    }
}
