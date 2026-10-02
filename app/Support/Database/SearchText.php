<?php

namespace App\Support\Database;

/**
 * The fold behind every *_search column and every search term. Computed in PHP, so the four
 * engines store and compare the same bytes: no engine's own lower() or collation is involved.
 */
class SearchText
{
    /**
     * Characters with a meaning in LIKE or GLOB. No grammar of the framework emits an escape
     * clause, so they cannot be made literal in SQL on every engine.
     *
     * @var array<int, string>
     */
    private const array Wildcards = ['\\', '%', '_', '*', '?', '[', ']'];

    public static function fold(?string $text): ?string
    {
        return $text === null ? null : self::lower($text);
    }

    /**
     * Each wildcard character of the term becomes "any one character": what SQL returns is then
     * every true match and, rarely, a near one, which contains() removes.
     */
    public static function pattern(string $term): string
    {
        return '%'.str_replace(self::Wildcards, '_', self::lower($term)).'%';
    }

    public static function contains(?string $text, string $term): bool
    {
        return $text !== null && str_contains(self::lower($text), self::lower($term));
    }

    /**
     * The simple mapping, one letter at a time: the full one writes a Greek sigma differently at
     * the end of a word, so a term would no longer be found inside a longer word.
     */
    private static function lower(string $text): string
    {
        return mb_convert_case($text, MB_CASE_LOWER_SIMPLE, 'UTF-8');
    }
}
