<?php

namespace App\Enums;

enum GameWordTheme: string
{
    case Work = 'work';
    case Objects = 'objects';
    case Food = 'food';
    case Nature = 'nature';

    public function label(): string
    {
        return match ($this) {
            self::Work => __('Team & tech'),
            self::Objects => __('Everyday objects'),
            self::Food => __('Food'),
            self::Nature => __('Nature & animals'),
        };
    }
}
