<?php

namespace App\Enums;

enum ExternalStatusCategory: string
{
    case Todo = 'todo';
    case InProgress = 'in_progress';
    case Done = 'done';
}
