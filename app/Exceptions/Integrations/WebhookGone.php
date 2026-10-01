<?php

namespace App\Exceptions\Integrations;

use App\Enums\IntegrationProvider;

/**
 * A 410 from the receiver: skrum stops at once (spec 8 §4.5).
 */
class WebhookGone extends ReconnectRequired
{
    public function __construct()
    {
        parent::__construct(IntegrationProvider::Webhook, __('The receiver asked skrum to stop.'));
    }

    public function userMessage(): string
    {
        return __('The receiver asked skrum to stop.');
    }
}
