<?php

namespace App\Enums;

enum GuessResult: string
{
    case Wrong = 'wrong';
    case Near = 'near';
    case Correct = 'correct';
}
