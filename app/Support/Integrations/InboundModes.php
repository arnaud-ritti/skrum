<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Models\TeamIntegration;

/**
 * Spec 8 §2.3: a synced connection listens to webhooks when this instance
 * is reachable and the provider's inbound channel is set up, and polls
 * otherwise.
 */
class InboundModes
{
    public const JiraWebhookScope = 'manage:jira-webhook';

    public const HintReconnect = 'reconnect';

    public const HintManual = 'manual';

    private bool $publicityKnown = false;

    private ?bool $publicity = null;

    public function __construct(private InboundReachability $reachability) {}

    public function for(TeamIntegration $integration): IntegrationInboundMode
    {
        if (! StatusSync::isOn($integration)) {
            return IntegrationInboundMode::Off;
        }

        return $this->webhooksReach($integration) ? IntegrationInboundMode::Webhook : IntegrationInboundMode::Polling;
    }

    /**
     * Whether this instance can receive this provider's webhooks at all;
     * the inbound routes answer 404 otherwise.
     */
    public function acceptsWebhooks(IntegrationProvider $provider): bool
    {
        if (! $provider->isEnabled() || $this->publicity() !== true) {
            return false;
        }

        return match ($provider) {
            IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter => true,
            IntegrationProvider::Linear => (string) config('services.linear.webhook_secret') !== '',
            IntegrationProvider::GitHub => (string) config('services.github_app.webhook_secret') !== '',
            default => false,
        };
    }

    /**
     * While this instance's address cannot be resolved the current mode is
     * kept, so a DNS hiccup does not flip every connection to polling.
     */
    public function refresh(TeamIntegration $integration): TeamIntegration
    {
        $mode = $this->for($integration);

        if ($mode !== IntegrationInboundMode::Off && $integration->inbound_mode !== IntegrationInboundMode::Off && $this->publicity() === null) {
            return $integration;
        }

        if ($integration->inbound_mode !== $mode) {
            $integration->forceFill(['inbound_mode' => $mode])->save();
        }

        return $integration;
    }

    /**
     * Why live updates are not flowing although the instance could get
     * them: the Jira Cloud connection predates the webhook scope, or a Jira
     * Data Center administrator has to register the webhook.
     */
    public function hint(TeamIntegration $integration): ?string
    {
        if (! StatusSync::isOn($integration) || ! $this->acceptsWebhooks($integration->provider)) {
            return null;
        }

        if ($integration->provider === IntegrationProvider::Jira && ! $integration->hasScope(self::JiraWebhookScope)) {
            return self::HintReconnect;
        }

        if ($integration->provider === IntegrationProvider::JiraDataCenter && $integration->setting('webhookManual') === true) {
            return self::HintManual;
        }

        return null;
    }

    /**
     * Read once per instance: a poll run asks for every connection.
     */
    private function publicity(): ?bool
    {
        if (! $this->publicityKnown) {
            $this->publicity = $this->reachability->publicity();
            $this->publicityKnown = true;
        }

        return $this->publicity;
    }

    private function webhooksReach(TeamIntegration $integration): bool
    {
        if (! $this->acceptsWebhooks($integration->provider)) {
            return false;
        }

        return match ($integration->provider) {
            IntegrationProvider::Jira => $integration->hasScope(self::JiraWebhookScope),
            IntegrationProvider::JiraDataCenter => $integration->webhook_status instanceof IntegrationWebhookStatus,
            default => true,
        };
    }
}
