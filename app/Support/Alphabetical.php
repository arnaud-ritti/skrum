<?php

namespace App\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Alphabetical order decided in PHP: SQL order differs between engines and collations.
 *
 * Text with no Latin form (Chinese, emoji) keeps its own characters and sorts after the Latin text, by code point.
 */
class Alphabetical
{
    public static function key(string $value): string
    {
        $ascii = Str::ascii($value);

        return Str::lower(trim($ascii) === '' ? $value : $ascii);
    }

    /**
     * Two values that fold alike are ordered by their raw form; rows that are still equal keep the order they came in.
     *
     * @template TValue
     * @template TItems of Collection<array-key, TValue>
     *
     * @param  TItems  $items
     * @param  callable(TValue): string  $by
     * @return TItems
     */
    public static function sort(Collection $items, callable $by): Collection
    {
        return $items
            ->sortBy(function (mixed $item) use ($by): string {
                $value = $by($item);
                $key = self::key($value);

                return "{$key}\0{$value}";
            }, SORT_STRING)
            ->values();
    }
}
