<?php

namespace App\Enums;

enum GameKind: string
{
    case DrawAndGuess = 'draw';
    case SprintGif = 'gif';
    case Hangman = 'hangman';
    case Decoded = 'decoded';
    case TwoTruths = 'two_truths';
    case MoodWeather = 'mood';
    case GuessWho = 'guess_who';
    case QuickQuestion = 'quick_question';

    public function label(): string
    {
        return match ($this) {
            self::DrawAndGuess => __('Draw & Guess'),
            self::SprintGif => __('Sprint in one GIF'),
            self::Hangman => __('Hangman'),
            self::Decoded => __('Decoded'),
            self::TwoTruths => __('Two truths and a lie'),
            self::MoodWeather => __('Mood weather'),
            self::GuessWho => __('Guess who?'),
            self::QuickQuestion => __('Quick question'),
        };
    }
}
