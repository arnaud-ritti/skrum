<?php

namespace App\Support\Integrations;

/**
 * Base64url without padding (RFC 4648 §5), as JWTs and PKCE use it.
 */
class Base64Url
{
    public static function encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    /**
     * The decoded bytes, or null when the value is not base64url.
     */
    public static function decode(string $value): ?string
    {
        $padded = str_pad($value, strlen($value) + (4 - strlen($value) % 4) % 4, '=');
        $decoded = base64_decode(strtr($padded, '-_', '+/'), true);

        return $decoded === false ? null : $decoded;
    }
}
