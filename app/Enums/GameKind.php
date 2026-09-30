<?php

namespace App\Enums;

enum GameKind: string
{
    case DrawAndGuess = 'draw';
    case SprintGif = 'gif';
    case Hangman = 'hangman';
    case Decoded = 'decoded';

    public function label(): string
    {
        return match ($this) {
            self::DrawAndGuess => __('Draw & Guess'),
            self::SprintGif => __('Sprint in one GIF'),
            self::Hangman => __('Hangman'),
            self::Decoded => __('Decoded'),
        };
    }
}
