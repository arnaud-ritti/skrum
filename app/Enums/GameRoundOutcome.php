<?php

namespace App\Enums;

enum GameRoundOutcome: string
{
    case Guessed = 'guessed';
    case Solved = 'solved';
    case Lost = 'lost';
    case TimedOut = 'timed_out';
    case Passed = 'passed';
    case Revealed = 'revealed';
    case Abandoned = 'abandoned';
}
