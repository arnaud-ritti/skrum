<?php

namespace App\Support\Integrations\Linear;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationTokens;
use App\Support\Integrations\OAuthTokens;
use App\Support\Integrations\ProviderHttp;
use App\Support\Integrations\RefreshesTokens;
use Illuminate\Http\Client\Response;

class LinearClient implements RefreshesTokens
{
    public const AuthorizeUrl = 'https://linear.app/oauth/authorize';

    public const TokenUrl = 'https://api.linear.app/oauth/token';

    public const RevokeUrl = 'https://api.linear.app/oauth/revoke';

    public const GraphqlUrl = 'https://api.linear.app/graphql';

    private const int DefaultRetryAfterSeconds = 60;

    public function __construct(private IntegrationTokens $tokens) {}

    /**
     * @return array<int, string>
     */
    public static function scopesFor(IntegrationAccess $access): array
    {
        return $access === IntegrationAccess::Write ? ['read', 'write'] : ['read'];
    }

    public function authorizationUrl(string $state, IntegrationAccess $access): string
    {
        return self::AuthorizeUrl.'?'.http_build_query([
            'client_id' => (string) config('services.linear.client_id'),
            'redirect_uri' => (string) config('services.linear.redirect'),
            'response_type' => 'code',
            'scope' => implode(',', self::scopesFor($access)),
            'state' => $state,
            'actor' => 'user',
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
            'redirect_uri' => (string) config('services.linear.redirect'),
        ]);
    }

    public function refreshTokens(string $refreshToken): array
    {
        return $this->tokenRequest(['grant_type' => 'refresh_token', 'refresh_token' => $refreshToken]);
    }

    /**
     * @return array{id: string, name: string, urlKey: string}
     */
    public function organization(string $accessToken): array
    {
        $data = $this->data(ProviderHttp::send(
            IntegrationProvider::Linear,
            fn (): Response => $this->graphql($accessToken, 'query { viewer { organization { id name urlKey } } }', []),
        ));

        $organization = data_get($data, 'viewer.organization');

        throw_if(! is_array($organization) || ! is_string($organization['id'] ?? null), ProviderRejected::class, IntegrationProvider::Linear, 'missing_organization');

        return [
            'id' => $organization['id'],
            'name' => is_string($organization['name'] ?? null) ? $organization['name'] : '',
            'urlKey' => is_string($organization['urlKey'] ?? null) ? $organization['urlKey'] : '',
        ];
    }

    /**
     * @param  array<string, mixed>  $variables
     * @return array<array-key, mixed>
     */
    public function query(TeamIntegration $integration, string $query, array $variables = []): array
    {
        return $integration->withReconnectHandling(function () use ($integration, $query, $variables): array {
            $token = $this->tokens->accessToken($integration);
            $response = ProviderHttp::send(IntegrationProvider::Linear, fn (): Response => $this->graphql($token, $query, $variables));

            if ($response->status() === 401 && is_string($integration->credential('refresh_token'))) {
                $token = $this->tokens->refresh($integration, $token);
                $response = ProviderHttp::send(IntegrationProvider::Linear, fn (): Response => $this->graphql($token, $query, $variables));
            }

            return $this->data($response);
        });
    }

    public function revoke(TeamIntegration $integration): void
    {
        try {
            $token = (string) $integration->credential('access_token');

            ProviderHttp::send(IntegrationProvider::Linear, fn () => ProviderHttp::request()->withToken($token)->post(self::RevokeUrl));
        } catch (IntegrationException) {
            // Revocation is best effort: the connection is deleted either way.
        }
    }

    /**
     * @param  array<string, mixed>  $variables
     */
    private function graphql(string $token, string $query, array $variables): Response
    {
        return ProviderHttp::request()->withToken($token)->post(self::GraphqlUrl, [
            'query' => $query,
            'variables' => (object) $variables,
        ]);
    }

    /**
     * @return array<array-key, mixed>
     */
    private function data(Response $response): array
    {
        $errors = $response->json('errors');

        if (is_array($errors) && $errors !== []) {
            $codes = array_map(fn (mixed $error): mixed => data_get($error, 'extensions.code'), $errors);
            $message = data_get($errors, '0.message');
            $detail = is_string($message) ? $message : 'GraphQL error';

            throw_if($response->status() === 401 || in_array('AUTHENTICATION_ERROR', $codes, true), ReconnectRequired::class, IntegrationProvider::Linear, $detail);

            if ($response->status() === 429 || in_array('RATELIMITED', $codes, true)) {
                throw new RateLimited(IntegrationProvider::Linear, ProviderHttp::retryAfter($response, self::DefaultRetryAfterSeconds), $detail);
            }

            throw_if($response->serverError(), ProviderUnavailable::class, IntegrationProvider::Linear, $detail);

            throw new ProviderRejected(IntegrationProvider::Linear, $detail, $response->status(), $errors);
        }

        if (! $response->successful()) {
            ProviderHttp::fail(IntegrationProvider::Linear, $response);
        }

        $data = $response->json('data');

        return is_array($data) ? $data : [];
    }

    /**
     * @param  array<string, string>  $params
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    private function tokenRequest(array $params): array
    {
        $response = ProviderHttp::send(IntegrationProvider::Linear, fn () => ProviderHttp::request()->asForm()->post(self::TokenUrl, [
            ...$params,
            'client_id' => (string) config('services.linear.client_id'),
            'client_secret' => (string) config('services.linear.client_secret'),
        ]));

        if (! $response->successful()) {
            OAuthTokens::failTokenRequest(IntegrationProvider::Linear, $response);
        }

        return OAuthTokens::fromResponse(IntegrationProvider::Linear, (array) $response->json());
    }
}
