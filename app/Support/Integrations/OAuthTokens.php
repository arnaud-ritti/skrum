<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\ProviderRejected;
use App\Exceptions\Integrations\ReconnectRequired;
use Illuminate\Http\Client\Response;

class OAuthTokens
{
    private const array RefusedGrantErrors = ['invalid_grant', 'unauthorized_client'];

    /**
     * @param  array<array-key, mixed>  $payload
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    public static function fromResponse(IntegrationProvider $provider, array $payload): array
    {
        $accessToken = $payload['access_token'] ?? null;

        throw_if(! is_string($accessToken) || $accessToken === '', ProviderRejected::class, $provider, 'missing_access_token');

        $refreshToken = $payload['refresh_token'] ?? null;
        $expiresIn = $payload['expires_in'] ?? null;
        $scope = $payload['scope'] ?? [];
        $scopes = is_array($scope) ? $scope : (preg_split('/[\s,]+/', (string) $scope, -1, PREG_SPLIT_NO_EMPTY) ?: []);

        return [
            'access_token' => $accessToken,
            'refresh_token' => is_string($refreshToken) && $refreshToken !== '' ? $refreshToken : null,
            'expires_at' => is_numeric($expiresIn) ? now()->getTimestamp() + (int) $expiresIn : null,
            'scopes' => array_values(array_map(fn (mixed $item): string => (string) $item, $scopes)),
        ];
    }

    /**
     * @param  array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}  $tokens
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null}
     */
    public static function credentials(array $tokens): array
    {
        return [
            'access_token' => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'],
            'expires_at' => $tokens['expires_at'],
        ];
    }

    public static function failTokenRequest(IntegrationProvider $provider, Response $response): never
    {
        $error = $response->json('error');

        if ($response->status() === 401 || in_array($error, self::RefusedGrantErrors, true)) {
            $description = $response->json('error_description');

            throw new ReconnectRequired($provider, is_string($description) ? $description : (is_string($error) ? $error : 'invalid_grant'));
        }

        ProviderHttp::fail($provider, $response);
    }
}
