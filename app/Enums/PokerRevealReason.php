<?php

namespace App\Enums;

enum PokerRevealReason: string
{
    case Manual = 'manual';
    case EveryoneVoted = 'everyone_voted';
    case Timer = 'timer';
}
