<?php

namespace App\Support\Integrations\Exceptions;

/**
 * A Jira connection made before assignee mapping existed lacks the
 * read:jira-user scope; reconnecting grants it.
 */
class AssigneeMappingUnavailable extends IntegrationException
{
    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('Reconnect :provider to enable assignee mapping.', ['provider' => $this->provider->label()]);
    }
}
