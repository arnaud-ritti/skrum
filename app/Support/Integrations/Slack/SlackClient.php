<?php

namespace App\Support\Integrations\Slack;

use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\IntegrationException;
use App\Exceptions\Integrations\ProviderRejected;
use App\Exceptions\Integrations\ProviderUnavailable;
use App\Exceptions\Integrations\RateLimited;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Models\TeamIntegration;
use App\Support\Integrations\ProviderHttp;

class SlackClient
{
    public const AuthorizeUrl = 'https://slack.com/oauth/v2/authorize';

    public const ApiUrl = 'https://slack.com/api/';

    public const WebhookPrefix = 'https://hooks.slack.com/';

    public const Scope = 'incoming-webhook';

    private const array ReconnectErrors = ['invalid_auth', 'not_authed', 'token_revoked', 'token_expired', 'account_inactive'];

    private const array LostChannelStatuses = [403, 404, 410];

    public static function isWebhookUrl(string $url): bool
    {
        return str_starts_with($url, self::WebhookPrefix) && filter_var($url, FILTER_VALIDATE_URL) !== false;
    }

    public function authorizationUrl(string $state): string
    {
        return self::AuthorizeUrl.'?'.http_build_query([
            'client_id' => (string) config('services.slack.client_id'),
            'scope' => self::Scope,
            'redirect_uri' => (string) config('services.slack.redirect'),
            'state' => $state,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function exchangeCode(string $code): array
    {
        return $this->call('oauth.v2.access', [
            'client_id' => (string) config('services.slack.client_id'),
            'client_secret' => (string) config('services.slack.client_secret'),
            'code' => $code,
            'redirect_uri' => (string) config('services.slack.redirect'),
        ]);
    }

    public function authTest(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(fn (): array => $this->call('auth.test', [], (string) $integration->credential('access_token')));
    }

    public function revoke(TeamIntegration $integration): void
    {
        try {
            $this->call('auth.revoke', [], (string) $integration->credential('access_token'));
        } catch (IntegrationException) {
            // Revocation is best effort: the connection is deleted either way.
        }
    }

    /**
     * @param  array<string, mixed>  $message
     */
    public function postMessage(TeamIntegration $integration, array $message): void
    {
        $integration->withReconnectHandling(function () use ($integration, $message): void {
            $url = $integration->credential('webhook_url');

            throw_if(! is_string($url) || ! self::isWebhookUrl($url), ReconnectRequired::class, IntegrationProvider::Slack, 'invalid_webhook_url');

            $response = ProviderHttp::send(IntegrationProvider::Slack, fn () => ProviderHttp::request()->post($url, $message));

            if ($response->successful()) {
                return;
            }

            $error = trim($response->body());

            if (in_array($response->status(), self::LostChannelStatuses, true)) {
                throw new ReconnectRequired(IntegrationProvider::Slack, $error === '' ? "HTTP {$response->status()}" : $error);
            }

            ProviderHttp::fail(IntegrationProvider::Slack, $response, $error === '' ? null : $error);
        });
    }

    /**
     * @param  array<string, string>  $params
     * @return array<string, mixed>
     */
    private function call(string $method, array $params, ?string $token = null): array
    {
        $request = ProviderHttp::request()->asForm();

        if ($token !== null) {
            $request = $request->withToken($token);
        }

        $response = ProviderHttp::send(IntegrationProvider::Slack, fn () => $request->post(self::ApiUrl.$method, $params));

        if (! $response->successful()) {
            ProviderHttp::fail(IntegrationProvider::Slack, $response);
        }

        $payload = $response->json();

        throw_unless(is_array($payload), ProviderUnavailable::class, IntegrationProvider::Slack, 'invalid_response');

        if (($payload['ok'] ?? false) === true) {
            return $payload;
        }

        $error = is_string($payload['error'] ?? null) ? $payload['error'] : 'unknown_error';

        throw_if(in_array($error, self::ReconnectErrors, true), ReconnectRequired::class, IntegrationProvider::Slack, $error);

        if ($error === 'ratelimited') {
            throw new RateLimited(IntegrationProvider::Slack, ProviderHttp::retryAfter($response), $error);
        }

        throw new ProviderRejected(IntegrationProvider::Slack, $error);
    }
}
