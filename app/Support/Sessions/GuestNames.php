<?php

namespace App\Support\Sessions;

use App\Support\Locales;
use Illuminate\Support\Arr;

/**
 * "Adjective Animal" suggestions for guests of every session type, with the
 * adjective agreeing with the animal's grammatical gender where the language
 * needs it.
 */
class GuestNames
{
    /** @var array<string, array{pattern: string, animals: array<int, array{name: string, gender: string}>, adjectives: array<int, array<string, string>>}> */
    private static array $files = [];

    public static function random(string $locale): string
    {
        $locale = Locales::supported($locale);

        /** @var array{pattern: string, animals: array<int, array{name: string, gender: string}>, adjectives: array<int, array<string, string>>} $data */
        $data = self::$files[$locale] ??= require resource_path("games/guest-names/{$locale}.php");

        /** @var array{name: string, gender: string} $animal */
        $animal = Arr::random($data['animals']);

        /** @var array<string, string> $adjective */
        $adjective = Arr::random($data['adjectives']);

        return strtr($data['pattern'], [
            ':adjective' => $adjective[$animal['gender']],
            ':animal' => $animal['name'],
        ]);
    }
}
