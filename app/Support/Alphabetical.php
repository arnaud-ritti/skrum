<?php

namespace App\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Alphabetical order decided in PHP: SQL order differs between engines and collations.
 */
class Alphabetical
{
    public static function key(string $value): string
    {
        return Str::lower(Str::ascii($value));
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
            ->sort(function (mixed $first, mixed $second) use ($by): int {
                $firstValue = $by($first);
                $secondValue = $by($second);

                return [self::key($firstValue), $firstValue] <=> [self::key($secondValue), $secondValue];
            })
            ->values();
    }
}
