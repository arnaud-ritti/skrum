<?php

namespace App\Enums;

enum InboundEventStatus: string
{
    case Applied = 'applied';
    case Ignored = 'ignored';
    case Rejected = 'rejected';
    case Failed = 'failed';
}
