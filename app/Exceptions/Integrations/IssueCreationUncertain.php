<?php

namespace App\Exceptions\Integrations;

/**
 * The create request left skrum but no answer came back: the issue may
 * exist, so the user must check before exporting again.
 */
class IssueCreationUncertain extends IntegrationException
{
    public function status(): int
    {
        return 502;
    }

    public function userMessage(): string
    {
        return __('The issue may have been created. Check :source before trying again.', ['source' => $this->provider->label()]);
    }
}
