<?php

namespace App\Enums;

enum SurveyKind: string
{
    case Single = 'single';
    case Multiple = 'multiple';
    case Text = 'text';

    public function isChoice(): bool
    {
        return $this !== self::Text;
    }
}
