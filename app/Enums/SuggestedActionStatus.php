<?php

namespace App\Enums;

enum SuggestedActionStatus: string
{
    case Pending = 'pending';
    case Promoted = 'promoted';
    case Rejected = 'rejected';
}
