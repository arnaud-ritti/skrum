<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\ActionItemStatus;
use App\Enums\ExternalIssueState;
use App\Enums\ExternalStatusCategory;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\TeamIntegration;

/**
 * Spec 8 §5.2, spec 24 §6.2: when an issue counts as done or started, and
 * which poker category its status belongs to. Mapping settings are keyed by Jira project key and
 * Linear team key.
 */
class DoneMapping
{
    public static function state(TeamIntegration $integration, IssueStatus $status): ExternalIssueState
    {
        $done = match ($integration->provider) {
            IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter => self::jiraDone($integration, $status),
            IntegrationProvider::Linear => $status->kind === 'completed'
                || ($status->kind === 'canceled' && self::treatsCanceledAsDone($integration)),
            IntegrationProvider::GitHub => $status->kind === IssueStatus::GitHubCompleted
                || ($status->kind === IssueStatus::GitHubNotPlanned && self::treatsCanceledAsDone($integration)),
            default => false,
        };

        if ($done) {
            return ExternalIssueState::Done;
        }

        if (self::tracksStart($integration->provider) && self::category($integration->provider, $status->kind) === ExternalStatusCategory::InProgress) {
            return ExternalIssueState::Started;
        }

        return ExternalIssueState::Open;
    }

    public static function category(IntegrationProvider $provider, string $kind): ExternalStatusCategory
    {
        return match ($provider) {
            IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter => match ($kind) {
                'done' => ExternalStatusCategory::Done,
                'indeterminate' => ExternalStatusCategory::InProgress,
                default => ExternalStatusCategory::Todo,
            },
            IntegrationProvider::Linear => match ($kind) {
                'started' => ExternalStatusCategory::InProgress,
                'completed', 'canceled' => ExternalStatusCategory::Done,
                default => ExternalStatusCategory::Todo,
            },
            IntegrationProvider::GitHub => $kind === IssueStatus::GitHubOpen ? ExternalStatusCategory::Todo : ExternalStatusCategory::Done,
            default => ExternalStatusCategory::Todo,
        };
    }

    /**
     * Spec 24 §6.2: Jira and Linear have an in-progress category, synced both ways; GitHub has none.
     */
    public static function tracksStart(IntegrationProvider $provider): bool
    {
        return in_array($provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter, IntegrationProvider::Linear], true);
    }

    /**
     * What an item is for a link of this provider: a started item is open where the
     * provider has no start.
     */
    public static function itemState(ActionItem $item, IntegrationProvider $provider): ExternalIssueState
    {
        return match ($item->currentStatus()) {
            ActionItemStatus::Completed => ExternalIssueState::Done,
            ActionItemStatus::Doing => self::tracksStart($provider) ? ExternalIssueState::Started : ExternalIssueState::Open,
            ActionItemStatus::Open => ExternalIssueState::Open,
        };
    }

    public static function treatsCanceledAsDone(TeamIntegration $integration): bool
    {
        return $integration->setting('treatCanceledAsDone', true) !== false;
    }

    /**
     * @return array<int, string>|null null when every status of the done category counts
     */
    public static function doneStatusIds(TeamIntegration $integration, ?string $project): ?array
    {
        if ($project === null) {
            return null;
        }

        $ids = data_get($integration->settings, ['statusMapping', 'projects', $project, 'doneStatusIds']);

        $ids = is_array($ids) ? array_values(array_map(strval(...), array_filter($ids, is_scalar(...)))) : [];

        return $ids === [] ? null : $ids;
    }

    /**
     * A configured target (`completeStatusId`, `startStatusId`,
     * `reopenStatusId`, `completeStateId`, `startStateId`, `reopenStateId`)
     * of a project or team.
     */
    public static function configured(TeamIntegration $integration, ?string $container, string $key): ?string
    {
        if ($container === null) {
            return null;
        }

        $group = in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true) ? 'projects' : 'teams';
        $value = data_get($integration->settings, ['statusMapping', $group, $container, $key]);

        return is_string($value) && $value !== '' ? $value : null;
    }

    private static function jiraDone(TeamIntegration $integration, IssueStatus $status): bool
    {
        if ($status->kind !== 'done') {
            return false;
        }

        $doneIds = self::doneStatusIds($integration, $status->container);

        return $doneIds === null || in_array($status->id, $doneIds, true);
    }
}
