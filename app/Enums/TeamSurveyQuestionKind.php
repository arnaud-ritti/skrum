<?php

namespace App\Enums;

enum TeamSurveyQuestionKind: string
{
    case Scale = 'scale';
    case Nps = 'nps';
    case Single = 'single';
    case Multiple = 'multiple';
    case Text = 'text';

    public function isChoice(): bool
    {
        return in_array($this, [self::Single, self::Multiple], true);
    }

    public function isNumeric(): bool
    {
        return in_array($this, [self::Scale, self::Nps], true);
    }
}
