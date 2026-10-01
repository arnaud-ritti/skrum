<?php

namespace App\Support\Integrations\JiraDataCenter;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ConnectionRefused;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationTokens;
use App\Support\Integrations\Jira\JiraApi;
use App\Support\Integrations\OAuthTokens;
use App\Support\Integrations\ProviderHttp;
use App\Support\Integrations\RefreshesTokens;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use SensitiveParameter;

/**
 * Jira Server/Data Center (spec 8 §4.1): REST v2 on the one admin-trusted
 * server, with OAuth 2.0 tokens or a personal access token. Redirects are
 * never followed and a connection made for another server sends nothing,
 * so a credential cannot reach another host.
 */
class JiraDataCenterClient implements JiraApi, RefreshesTokens
{
    public const AuthMethodOAuth = 'oauth';

    public const AuthMethodToken = 'pat';

    private const Provider = IntegrationProvider::JiraDataCenter;

    public function __construct(private IntegrationTokens $tokens) {}

    public function authorizationUrl(string $state, IntegrationAccess $access, string $codeChallenge): string
    {
        return JiraDataCenterServer::url('rest/oauth2/latest/authorize').'?'.http_build_query([
            'client_id' => (string) config('services.jira_dc.client_id'),
            'redirect_uri' => (string) config('services.jira_dc.redirect'),
            'response_type' => 'code',
            'scope' => $access === IntegrationAccess::Write ? 'WRITE' : 'READ',
            'state' => $state,
            'code_challenge' => $codeChallenge,
            'code_challenge_method' => 'S256',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    public function exchangeCode(#[SensitiveParameter] string $code, #[SensitiveParameter] string $codeVerifier): array
    {
        return $this->tokenRequest(['grant_type' => 'authorization_code', 'code' => $code, 'code_verifier' => $codeVerifier]);
    }

    public function refreshTokens(#[SensitiveParameter] string $refreshToken): array
    {
        return $this->tokenRequest(['grant_type' => 'refresh_token', 'refresh_token' => $refreshToken]);
    }

    /**
     * A call with a token that is not stored yet: 401 and 403 mean Jira
     * refuses the token.
     *
     * @return array<array-key, mixed>
     */
    public function probe(#[SensitiveParameter] string $token, string $path): array
    {
        $response = $this->send('GET', $path, [], $token);

        if (in_array($response->status(), [401, 403], true)) {
            throw new ConnectionRefused(__("Jira didn't accept this token."));
        }

        if (! $response->successful()) {
            ProviderHttp::fail(self::Provider, $response);
        }

        return $this->decode($response);
    }

    /**
     * A connection made for another server than the configured one sends
     * nothing, not even a token refresh.
     */
    public function ensureConfiguredServer(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(function () use ($integration): void {
            if ($integration->setting('serverKey') !== JiraDataCenterServer::key()) {
                throw new ReconnectRequired(self::Provider, __('skrum is now configured for another Jira server. Reconnect.'));
            }
        });
    }

    public function get(TeamIntegration $integration, string $path, array $query = []): array
    {
        return $this->request($integration, 'GET', $path, $query);
    }

    public function post(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'POST', $path, $body);
    }

    public function put(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'PUT', $path, $body);
    }

    public function delete(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'DELETE', $path, $body);
    }

    public function apiPath(string $resource): string
    {
        return 'rest/api/2/'.ltrim($resource, '/');
    }

    public function browseUrl(TeamIntegration $integration, string $key): string
    {
        return JiraDataCenterServer::url('browse/'.rawurlencode($key));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<array-key, mixed>
     */
    private function request(TeamIntegration $integration, string $method, string $path, array $data): array
    {
        return $integration->withReconnectHandling(function () use ($integration, $method, $path, $data): array {
            $this->ensureConfiguredServer($integration);

            $response = $integration->setting('authMethod') === self::AuthMethodToken
                ? $this->withPersonalToken($integration, $method, $path, $data)
                : $this->withOAuthToken($integration, $method, $path, $data);

            if (! $response->successful()) {
                ProviderHttp::fail(self::Provider, $response);
            }

            return $this->decode($response);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function withOAuthToken(TeamIntegration $integration, string $method, string $path, array $data): Response
    {
        $token = $this->tokens->accessToken($integration);
        $response = $this->send($method, $path, $data, $token);

        if ($response->status() !== 401) {
            return $response;
        }

        return $this->send($method, $path, $data, $this->tokens->refresh($integration, $token));
    }

    /**
     * Personal access tokens have no refresh: a 401 means revoked or expired.
     *
     * @param  array<string, mixed>  $data
     */
    private function withPersonalToken(TeamIntegration $integration, string $method, string $path, array $data): Response
    {
        if (! in_array(self::AuthMethodToken, self::Provider->authMethods(), true)) {
            throw new ReconnectRequired(self::Provider, __('Personal access tokens are turned off on this skrum instance. Connect with OAuth.'));
        }

        $token = $integration->credential('personalAccessToken');

        if (! is_string($token) || $token === '') {
            throw new ReconnectRequired(self::Provider, 'missing_personal_access_token');
        }

        $response = $this->send($method, $path, $data, $token);

        if ($response->status() === 401) {
            throw new ReconnectRequired(self::Provider, __('The Jira personal access token was revoked or has expired. Paste a new one.'));
        }

        return $response;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function send(string $method, string $path, array $data, #[SensitiveParameter] string $token): Response
    {
        $options = $method === 'GET' ? ['query' => $data] : ['json' => $data];

        return ProviderHttp::send(self::Provider, fn () => $this->http()->withToken($token)->send($method, JiraDataCenterServer::url($path), $options));
    }

    private function http(): PendingRequest
    {
        return ProviderHttp::request()->withoutRedirecting();
    }

    /**
     * @param  array<string, string>  $params
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    private function tokenRequest(array $params): array
    {
        $response = ProviderHttp::send(self::Provider, fn () => $this->http()->asForm()->post(JiraDataCenterServer::url('rest/oauth2/latest/token'), [
            ...$params,
            'client_id' => (string) config('services.jira_dc.client_id'),
            'client_secret' => (string) config('services.jira_dc.client_secret'),
            'redirect_uri' => (string) config('services.jira_dc.redirect'),
        ]));

        if (! $response->successful()) {
            OAuthTokens::failTokenRequest(self::Provider, $response);
        }

        return OAuthTokens::fromResponse(self::Provider, (array) $response->json());
    }

    /**
     * @return array<array-key, mixed>
     */
    private function decode(Response $response): array
    {
        $json = $response->json();

        return is_array($json) ? $json : [];
    }
}
