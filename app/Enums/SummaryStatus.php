<?php

namespace App\Enums;

enum SummaryStatus: string
{
    case Pending = 'pending';
    case Ready = 'ready';
    case Failed = 'failed';
}
