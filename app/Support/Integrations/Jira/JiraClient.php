<?php

namespace App\Support\Integrations\Jira;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\NotConnected;
use App\Models\TeamIntegration;
use App\Support\Integrations\IntegrationTokens;
use App\Support\Integrations\OAuthTokens;
use App\Support\Integrations\ProviderHttp;
use App\Support\Integrations\RefreshesTokens;
use Illuminate\Http\Client\Response;

class JiraClient implements JiraApi, RefreshesTokens
{
    public const AuthorizeUrl = 'https://auth.atlassian.com/authorize';

    public const TokenUrl = 'https://auth.atlassian.com/oauth/token';

    public const ResourcesUrl = 'https://api.atlassian.com/oauth/token/accessible-resources';

    public const ApiUrl = 'https://api.atlassian.com/ex/jira/';

    public const ReadScopes = ['offline_access', 'read:jira-work', 'read:board-scope:jira-software', 'read:project:jira', 'read:sprint:jira-software', 'manage:jira-webhook'];

    public const WriteScopes = ['write:jira-work', 'read:jira-user', 'manage:jira-configuration'];

    public function __construct(private IntegrationTokens $tokens) {}

    /**
     * @return array<int, string>
     */
    public static function scopesFor(IntegrationAccess $access): array
    {
        return $access === IntegrationAccess::Write ? [...self::ReadScopes, ...self::WriteScopes] : self::ReadScopes;
    }

    public function authorizationUrl(string $state, IntegrationAccess $access): string
    {
        return self::AuthorizeUrl.'?'.http_build_query([
            'audience' => 'api.atlassian.com',
            'client_id' => (string) config('services.jira.client_id'),
            'scope' => implode(' ', self::scopesFor($access)),
            'redirect_uri' => (string) config('services.jira.redirect'),
            'state' => $state,
            'response_type' => 'code',
            'prompt' => 'consent',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    public function exchangeCode(string $code): array
    {
        return $this->tokenRequest([
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => (string) config('services.jira.redirect'),
        ]);
    }

    public function refreshTokens(string $refreshToken): array
    {
        return $this->tokenRequest(['grant_type' => 'refresh_token', 'refresh_token' => $refreshToken]);
    }

    /**
     * @return array<int, array{cloudId: string, url: string, name: string}>
     */
    public function accessibleResources(string $accessToken): array
    {
        $response = ProviderHttp::send(IntegrationProvider::Jira, fn () => ProviderHttp::request()->withToken($accessToken)->get(self::ResourcesUrl));

        if (! $response->successful()) {
            ProviderHttp::fail(IntegrationProvider::Jira, $response);
        }

        $sites = [];

        foreach ((array) $response->json() as $site) {
            if (! is_array($site) || ! is_string($site['id'] ?? null) || ! is_string($site['url'] ?? null)) {
                continue;
            }

            if (is_array($site['scopes'] ?? null) && ! in_array('read:jira-work', $site['scopes'], true)) {
                continue;
            }

            $sites[] = [
                'cloudId' => $site['id'],
                'url' => rtrim($site['url'], '/'),
                'name' => is_string($site['name'] ?? null) ? $site['name'] : $site['url'],
            ];
        }

        return $sites;
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<array-key, mixed>
     */
    public function get(TeamIntegration $integration, string $path, array $query = []): array
    {
        return $this->request($integration, 'GET', $path, $query);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function post(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'POST', $path, $body);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function put(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'PUT', $path, $body);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function delete(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'DELETE', $path, $body);
    }

    public function apiPath(string $resource): string
    {
        return 'rest/api/3/'.ltrim($resource, '/');
    }

    public function browseUrl(TeamIntegration $integration, string $key): string
    {
        return rtrim((string) $integration->setting('siteUrl', ''), '/').'/browse/'.rawurlencode($key);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<array-key, mixed>
     */
    private function request(TeamIntegration $integration, string $method, string $path, array $data): array
    {
        return $integration->withReconnectHandling(function () use ($integration, $method, $path, $data): array {
            $cloudId = $integration->setting('cloudId');

            throw_if(! is_string($cloudId) || $cloudId === '', NotConnected::class, IntegrationProvider::Jira);

            $url = self::ApiUrl.$cloudId.'/'.ltrim($path, '/');
            $token = $this->tokens->accessToken($integration);
            $response = $this->send($method, $url, $data, $token);

            if ($response->status() === 401) {
                $response = $this->send($method, $url, $data, $this->tokens->refresh($integration, $token));
            }

            if (! $response->successful()) {
                ProviderHttp::fail(IntegrationProvider::Jira, $response);
            }

            $json = $response->json();

            return is_array($json) ? $json : [];
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function send(string $method, string $url, array $data, string $token): Response
    {
        $options = $method === 'GET' ? ['query' => $data] : ['json' => $data];

        return ProviderHttp::send(IntegrationProvider::Jira, fn () => ProviderHttp::request()->withToken($token)->send($method, $url, $options));
    }

    /**
     * @param  array<string, string>  $params
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    private function tokenRequest(array $params): array
    {
        $response = ProviderHttp::send(IntegrationProvider::Jira, fn () => ProviderHttp::request()->post(self::TokenUrl, [
            ...$params,
            'client_id' => (string) config('services.jira.client_id'),
            'client_secret' => (string) config('services.jira.client_secret'),
        ]));

        if (! $response->successful()) {
            OAuthTokens::failTokenRequest(IntegrationProvider::Jira, $response);
        }

        return OAuthTokens::fromResponse(IntegrationProvider::Jira, (array) $response->json());
    }
}
