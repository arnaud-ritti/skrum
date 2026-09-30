<?php

namespace App\Support\Integrations\Linear;

/**
 * Linear's fixed priority scale; skrum's High/Medium/Low map to 2/3/4 by
 * default.
 */
class LinearPriority
{
    public const Scale = [0, 1, 2, 3, 4];

    public const Defaults = ['high' => 2, 'medium' => 3, 'low' => 4];

    public static function label(int $value): string
    {
        return match ($value) {
            1 => __('Urgent'),
            2 => __('High'),
            3 => __('Medium'),
            4 => __('Low'),
            default => __('No priority'),
        };
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    public static function options(): array
    {
        return array_map(fn (int $value): array => ['id' => $value, 'name' => self::label($value)], self::Scale);
    }
}
