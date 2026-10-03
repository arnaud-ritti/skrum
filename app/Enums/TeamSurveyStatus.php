<?php

namespace App\Enums;

enum TeamSurveyStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Draft => __('Draft'),
            self::Open => __('Open'),
            self::Closed => __('Closed'),
        };
    }
}
