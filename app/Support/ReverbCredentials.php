<?php

namespace App\Support;

class ReverbCredentials
{
    /**
     * Reverb and its only client run side by side: a credential nobody set is derived
     * from the app key, under one label per purpose, so none reveals another.
     */
    public static function resolve(mixed $explicit, string $purpose, mixed $appKey): ?string
    {
        if (is_string($explicit) && $explicit !== '') {
            return $explicit;
        }

        if (! is_string($appKey) || $appKey === '') {
            return null;
        }

        return substr(hash_hmac('sha256', "skrum-reverb-{$purpose}", $appKey), 0, 32);
    }
}
