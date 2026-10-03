<?php

namespace App\Enums;

enum SessionState: string
{
    case Upcoming = 'upcoming';
    case Live = 'live';
    case Finished = 'finished';
}
