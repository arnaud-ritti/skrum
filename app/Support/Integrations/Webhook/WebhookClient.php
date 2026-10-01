<?php

namespace App\Support\Integrations\Webhook;

use App\Enums\IntegrationProvider;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\Exceptions\WebhookGone;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;

/**
 * Posts signed JSON to an Owner/Admin's endpoint (spec 8 §4.5). The URL is
 * re-checked and the address pinned on every send; redirects are refused
 * and only the status code of the answer is read.
 */
class WebhookClient
{
    public const TimeoutSeconds = 10;

    public const MaxRetryAfterSeconds = 3600;

    public const UserAgent = 'skrum-webhooks/1';

    private const GoneStatus = 410;

    private const TooManyRequestsStatus = 429;

    public function __construct(
        private SafeWebhookUrl $safeWebhookUrl,
        private WebhookHealth $health,
    ) {}

    public static function signature(string $secret, int $timestamp, string $body): string
    {
        return 'sha256='.hash_hmac('sha256', "{$timestamp}.{$body}", $secret);
    }

    public function send(TeamIntegration $integration, WebhookMessage $message, ?IntegrationDelivery $delivery = null): void
    {
        $integration->withReconnectHandling(function () use ($integration, $message, $delivery): void {
            $target = $this->safeWebhookUrl->resolve($this->url($integration));
            $secret = $this->secret($integration);
            $response = null;

            try {
                $response = $this->post($target, $message, $integration, $secret);
            } finally {
                if ($delivery !== null) {
                    $this->recordAttempt($delivery, $response?->status());
                }
            }

            $this->handleAnswer($integration, $response, $delivery !== null);
        });
    }

    public function pendingRequest(WebhookTarget $target): PendingRequest
    {
        $request = ProviderHttp::request(self::TimeoutSeconds)
            ->withoutRedirecting()
            ->withUserAgent(self::UserAgent);

        $resolve = $target->pinnedResolve();

        if ($resolve === null) {
            return $request;
        }

        return $request->withOptions(['curl' => [CURLOPT_RESOLVE => [$resolve]]]);
    }

    public function ensureUsableUrl(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(function () use ($integration): void {
            if (! SafeWebhookUrl::hasAllowedShape($this->url($integration))) {
                throw new ReconnectRequired(IntegrationProvider::Webhook, __('This webhook URL is no longer allowed. Paste a new one.'));
            }
        });
    }

    private function post(WebhookTarget $target, WebhookMessage $message, TeamIntegration $integration, string $secret): Response
    {
        $timestamp = now()->getTimestamp();
        $body = $message->body($integration->team, now());

        try {
            return $this->pendingRequest($target)
                ->withHeaders([
                    'X-Skrum-Event' => $message->event,
                    'X-Skrum-Delivery' => $message->id,
                    'X-Skrum-Timestamp' => (string) $timestamp,
                    'X-Skrum-Signature' => self::signature($secret, $timestamp, $body),
                ])
                ->withBody($body, 'application/json')
                ->post($target->url);
        } catch (ConnectionException) {
            throw new ProviderUnavailable(IntegrationProvider::Webhook, __('Could not reach :host.', ['host' => $target->host]), timedOut: true);
        }
    }

    private function handleAnswer(TeamIntegration $integration, Response $response, bool $isDelivery): void
    {
        if ($response->successful()) {
            if ($isDelivery) {
                $this->health->succeeded($integration);
            }

            return;
        }

        $status = $response->status();
        $answered = __('The receiver answered :status.', ['status' => $status]);

        if ($status === self::GoneStatus) {
            $integration->forceFill(['settings' => [...$integration->settings, 'disabledReason' => WebhookHealth::GoneReason]])->save();

            throw new WebhookGone;
        }

        if ($status === self::TooManyRequestsStatus) {
            throw new RateLimited(IntegrationProvider::Webhook, min(ProviderHttp::retryAfter($response), self::MaxRetryAfterSeconds), $answered);
        }

        if ($response->serverError()) {
            throw new ProviderUnavailable(IntegrationProvider::Webhook, $answered);
        }

        throw new ProviderRejected(IntegrationProvider::Webhook, $answered, $status);
    }

    private function recordAttempt(IntegrationDelivery $delivery, ?int $status): void
    {
        $delivery->forceFill([
            'attempts' => $delivery->attempts + 1,
            'last_attempt_at' => now(),
            'response_status' => $status,
        ])->save();
    }

    private function url(TeamIntegration $integration): string
    {
        $url = $integration->credential('url');

        if (! is_string($url)) {
            throw new UnsafeWebhookUrl;
        }

        return $url;
    }

    private function secret(TeamIntegration $integration): string
    {
        $secret = $integration->credential('webhookSecret');

        if (! is_string($secret) || $secret === '') {
            throw new ReconnectRequired(IntegrationProvider::Webhook, $integration->last_error);
        }

        return $secret;
    }
}
