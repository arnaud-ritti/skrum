<?php

namespace App\Enums;

enum TeamSurveyStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Closed = 'closed';

}
