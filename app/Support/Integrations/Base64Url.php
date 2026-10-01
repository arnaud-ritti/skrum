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
}
