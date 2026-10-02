<?php

namespace App\Support\Database;

use Illuminate\Support\Str;

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
        return $text === null ? null : Str::lower($text);
    }

    /**
     * Each wildcard character of the term becomes "any one character": what SQL returns is then
     * every true match and, rarely, a near one, which contains() removes.
     */
    public static function pattern(string $term): string
    {
        return '%'.str_replace(self::Wildcards, '_', Str::lower($term)).'%';
    }

    public static function contains(?string $text, string $term): bool
    {
        return $text !== null && str_contains(Str::lower($text), Str::lower($term));
    }
}
