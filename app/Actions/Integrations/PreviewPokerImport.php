<?php

namespace App\Actions\Integrations;

use App\Models\PokerGame;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\TrackerIssue;
use App\Support\Integrations\Trackers\TrackerIssueList;
use App\Support\Integrations\Trackers\Trackers;

class PreviewPokerImport
{
    public const ModeIteration = 'iteration';

    public const ModeQuery = 'query';

    public function __construct(private Trackers $trackers) {}

    public function fetch(TeamIntegration $integration, string $mode, ?string $iterationId, ?string $query, ?string $containerId = null, ?string $search = null, ?string $statusId = null, ?string $cursor = null, bool $browse = false, ?string $projectId = null): TrackerIssueList
    {
        $tracker = $this->trackers->for($integration->provider);

        if ($browse) {
            return $tracker->browse($integration, $mode, $iterationId, $query, $containerId, $search, $statusId, $cursor, $projectId);
        }

        return $mode === self::ModeIteration
            ? $tracker->iterationIssues($integration, (string) $iterationId)
            : $tracker->search($integration, (string) $query, $containerId);
    }

    /**
     * @return array{
     *     issues: array<int, array{externalId: string, key: string, title: string, assignee: ?string, estimate: ?string, status: ?string, alreadyImported: bool}>,
     *     truncated: bool,
     *     nextCursor?: ?string,
     *     statuses?: array<int, array{id: string, name: string}>
     * }
     */
    public function handle(PokerGame $game, TeamIntegration $integration, string $mode, ?string $iterationId, ?string $query, ?string $containerId = null, ?string $search = null, ?string $statusId = null, ?string $cursor = null, bool $browse = false, ?string $projectId = null): array
    {
        $list = $this->fetch($integration, $mode, $iterationId, $query, $containerId, $search, $statusId, $cursor, $browse, $projectId);

        $imported = $game->tasks()
            ->where('external_source', $integration->provider->value)
            ->whereIn('external_id', array_map(fn (TrackerIssue $issue): string => $issue->externalId, $list->issues))
            ->pluck('external_id')
            ->flip();

        return [
            'issues' => array_map(fn (TrackerIssue $issue): array => $issue->preview($imported->has($issue->externalId)), $list->issues),
            'truncated' => $list->truncated,
            ...($list->statuses !== null ? ['nextCursor' => $list->nextCursor, 'statuses' => $list->statuses] : []),
        ];
    }
}
