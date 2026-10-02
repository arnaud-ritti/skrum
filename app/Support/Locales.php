<?php

namespace App\Support;

class Locales
{
    /**
     * The locale itself when the instance ships it, English otherwise.
     */
    public static function supported(string $locale): string
    {
        /** @var array<int, string> $locales */
        $locales = config('skrum.locales');

        return in_array($locale, $locales, true) ? $locale : 'en';
    }
}
