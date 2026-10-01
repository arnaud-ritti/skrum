<?php

namespace App\Support\Integrations\Webhook;

use App\Enums\IntegrationProvider;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\UnresolvableWebhookHost;
use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\Exceptions\WebhookGone;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use RuntimeException;
use Throwable;

/**
 * Posts signed JSON to an Owner/Admin's endpoint (spec 8 §4.5). The URL is
 * re-checked and the address pinned on every send; redirects are refused
 * and only the status code and the first 2 KB of the answer are read.
 */
class WebhookClient
{
    public const TimeoutSeconds = 10;

    public const MaxRetryAfterSeconds = 3600;

    public const UserAgent = 'skrum-webhooks/1';

    private const GoneStatus = 410;

    private const TooManyRequestsStatus = 429;

    private const MaskedSignatureLength = 6;

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
            $request = null;
            $response = null;
            $excerpt = new ResponseExcerpt;

            try {
                $target = $this->target($integration);
                $request = $this->request($message, $integration, $this->secret($integration));
                $response = $this->post($target, $request, $excerpt);
            } finally {
                if ($delivery !== null) {
                    $this->recordAttempt($delivery, $response?->status());
                    $this->capture($delivery, $request, $response, $excerpt);
                }
            }

            $this->handleAnswer($integration, $response, $delivery !== null);
        });
    }

    public function pendingRequest(WebhookTarget $target, ?ResponseExcerpt $excerpt = null): PendingRequest
    {
        $request = ProviderHttp::request(self::TimeoutSeconds)
            ->withoutRedirecting()
            ->withUserAgent(self::UserAgent);

        $curl = [CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use ($excerpt): int {
            $excerpt?->append($chunk);

            return strlen($chunk);
        }];
        $resolve = $target->pinnedResolve();

        if ($resolve !== null) {
            $curl[CURLOPT_RESOLVE] = [$resolve];
        }

        return $request->withOptions(['curl' => $curl]);
    }

    public static function maskedSignature(string $signature): string
    {
        return 'sha256=…'.substr($signature, -self::MaskedSignatureLength);
    }

    public function ensureUsableUrl(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(function () use ($integration): void {
            $url = $integration->credential('url');

            if (! is_string($url) || ! SafeWebhookUrl::hasAllowedShape($url)) {
                throw new ReconnectRequired(IntegrationProvider::Webhook, __('This webhook URL is no longer allowed. Paste a new one.'));
            }
        });
    }

    private function target(TeamIntegration $integration): WebhookTarget
    {
        $url = $this->url($integration);

        try {
            return $this->safeWebhookUrl->resolve($url);
        } catch (UnresolvableWebhookHost) {
            throw new ProviderUnavailable(IntegrationProvider::Webhook, __('Could not reach :host.', ['host' => strtolower((string) parse_url($url, PHP_URL_HOST))]));
        }
    }

    private function request(WebhookMessage $message, TeamIntegration $integration, string $secret): WebhookRequest
    {
        $sentAt = now();
        $timestamp = $sentAt->getTimestamp();
        $body = $message->body($integration->team, $sentAt);

        $headers = [
            'X-Skrum-Event' => $message->event,
            'X-Skrum-Delivery' => $message->id,
            'X-Skrum-Timestamp' => (string) $timestamp,
            'X-Skrum-Signature' => self::signature($secret, $timestamp, $body),
        ];

        if ($message->redelivery) {
            $headers['X-Skrum-Redelivery'] = 'true';
        }

        return new WebhookRequest($headers, $body);
    }

    private function post(WebhookTarget $target, WebhookRequest $request, ResponseExcerpt $excerpt): Response
    {
        try {
            return $this->pendingRequest($target, $excerpt)
                ->withHeaders($request->headers)
                ->withBody($request->body, 'application/json')
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
            $this->health->gone($integration);

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
        try {
            $delivery->forceFill([
                'attempts' => $delivery->attempts + 1,
                'last_attempt_at' => now(),
                'response_status' => $status,
            ])->save();
        } catch (Throwable $exception) {
            $this->reportStorageFailure('record', $delivery, $exception);
        }
    }

    /**
     * The last attempt wins: one that never built a request clears what
     * the previous attempt left, so the log never shows an answer the
     * last attempt did not get. Keeping the attempt is a courtesy for the
     * delivery log and never turns a sent message into a failed one.
     */
    private function capture(IntegrationDelivery $delivery, ?WebhookRequest $request, ?Response $response, ResponseExcerpt $excerpt): void
    {
        try {
            $delivery->payload?->forceFill([
                'request_headers' => $request === null ? null : $this->storedHeaders($request),
                'request_body' => $request?->body,
                'response_status' => $response?->status(),
                'response_excerpt' => $response === null ? null : $excerpt->orBodyOf($response),
            ])->save();
        } catch (Throwable $exception) {
            $this->reportStorageFailure('keep', $delivery, $exception);
        }
    }

    /**
     * @return array<string, string>
     */
    private function storedHeaders(WebhookRequest $request): array
    {
        return [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'User-Agent' => self::UserAgent,
            ...$request->headers,
            'X-Skrum-Signature' => self::maskedSignature($request->headers['X-Skrum-Signature']),
        ];
    }

    /**
     * Only the class of the cause is reported: a query error's message
     * carries its bound values.
     */
    private function reportStorageFailure(string $action, IntegrationDelivery $delivery, Throwable $cause): void
    {
        $causeName = class_basename($cause);

        report(new RuntimeException("Could not {$action} the webhook attempt of delivery {$delivery->id} ({$causeName})."));
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
            throw new ReconnectRequired(IntegrationProvider::Webhook, __('The signing secret is missing. Rotate it to continue.'));
        }

        return $secret;
    }
}
