<?php

namespace App\Support\Surveys;

/**
 * The scale every reader of health data reports on (spec §11.9). Scores are
 * stored as they were given, on the scale of their question; they are
 * brought to five when they are read, never when they are written.
 */
class HealthScale
{
    public const int Max = 5;

    /** The scale of the health checks of before plan 19. */
    public const int LegacyMax = 10;

    /**
     * A mean on its own scale, brought to the health scale and not rounded:
     * identity on five, halving on ten.
     */
    public static function normalise(float $mean, int $scaleMax): float
    {
        return $mean * self::Max / $scaleMax;
    }

    /**
     * A statement's average as every reader shows it: normalised, then
     * rounded once to one decimal.
     */
    public static function average(float $mean, int $scaleMax): float
    {
        return round(self::normalise($mean, $scaleMax), 1);
    }

    /**
     * `ceil(value × 5 ÷ scaleMax)`, in integers so that no float decides a bucket.
     */
    public static function bucket(int $value, int $scaleMax): int
    {
        return max(1, min(self::Max, intdiv($value * self::Max + $scaleMax - 1, $scaleMax)));
    }

    /**
     * @param  array<int, int>  $values  answers on `$scaleMax`
     * @return array{int, int, int, int, int} answers per bucket, 1 to 5
     */
    public static function distribution(array $values, int $scaleMax): array
    {
        $countPerBucket = array_count_values(array_map(fn (int $value): int => self::bucket($value, $scaleMax), $values));

        return [
            $countPerBucket[1] ?? 0,
            $countPerBucket[2] ?? 0,
            $countPerBucket[3] ?? 0,
            $countPerBucket[4] ?? 0,
            $countPerBucket[5] ?? 0,
        ];
    }

    /** The largest population standard deviation on a scale from 1. */
    public static function maximumSpread(int $scaleMax): float
    {
        return ($scaleMax - 1) / 2;
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
