<?php

namespace App\Support\Games;

use Illuminate\Validation\ValidationException;

/**
 * Draw & Guess operations on the logical 1000 × 750 canvas. Parsing keeps
 * only known keys, so what is stored and broadcast is exactly this shape.
 */
class DrawingOp
{
    public const Colors = ['black', 'red', 'orange', 'green', 'blue', 'purple', 'white'];

    public const Sizes = [4, 10, 24];

    public const Width = 1000;

    public const Height = 750;

    public const MaxStrokePoints = 1000;

    public const MaxOps = 500;

    public const MaxPoints = 20000;

    /**
     * @return array{type: string, color: string, size: int, points: array<int, array{0: int, 1: int}>}|array{type: string, color: string, x: int, y: int}
     *
     * @throws ValidationException
     */
    public static function parse(mixed $op): array
    {
        if (! is_array($op)) {
            throw self::invalid();
        }

        $color = $op['color'] ?? null;

        if (! is_string($color) || ! in_array($color, self::Colors, true)) {
            throw self::invalid();
        }

        return match ($op['type'] ?? null) {
            'stroke' => self::stroke($color, $op['size'] ?? null, $op['points'] ?? null),
            'fill' => self::fill($color, $op['x'] ?? null, $op['y'] ?? null),
            default => throw self::invalid(),
        };
    }

    /**
     * @param  array<array-key, mixed>  $op
     */
    public static function pointCount(array $op): int
    {
        if (($op['type'] ?? null) !== 'stroke' || ! is_array($op['points'] ?? null)) {
            return 0;
        }

        return count($op['points']);
    }

    /**
     * @return array{type: string, color: string, size: int, points: array<int, array{0: int, 1: int}>}
     */
    private static function stroke(string $color, mixed $size, mixed $points): array
    {
        if (! is_int($size) || ! in_array($size, self::Sizes, true)) {
            throw self::invalid();
        }

        if (! is_array($points) || ! array_is_list($points)) {
            throw self::invalid();
        }

        $count = count($points);

        if ($count < 1 || $count > self::MaxStrokePoints) {
            throw self::invalid();
        }

        $clean = [];

        foreach ($points as $point) {
            if (! is_array($point) || ! array_is_list($point) || count($point) !== 2) {
                throw self::invalid();
            }

            [$x, $y] = $point;

            if (! is_int($x) || ! is_int($y) || ! self::inRange($x, self::Width) || ! self::inRange($y, self::Height)) {
                throw self::invalid();
            }

            $clean[] = [$x, $y];
        }

        return ['type' => 'stroke', 'color' => $color, 'size' => $size, 'points' => $clean];
    }

    /**
     * @return array{type: string, color: string, x: int, y: int}
     */
    private static function fill(string $color, mixed $x, mixed $y): array
    {
        if (! is_int($x) || ! is_int($y) || ! self::inRange($x, self::Width) || ! self::inRange($y, self::Height)) {
            throw self::invalid();
        }

        return ['type' => 'fill', 'color' => $color, 'x' => $x, 'y' => $y];
    }

    private static function inRange(int $value, int $max): bool
    {
        return $value >= 0 && $value <= $max;
    }

    private static function invalid(): ValidationException
    {
        return ValidationException::withMessages(['op' => __('This drawing operation is not valid.')]);
    }
}
