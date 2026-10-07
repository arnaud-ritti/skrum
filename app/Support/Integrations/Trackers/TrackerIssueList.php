<?php

namespace App\Support\Integrations\Trackers;

class TrackerIssueList
{
    /**
     * @param  array<int, TrackerIssue>  $issues
     * @param  array<int, array{id: string, name: string}>|null  $statuses
     */
    public function __construct(public array $issues, public bool $truncated, public ?string $nextCursor = null, public ?array $statuses = null) {}
}
