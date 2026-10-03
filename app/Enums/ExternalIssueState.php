<?php

namespace App\Enums;

/**
 * An issue's state for the status sync (spec 8 §5, spec 24 §6.2). `Started` only exists for
 * trackers with an in-progress category (DoneMapping::tracksStart). Stored in `string(10)` columns.
 */
enum ExternalIssueState: string
{
    case Open = 'open';
    case Started = 'started';
    case Done = 'done';
}
