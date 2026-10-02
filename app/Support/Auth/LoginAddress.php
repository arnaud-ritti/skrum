<?php

namespace App\Support\Auth;

use Illuminate\Support\Str;

class LoginAddress
{
    /**
     * The form used to find an account. Nothing but case and surrounding
     * white space is folded: two different mailboxes never become one.
     */
    public static function normalise(string $email): string
    {
        return Str::lower(trim($email));
    }

    /**
     * Coarser than normalise() and computed from it, so every spelling
     * that reaches one account shares one bucket.
     */
    public static function throttleKey(string $email): string
    {
        return hash('sha256', Str::transliterate(self::normalise($email)));
    }

    public static function mask(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return Str::substr($local, 0, 1).'…@'.$domain;
    }
}
