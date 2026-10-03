<?php

namespace App\Enums;

enum TeamAccessRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Declined = 'declined';
}
