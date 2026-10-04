<?php

namespace App\Actions\Integrations;

use App\Models\ActionItemExternalLink;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\IssueStatus;
use Illuminate\Contracts\Database\Query\Builder as QueryBuilder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Spec 8 §5.4: a connection follows the links of its team's items that are
 * open or were completed within 90 days, and the imported tasks of its
 * team's games that are not ended — on its own site only.
 */
class TrackedIssues
{
    public const RecentlyCompletedDays = 90;

    public const ContainerKeyPattern = IssueStatus::ContainerKeyPattern;

    private const string IssueKeyPattern = '/^([A-Z][A-Z0-9_]{0,49})-\d+\z/';

    private const string RepositoryIdPattern = '/^\d{1,20}\z/';

    /**
     * @return Builder<ActionItemExternalLink>
     */
    public function links(TeamIntegration $integration): Builder
    {
        $site = $integration->site();

        return ActionItemExternalLink::query()
            ->when($site === null, fn (Builder $none) => $none->whereKey([]))
            ->where('source', $integration->provider->value)
            ->where('external_site', (string) $site)
            ->where('external_id', '!=', '')
            ->whereHas('actionItem', fn (QueryBuilder $items) => $items
                ->where('team_id', $integration->team_id)
                ->where(fn (QueryBuilder $state) => $state
                    ->whereNull('completed_at')
                    ->orWhere('completed_at', '>=', now()->subDays(self::RecentlyCompletedDays))));
    }

    /**
     * @return Builder<PokerTask>
     */
    public function tasks(TeamIntegration $integration): Builder
    {
        $site = $integration->site();

        return PokerTask::query()
            ->when($site === null, fn (Builder $none) => $none->whereKey([]))
            ->where('external_source', $integration->provider->value)
            ->where('external_site', (string) $site)
            ->whereNotNull('external_id')
            ->whereHas('game', fn (QueryBuilder $games) => $games
                ->where('team_id', $integration->team_id)
                ->whereNull('ended_at'));
    }

    /**
     * @return array<int, string>
     */
    public function ids(TeamIntegration $integration): array
    {
        return $this->externalIds($integration);
    }

    /**
     * The given ids that the connection tracks.
     *
     * @param  array<int, string>  $externalIds
     * @return array<int, string>
     */
    public function among(TeamIntegration $integration, array $externalIds): array
    {
        return $externalIds === [] ? [] : $this->externalIds($integration, array_map(strval(...), $externalIds));
    }

    /**
     * Tracked GitHub issues (`{repositoryId}/{number}`) of these repositories.
     *
     * @param  array<int, string>  $repositoryIds
     * @return array<int, string>
     */
    public function inRepositories(TeamIntegration $integration, array $repositoryIds): array
    {
        $valid = array_values(array_filter($repositoryIds, fn (string $id): bool => preg_match(self::RepositoryIdPattern, $id) === 1));

        return $valid === [] ? [] : $this->externalIds($integration, null, $valid);
    }

    /**
     * Jira project keys or Linear team keys of the tracked issues, from
     * their keys (`PROJ-12` → `PROJ`).
     *
     * @return array<int, string>
     */
    public function containerKeys(TeamIntegration $integration): array
    {
        $keys = [];

        foreach ([$this->links($integration), $this->tasks($integration)] as $query) {
            foreach ($query->pluck('external_key') as $key) {
                if (is_string($key) && preg_match(self::IssueKeyPattern, $key, $match) === 1) {
                    $keys[$match[1]] = true;
                }
            }
        }

        $keys = array_map(strval(...), array_keys($keys));
        sort($keys);

        return $keys;
    }

    /**
     * @param  array<int, string>|null  $ids
     * @param  array<int, string>  $repositoryIds
     * @return array<int, string>
     */
    private function externalIds(TeamIntegration $integration, ?array $ids = null, array $repositoryIds = []): array
    {
        $found = [];
        $prefixes = array_map(fn (string $repositoryId): string => "{$repositoryId}/", $repositoryIds);

        foreach ([$this->links($integration), $this->tasks($integration)] as $query) {
            if ($ids !== null) {
                $query->whereIn('external_id', $ids);
            }

            foreach ($query->pluck('external_id') as $id) {
                if (! is_string($id) || $id === '') {
                    continue;
                }

                if ($prefixes !== [] && ! Str::startsWith($id, $prefixes)) {
                    continue;
                }

                $found[$id] = true;
            }
        }

        return array_map(strval(...), array_keys($found));
    }
}
