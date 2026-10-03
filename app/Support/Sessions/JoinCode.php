<?php

namespace App\Support\Sessions;

use Illuminate\Support\Str;

/**
 * A code read aloud in a meeting: no 0, O, 1, I or L, three characters, a
 * hyphen, four characters (the ShareDialog mockup's shape).
 */
class JoinCode
{
    public const string Alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    private const int Length = 7;

    private const int HeadLength = 3;

    public static function generate(): string
    {
        $characters = '';

        for ($index = 0; $index < self::Length; $index++) {
            $characters .= self::Alphabet[random_int(0, strlen(self::Alphabet) - 1)];
        }

        return self::format($characters);
    }

    public static function normalise(string $input): ?string
    {
        $compact = Str::upper(str_replace([' ', '-'], '', trim($input)));

        if (strlen($compact) !== self::Length) {
            return null;
        }

        if (strspn($compact, self::Alphabet) !== self::Length) {
            return null;
        }

        return self::format($compact);
    }

    private static function format(string $compact): string
    {
        return substr($compact, 0, self::HeadLength).'-'.substr($compact, self::HeadLength);
    }
}
