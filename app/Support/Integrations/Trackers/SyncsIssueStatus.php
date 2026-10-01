<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;
use Carbon\CarbonImmutable;

/**
 * The status sync surface of a tracker (spec 8 §5): incremental reads for
 * polling and the statuses a mapping can choose from.
 */
interface SyncsIssueStatus
{
    /**
     * Tracked issues updated since `$since`; issues the source did not
     * return are unchanged, not missing.
     *
     * @param  array<int, string>  $externalIds
     * @return array<string, TrackerIssue>
     */
    public function changedIssues(TeamIntegration $integration, array $externalIds, CarbonImmutable $since): array;

    /**
     * @return array<int, array{id: string, name: string, category: string}>
     */
    public function statuses(TeamIntegration $integration, string $container): array;
}
