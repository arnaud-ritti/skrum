<?php

namespace App\Events\Integrations;

use App\Models\TeamIntegration;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A Jira or Linear connection became active with write access (connect,
 * upgrade, reconnect or site choice).
 */
class IntegrationActivated implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public TeamIntegration $integration, public bool $siteChanged) {}
}
