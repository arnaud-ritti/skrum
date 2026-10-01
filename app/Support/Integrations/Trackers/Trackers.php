<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\IntegrationProvider;
use InvalidArgumentException;

class Trackers
{
    public function for(IntegrationProvider $provider): IssueTracker
    {
        return match ($provider) {
            IntegrationProvider::Jira => resolve(JiraTracker::class),
            IntegrationProvider::Linear => resolve(LinearTracker::class),
            IntegrationProvider::JiraDataCenter => resolve(JiraDataCenterTracker::class),
            IntegrationProvider::GitHub => resolve(GitHubTracker::class),
            default => throw new InvalidArgumentException("{$provider->value} is not an issue tracker."),
        };
    }

    public function syncing(IntegrationProvider $provider): SyncsIssueStatus
    {
        $tracker = $this->for($provider);

        if (! $tracker instanceof SyncsIssueStatus) {
            throw new InvalidArgumentException("{$provider->value} cannot sync statuses.");
        }

        return $tracker;
    }
}
