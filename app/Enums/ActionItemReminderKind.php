<?php

namespace App\Enums;

enum ActionItemReminderKind: string
{
    case DueSoon = 'due_soon';
    case Overdue = 'overdue';
}
