<?php

namespace App\Actions\Integrations;

use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\JiraIssueTracker;
use App\Support\Integrations\Trackers\Trackers;

class ListPokerIterations
{
    public function __construct(private Trackers $trackers) {}

    /**
     * @return array{containers: array<int, array{id: string, name: string}>, hasMore: bool}
     */
    public function containers(TeamIntegration $integration, ?string $query = null, int $page = 1, bool $projects = false): array
    {
        $tracker = $this->trackers->for($integration->provider);

        return $projects && $tracker instanceof JiraIssueTracker
            ? $tracker->projects($integration, $query, $page)
            : $tracker->containers($integration, $query, $page);
    }

    /**
     * @return array<int, array{id: string, name: string, state: 'active'|'upcoming', startsOn: ?string, endsOn: ?string}>
     */
    public function iterations(TeamIntegration $integration, string $containerId): array
    {
        return $this->trackers->for($integration->provider)->iterations($integration, $containerId);
    }

    /**
     * The MCP `poker.iterations.list` shape (spec 5 §6.2).
     *
     * @return array{
     *     containers: array<int, array{id: string, name: string}>|null,
     *     iterations: array<int, array{id: string, name: string, state: 'active'|'upcoming', startsOn: ?string, endsOn: ?string}>
     * }
     */
    public function handle(TeamIntegration $integration, ?string $containerId): array
    {
        if ($containerId === null) {
            return ['containers' => $this->containers($integration)['containers'], 'iterations' => []];
        }

        return ['containers' => null, 'iterations' => $this->iterations($integration, $containerId)];
    }
}
