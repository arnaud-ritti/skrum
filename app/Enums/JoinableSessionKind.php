<?php

namespace App\Enums;

enum JoinableSessionKind: string
{
    case Retro = 'retro';
    case Poker = 'poker';
    case Whiteboard = 'whiteboard';
    case Survey = 'survey';
    case Game = 'game';
}
