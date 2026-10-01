<?php

namespace App\Support;

class EmojibaseLocale
{
    /** @var array<string, string> */
    public const array Locales = [
        'en' => 'en',
        'fr' => 'fr',
        'es' => 'es',
        'de' => 'de',
    ];

    public static function forAppLocale(string $appLocale): string
    {
        return self::Locales[$appLocale] ?? 'en';
    }
}
