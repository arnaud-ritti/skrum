<?php

namespace App\Support\Retros;

use Closure;

/**
 * Whole minutes per timed phase, offered to the
 * facilitator. Nothing starts by itself.
 */
class PhaseDurations
{
    public const array TimedPhases = ['writing', 'grouping', 'voting', 'discussing', 'actions'];

    public const array Standard = ['writing' => 7, 'grouping' => 5, 'voting' => 3, 'discussing' => 15, 'actions' => 5];

    public const int MaxMinutes = 60;

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(string $attribute = 'phase_durations'): array
    {
        return [
            $attribute => ['sometimes', 'nullable', 'array', self::onlyTimedPhases()],
            "{$attribute}.*" => ['integer', 'min:1', 'max:'.self::MaxMinutes],
        ];
    }

    /**
     * @param  ?array<array-key, mixed>  $durations
     * @return ?array<string, int>
     */
    public static function normalise(?array $durations): ?array
    {
        $kept = [];

        foreach (self::TimedPhases as $phase) {
            $minutes = $durations[$phase] ?? null;

            if (is_int($minutes) && $minutes >= 1 && $minutes <= self::MaxMinutes) {
                $kept[$phase] = $minutes;
            }
        }

        return $kept === [] ? null : $kept;
    }

    /**
     * Validated minutes arrive as integers from JSON and as strings from a form post.
     *
     * @param  ?array<array-key, mixed>  $validated
     * @return ?array<string, int>
     */
    public static function fromValidated(?array $validated): ?array
    {
        if ($validated === null) {
            return null;
        }

        return self::normalise(array_map(fn (mixed $minutes): int => (int) $minutes, $validated));
    }

    private static function onlyTimedPhases(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_array($value) || array_diff(array_keys($value), self::TimedPhases) === []) {
                return;
            }

            $fail(__('Only writing, grouping, voting, discussing and actions can have a timer.'));
        };
    }
}
