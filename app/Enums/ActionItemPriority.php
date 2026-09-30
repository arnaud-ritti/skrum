<?php

namespace App\Enums;

enum ActionItemPriority: string
{
    case High = 'high';
    case Medium = 'medium';
    case Low = 'low';

    public function sortWeight(): int
    {
        return match ($this) {
            self::High => 0,
            self::Medium => 1,
            self::Low => 2,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::High => __('High'),
            self::Medium => __('Medium'),
            self::Low => __('Low'),
        };
    }
}
