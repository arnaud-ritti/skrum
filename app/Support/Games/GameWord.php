<?php

namespace App\Support\Games;

use Illuminate\Support\Str;

/**
 * Letter-level view of a secret word: separators (space, hyphen,
 * apostrophe) are always given, letters match through their ASCII fold.
 */
class GameWord
{
    private const Separators = [' ', '-', "'"];

    /**
     * @return array<int, string>
     */
    public static function characters(string $word): array
    {
        return mb_str_split($word);
    }

    public static function isSeparator(string $character): bool
    {
        return in_array($character, self::Separators, true);
    }

    public static function fold(string $character): string
    {
        return Str::lower(Str::ascii($character));
    }

    /**
     * @return array<int, int>
     */
    public static function letterPositions(string $word): array
    {
        $positions = [];

        foreach (self::characters($word) as $index => $character) {
            if (! self::isSeparator($character)) {
                $positions[] = $index;
            }
        }

        return $positions;
    }

    /**
     * @return array<int, int>
     */
    public static function positionsOf(string $word, string $letter): array
    {
        $folded = self::fold($letter);
        $positions = [];

        foreach (self::characters($word) as $index => $character) {
            if (! self::isSeparator($character) && self::fold($character) === $folded) {
                $positions[] = $index;
            }
        }

        return $positions;
    }

    /**
     * @param  array<int, int>  $revealedPositions
     * @return array<int, ?string>
     */
    public static function mask(string $word, array $revealedPositions): array
    {
        $revealed = array_flip($revealedPositions);
        $mask = [];

        foreach (self::characters($word) as $index => $character) {
            $mask[] = self::isSeparator($character) || isset($revealed[$index]) ? $character : null;
        }

        return $mask;
    }

    /**
     * @param  array<int, int>  $revealedPositions
     */
    public static function isFullyRevealed(string $word, array $revealedPositions): bool
    {
        return array_diff(self::letterPositions($word), $revealedPositions) === [];
    }

    public static function normalize(string $text): string
    {
        $folded = str_replace(['-', "'"], '', Str::lower(Str::ascii($text)));

        return trim((string) preg_replace('/\s+/', ' ', $folded));
    }
}
