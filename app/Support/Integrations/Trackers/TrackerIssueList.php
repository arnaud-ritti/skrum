<?php

namespace App\Support\Integrations\Trackers;

class TrackerIssueList
{
    /**
     * @param  array<int, TrackerIssue>  $issues
     */
    public function __construct(public array $issues, public bool $truncated) {}
}
