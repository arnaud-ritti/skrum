<?php

namespace App\Support\Branding;

class BrandPaletteSummary
{
    /**
     * @return array{
     *     light: array<string, string>,
     *     dark: array<string, string>,
     *     ratios: array{
     *         light: array{onPrimary: float, primaryOnSurface: float},
     *         dark: array{onPrimary: float, primaryOnSurface: float}
     *     },
     *     warnings: array<int, array{key: string, replace: array<string, int|string>}>
     * }
     */
    public static function of(BrandPalette $palette): array
    {
        $ratios = $palette->ratios();

        return [
            ...$palette->toHex(),
            'ratios' => [
                'light' => array_map(self::roundedDown(...), $ratios['light']),
                'dark' => array_map(self::roundedDown(...), $ratios['dark']),
            ],
            'warnings' => $palette->warnings,
        ];
    }

    /**
     * Rounded down so that a ratio just under a threshold is never shown as reaching it.
     */
    private static function roundedDown(float $ratio): float
    {
        return floor($ratio * 100) / 100;
    }
}
