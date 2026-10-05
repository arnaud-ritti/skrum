<?php

namespace App\Support\Surveys;

use App\Models\TeamSurveyAnswer;
use Illuminate\Support\Collection;

/**
 * The scale every health score is given and read on (spec §11.9): 1 to 5.
 */
class HealthScale
{
    public const int Max = 5;

    /** The largest population standard deviation of answers from 1 to 5. */
    public const float MaximumSpread = (self::Max - 1) / 2;

    /** A statement's average as every reader shows it: rounded once to one decimal. */
    public static function average(float $mean): float
    {
        return round($mean, 1);
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers  at least one
     */
    public static function averageOf(Collection $answers): float
    {
        return self::average($answers->sum(fn (TeamSurveyAnswer $answer): int => (int) $answer->value) / $answers->count());
    }

    /**
     * @param  array<int, int>  $values  answers from 1 to 5
     * @return array{int, int, int, int, int} answers per value, 1 to 5
     */
    public static function distribution(array $values): array
    {
        $countPerValue = array_count_values($values);

        return [
            $countPerValue[1] ?? 0,
            $countPerValue[2] ?? 0,
            $countPerValue[3] ?? 0,
            $countPerValue[4] ?? 0,
            $countPerValue[5] ?? 0,
        ];
    }

    public static function band(float $score): string
    {
        return match (true) {
            $score >= 4 => 'excellent',
            $score >= 3 => 'good',
            $score >= 2 => 'needs_attention',
            default => 'critical',
        };
    }
}
