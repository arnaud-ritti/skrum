<?php

namespace App\Support\Integrations\Inbound;

use App\Support\Integrations\Base64Url;

/**
 * The JWT Atlassian may send with dynamic webhooks of OAuth 2.0 apps,
 * signed HS256 with the app's client secret.
 */
class JiraWebhookJwt
{
    private const LeewaySeconds = 60;

    public static function isValid(string $token, string $secret): bool
    {
        $parts = explode('.', $token);

        if (count($parts) !== 3 || $secret === '') {
            return false;
        }

        [$header, $payload, $signature] = $parts;
        $decodedHeader = json_decode((string) Base64Url::decode($header), true);

        if (! is_array($decodedHeader) || ($decodedHeader['alg'] ?? null) !== 'HS256') {
            return false;
        }

        if (! hash_equals(Base64Url::encode(hash_hmac('sha256', "{$header}.{$payload}", $secret, true)), $signature)) {
            return false;
        }

        $claims = json_decode((string) Base64Url::decode($payload), true);

        if (! is_array($claims)) {
            return false;
        }

        $expiresAt = $claims['exp'] ?? null;

        return ! is_int($expiresAt) || $expiresAt + self::LeewaySeconds >= now()->getTimestamp();
    }
}
