<?php

namespace App\Exceptions\Integrations;

use App\Enums\ExternalIssueState;
use App\Enums\IntegrationProvider;

/**
 * The source cannot take the status change skrum asks for (spec 8 §5.2);
 * retrying would not help, so the push fails with this reason.
 */
class StatusPushRejected extends IntegrationException
{
    public static function unavailable(IntegrationProvider $provider, string $key, ExternalIssueState $target): self
    {
        return new self($provider, match ($target) {
            ExternalIssueState::Done => __('No transition to a done status is available for :key.', ['key' => $key]),
            ExternalIssueState::Started => __('No transition to an in-progress status is available for :key.', ['key' => $key]),
            ExternalIssueState::Open => __('No transition to an open status is available for :key.', ['key' => $key]),
        });
    }

    public function status(): int
    {
        return 422;
    }

    public function userMessage(): string
    {
        return $this->detail() ?? __(':provider refused the request.', ['provider' => $this->provider->label()]);
    }
}
