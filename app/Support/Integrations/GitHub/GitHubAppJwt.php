<?php

namespace App\Support\Integrations\GitHub;

use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\ProviderRejected;
use App\Support\Integrations\Base64Url;

/**
 * The GitHub App's own identity (spec 8 §4.2): an RS256 JWT signed with
 * ext-openssl, valid from a minute ago for nine minutes.
 */
class GitHubAppJwt
{
    private const int ClockSkewSeconds = 60;

    private const int LifetimeSeconds = 540;

    public function token(): string
    {
        $now = now()->getTimestamp();
        $appId = (string) config('services.github_app.app_id');
        $segments = [
            $this->encode(['alg' => 'RS256', 'typ' => 'JWT']),
            $this->encode([
                'iat' => $now - self::ClockSkewSeconds,
                'exp' => $now + self::LifetimeSeconds,
                'iss' => ctype_digit($appId) ? (int) $appId : $appId,
            ]),
        ];

        $pem = $this->privateKey();
        $key = $pem === '' ? false : openssl_pkey_get_private($pem);

        throw_if($key === false, ProviderRejected::class, IntegrationProvider::GitHub, 'github_app_key_unusable');

        $signed = openssl_sign(implode('.', $segments), $signature, $key, OPENSSL_ALGO_SHA256);

        throw_unless($signed, ProviderRejected::class, IntegrationProvider::GitHub, 'github_app_key_unusable');

        return implode('.', [...$segments, Base64Url::encode($signature)]);
    }

    private function privateKey(): string
    {
        $key = (string) config('services.github_app.private_key');

        if ($key !== '') {
            return $key;
        }

        $path = (string) config('services.github_app.private_key_path');
        $contents = $path !== '' && is_readable($path) ? file_get_contents($path) : false;

        return is_string($contents) ? $contents : '';
    }

    /**
     * @param  array<string, int|string>  $data
     */
    private function encode(array $data): string
    {
        return Base64Url::encode((string) json_encode($data));
    }
}
