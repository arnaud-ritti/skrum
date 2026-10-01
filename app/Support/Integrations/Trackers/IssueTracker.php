<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;

/**
 * One implementation per issue tracker. Every call goes through the
 * provider client of the connection, so token refresh, reconnect states and
 * error mapping are the client's (Plan 12a).
 */
interface IssueTracker
{
    public const PreviewLimit = 100;

    public const ContainerPageSize = 50;

    /**
     * @return array{containers: array<int, array{id: string, name: string}>, hasMore: bool}
     */
    public function containers(TeamIntegration $integration, ?string $query, int $page): array;

    /**
     * @return array<int, array{id: string, name: string, state: 'active'|'upcoming', startsOn: ?string, endsOn: ?string}>
     */
    public function iterations(TeamIntegration $integration, string $containerId): array;

    public function iterationIssues(TeamIntegration $integration, string $iterationId): TrackerIssueList;

    /**
     * `$containerId` scopes the search where the source needs it (GitHub
     * searches one repository).
     */
    public function search(TeamIntegration $integration, string $query, ?string $containerId = null): TrackerIssueList;

    /**
     * @param  array<int, string>  $externalIds
     * @return array<string, TrackerIssue>
     */
    public function issues(TeamIntegration $integration, array $externalIds): array;

    /**
     * @throws EstimateRejected when the source cannot hold this estimate
     */
    public function writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate): void;
}
