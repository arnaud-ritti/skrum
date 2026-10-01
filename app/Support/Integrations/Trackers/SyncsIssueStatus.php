<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\ExternalIssueState;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\StatusPushRejected;
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

    /**
     * Moves the issue to open or done (spec 8 §5.2) unless it is there
     * already, and returns it as the source now has it; null when the
     * source no longer has the issue, unchanged (without a status) when
     * its status cannot be read.
     *
     * @throws StatusPushRejected when no transition or state can be used
     */
    public function transition(TeamIntegration $integration, string $externalId, ExternalIssueState $target): ?TrackerIssue;
}
