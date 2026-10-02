<?php

namespace App\Support\Branding;

use InvalidArgumentException;

/**
 * @phpstan-type Oklch array{0: float, 1: float, 2: float}
 * @phpstan-type Tokens array<string, Oklch>
 * @phpstan-type Warning array{
 *     key: string,
 *     replace: array<string, int|string>
 * }
 */
class BrandPalette
{
    public const LightBackground = [0.985, 0.004, 80.0];

    public const LightCard = [1.0, 0.0, 0.0];

    public const DarkBackground = [0.165, 0.008, 55.0];

    public const DarkCard = [0.205, 0.009, 55.0];

    public const LightOn = [0.990, 0.005, 80.0];

    private const float DestructiveHue = 18.0;

    private const float MaxChroma = 0.20;

    /**
     * @param  Tokens  $light
     * @param  Tokens  $dark
     * @param  list<Warning>  $warnings
     */
    private function __construct(
        public private(set) array $light,
        public private(set) array $dark,
        public private(set) int $radiusPx,
        public private(set) array $warnings,
    ) {}

    public static function derive(string $hex, int $radiusPx = 10): self
    {
        [$lightness, $chroma, $hue] = self::hexToOklch($hex);
        $chroma = min($chroma, self::MaxChroma);
        $warnings = [];

        if ($chroma < 0.02) {
            $warnings[] = [
                'key' => 'Nearly neutral colour: active states will rely on lightness alone.',
                'replace' => [],
            ];
        }

        $lightPrimaryLightness = self::lightPrimaryLightness($lightness, $chroma, $hue);

        if (abs($lightPrimaryLightness - $lightness) > 0.04) {
            $warnings[] = [
                'key' => 'Too light to carry text: lightness adjusted from :from % to :to % in the light theme.',
                'replace' => [
                    'from' => (int) round($lightness * 100),
                    'to' => (int) round($lightPrimaryLightness * 100),
                ],
            ];
        }

        $hueGap = abs(fmod($hue - self::DestructiveHue + 540.0, 360.0) - 180.0);

        if ($chroma > 0.08 && $hueGap < 25.0) {
            $warnings[] = [
                'key' => 'Hue close to the destructive red: destructive actions keep their icon and label, do not remove them.',
                'replace' => [],
            ];
        }

        return new self(
            self::lightTokens($lightPrimaryLightness, $chroma, $hue),
            self::darkTokens($lightness, $chroma, $hue),
            max(0, min(16, $radiusPx)),
            $warnings,
        );
    }

    public function css(): string
    {
        $radius = $this->radiusPx / 16;
        $light = $this->cssBlock($this->light);
        $dark = $this->cssBlock($this->dark);

        return ":root {\n  --radius: {$radius}rem;\n{$light}\n}\n.dark {\n{$dark}\n}\n";
    }

    /**
     * @return array{
     *     light: array<string, string>,
     *     dark: array<string, string>
     * }
     */
    public function toHex(): array
    {
        return [
            'light' => array_map(self::oklchToHex(...), $this->light),
            'dark' => array_map(self::oklchToHex(...), $this->dark),
        ];
    }

    /**
     * @return array{
     *     light: array{onPrimary: float, primaryOnSurface: float},
     *     dark: array{onPrimary: float, primaryOnSurface: float}
     * }
     */
    public function ratios(): array
    {
        return [
            'light' => [
                'onPrimary' => self::contrast($this->light['primary-foreground'], $this->light['primary']),
                'primaryOnSurface' => self::contrast($this->light['primary'], self::LightBackground),
            ],
            'dark' => [
                'onPrimary' => self::contrast($this->dark['primary-foreground'], $this->dark['primary']),
                'primaryOnSurface' => self::contrast($this->dark['primary'], self::DarkCard),
            ],
        ];
    }

    /**
     * @return Oklch
     */
    public static function hexToOklch(string $hex): array
    {
        $isHex = preg_match('/^#?([0-9a-f]{3}|[0-9a-f]{6})$/iD', $hex, $matches) === 1;
        $digits = $isHex ?
            $matches[1] :
            throw new InvalidArgumentException('The colour must be a 3 or 6 digit hex value.');

        if (strlen($digits) === 3) {
            $digits = $digits[0].$digits[0].$digits[1].$digits[1].$digits[2].$digits[2];
        }

        [$red, $green, $blue] = array_map(
            static function (string $pair): float {
                $channel = hexdec($pair) / 255;

                return $channel <= 0.04045 ? $channel / 12.92 : (($channel + 0.055) / 1.055) ** 2.4;
            },
            str_split($digits, 2),
        );

        $l = (0.4122214708 * $red + 0.5363325363 * $green + 0.0514459929 * $blue) ** (1 / 3);
        $m = (0.2119034982 * $red + 0.6806995451 * $green + 0.1073969566 * $blue) ** (1 / 3);
        $s = (0.0883024619 * $red + 0.2817188376 * $green + 0.6299787005 * $blue) ** (1 / 3);

        $lightness = 0.2104542553 * $l + 0.7936177850 * $m - 0.0040720468 * $s;
        $a = 1.9779984951 * $l - 2.4285922050 * $m + 0.4505937099 * $s;
        $b = 0.0259040371 * $l + 0.7827717662 * $m - 0.8086757660 * $s;
        $hue = rad2deg(atan2($b, $a));

        return [$lightness, sqrt($a * $a + $b * $b), $hue < 0 ? $hue + 360 : $hue];
    }

    /**
     * @param  Oklch  $x
     * @param  Oklch  $y
     */
    public static function contrast(array $x, array $y): float
    {
        $luminanceX = self::luminance($x);
        $luminanceY = self::luminance($y);

        return (max($luminanceX, $luminanceY) + 0.05) / (min($luminanceX, $luminanceY) + 0.05);
    }

    private static function lightPrimaryLightness(float $lightness, float $chroma, float $hue): float
    {
        $primaryLightness = min($lightness, 0.66);

        while ($primaryLightness > 0.25) {
            $primary = [$primaryLightness, $chroma, $hue];

            if (self::contrast(self::LightOn, $primary) >= 4.5 && self::contrast($primary, self::LightBackground) >= 3.0) {
                break;
            }

            $primaryLightness -= 0.005;
        }

        return $primaryLightness;
    }

    /**
     * @return Tokens
     */
    private static function lightTokens(float $primaryLightness, float $chroma, float $hue): array
    {
        $primary = self::fit([$primaryLightness, $chroma, $hue]);
        $soft = self::fit([0.945, min($chroma * 0.25, 0.035), $hue]);
        $text = self::darkenUntil(
            [0.48, min($chroma, 0.14), $hue],
            [$soft, self::LightCard, self::LightBackground],
            4.5,
        );

        return [
            'primary' => $primary,
            'primary-foreground' => self::LightOn,
            'ring' => $primary,
            'sidebar-primary' => $primary,
            'sidebar-primary-foreground' => self::LightOn,
            'sidebar-ring' => $primary,
            'chart-1' => self::fit([min($primaryLightness + 0.04, 0.70), $chroma, $hue]),
            'accent' => self::fit([0.950, min($chroma * 0.2, 0.025), $hue]),
            'skrum-primary-soft' => $soft,
            'skrum-primary-text' => $text,
        ];
    }

    /**
     * @return Tokens
     */
    private static function darkTokens(float $lightness, float $chroma, float $hue): array
    {
        $onPrimary = [0.19, min($chroma, 0.03), $hue];
        $primaryLightness = max(0.68, min(0.80, $lightness + 0.15));

        while ($primaryLightness < 0.95) {
            $primary = [$primaryLightness, $chroma * 0.9, $hue];

            if (self::contrast($onPrimary, $primary) >= 4.5 && self::contrast($primary, self::DarkCard) >= 3.0) {
                break;
            }

            $primaryLightness += 0.005;
        }

        $primary = self::fit([$primaryLightness, $chroma * 0.9, $hue]);
        $soft = self::fit([0.29, min($chroma * 0.35, 0.05), $hue]);
        $text = self::lightenUntil(
            [0.80, min($chroma, 0.11), $hue],
            [$soft, self::DarkCard, self::DarkBackground],
            4.5,
        );

        return [
            'primary' => $primary,
            'primary-foreground' => $onPrimary,
            'ring' => $primary,
            'sidebar-primary' => $primary,
            'sidebar-primary-foreground' => $onPrimary,
            'sidebar-ring' => $primary,
            'chart-1' => $primary,
            'accent' => self::fit([0.290, min($chroma * 0.25, 0.030), $hue]),
            'skrum-primary-soft' => $soft,
            'skrum-primary-text' => $text,
        ];
    }

    /**
     * @param  Tokens  $tokens
     */
    private function cssBlock(array $tokens): string
    {
        $lines = [];

        foreach ($tokens as $name => $color) {
            $lines[] = sprintf('  --%s: oklch(%.3F %.3F %.1F);', $name, $color[0], $color[1], $color[2]);
        }

        return implode("\n", $lines);
    }

    /**
     * @param  Oklch  $color
     * @return array{0: float, 1: float, 2: float, 3: bool}
     */
    private static function toLinear(array $color): array
    {
        [$lightness, $chroma, $hue] = $color;

        $a = $chroma * cos(deg2rad($hue));
        $b = $chroma * sin(deg2rad($hue));

        $l = ($lightness + 0.3963377774 * $a + 0.2158037573 * $b) ** 3;
        $m = ($lightness - 0.1055613458 * $a - 0.0638541728 * $b) ** 3;
        $s = ($lightness - 0.0894841775 * $a - 1.2914855480 * $b) ** 3;

        $rgb = [
            4.0767416621 * $l - 3.3077115913 * $m + 0.2309699292 * $s,
            -1.2684380046 * $l + 2.6097574011 * $m - 0.3413193965 * $s,
            -0.0041960863 * $l - 0.7034186147 * $m + 1.7076147010 * $s,
        ];

        $inGamut = min($rgb) >= -0.002 && max($rgb) <= 1.002;

        return [...array_map(static fn (float $value): float => max(0.0, min(1.0, $value)), $rgb), $inGamut];
    }

    /**
     * @param  Oklch  $color
     * @return Oklch
     */
    private static function fit(array $color): array
    {
        while ($color[1] > 0 && ! self::toLinear($color)[3]) {
            $color[1] = max(0.0, $color[1] - 0.002);
        }

        return $color;
    }

    /**
     * @param  Oklch  $color
     */
    private static function luminance(array $color): float
    {
        [$red, $green, $blue] = self::toLinear(self::fit($color));

        return 0.2126 * $red + 0.7152 * $green + 0.0722 * $blue;
    }

    /**
     * @param  Oklch  $color
     */
    public static function oklchToHex(array $color): string
    {
        [$red, $green, $blue] = self::toLinear(self::fit($color));

        $encode = static function (float $channel): string {
            $encoded = $channel <= 0.0031308 ? 12.92 * $channel : 1.055 * $channel ** (1 / 2.4) - 0.055;

            return sprintf('%02x', (int) round($encoded * 255));
        };

        return "#{$encode($red)}{$encode($green)}{$encode($blue)}";
    }

    /**
     * @param  Oklch  $color
     * @param  non-empty-list<Oklch>  $grounds
     * @return Oklch
     */
    private static function darkenUntil(array $color, array $grounds, float $minimum): array
    {
        while ($color[0] > 0.2 && self::lowestContrast($color, $grounds) < $minimum) {
            $color[0] -= 0.005;
        }

        return self::fit($color);
    }

    /**
     * @param  Oklch  $color
     * @param  non-empty-list<Oklch>  $grounds
     * @return Oklch
     */
    private static function lightenUntil(array $color, array $grounds, float $minimum): array
    {
        while ($color[0] < 0.97 && self::lowestContrast($color, $grounds) < $minimum) {
            $color[0] += 0.005;
        }

        return self::fit($color);
    }

    /**
     * @param  Oklch  $color
     * @param  non-empty-list<Oklch>  $grounds
     */
    private static function lowestContrast(array $color, array $grounds): float
    {
        return min(array_map(static fn (array $ground): float => self::contrast($color, $ground), $grounds));
    }
}
