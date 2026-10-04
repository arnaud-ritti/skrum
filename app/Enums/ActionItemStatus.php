<?php

namespace App\Enums;

enum ActionItemStatus: string
{
    case Open = 'open';
    case Doing = 'doing';
    case Completed = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::Open => __('To do'),
            self::Doing => __('In progress'),
            self::Completed => __('Done status'),
        };
    }
}
