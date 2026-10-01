<?php

declare(strict_types=1);

namespace App\Support\Branding;

/**
 * Skrüm white-label — dérive les tokens de marque d'une couleur admin en garantissant les contrastes.
 *
 *   $p = BrandPalette::derive('#2B63B0', radiusPx: 8);
 *   $p->css();       // <style id="skrum-brand"> à injecter après app.css (cachez-le par instance)
 *   $p->warnings;    // messages à afficher dans l'admin (ajustements, proximité avec les couleurs d'état)
 *
 * Garanties (WCAG 2.x) : primary-foreground/primary ≥ 4.5:1, primary/background ≥ 3:1 (focus, bordures actives),
 * skrum-primary-text ≥ 4.5:1 sur skrum-primary-soft, card et background — dans les DEUX thèmes.
 */
final class BrandPalette
{
    private const LIGHT_BG = [0.985, 0.004, 80.0];

    private const LIGHT_CARD = [1.0, 0.0, 0.0];

    private const DARK_BG = [0.165, 0.008, 55.0];

    private const DARK_CARD = [0.205, 0.009, 55.0];

    private const LIGHT_ON = [0.990, 0.005, 80.0];

    private const DESTRUCTIVE_HUE = 18.0;

    /** @param array<string,array{0:float,1:float,2:float}> $light @param array<string,array{0:float,1:float,2:float}> $dark @param list<string> $warnings */
    private function __construct(public readonly array $light, public readonly array $dark, public readonly int $radiusPx, public readonly array $warnings) {}

    public static function derive(string $hex, int $radiusPx = 10): self
    {
        [$L, $C, $H] = self::hexToOklch($hex);
        $warnings = [];
        $C = min($C, 0.20);
        if ($C < 0.02) {
            $warnings[] = 'Couleur quasi neutre : les états actifs reposeront sur la luminosité seule.';
        }

        // ---- clair : primary assez sombre pour un texte clair (≥ 4.5) et visible sur le fond (≥ 3)
        $pL = min($L, 0.66);
        while ($pL > 0.25 && (self::contrast(self::LIGHT_ON, [$pL, $C, $H]) < 4.5 || self::contrast([$pL, $C, $H], self::LIGHT_BG) < 3.0)) {
            $pL -= 0.005;
        }
        if (abs($pL - $L) > 0.04) {
            $warnings[] = sprintf('Trop claire pour porter du texte : luminosité ajustée de %d %% à %d %% en thème clair.', (int) round($L * 100), (int) round($pL * 100));
        }
        $primary = self::fit([$pL, $C, $H]);
        $soft = self::fit([0.945, min($C * 0.25, 0.035), $H]);
        $text = self::darkenUntil([0.48, min($C, 0.14), $H], [$soft, self::LIGHT_CARD, self::LIGHT_BG], 4.5);

        // ---- sombre : primary clair, texte foncé dessus
        $dL = max(0.68, min(0.80, $L + 0.15));
        $onDark = [0.19, min($C, 0.03), $H];
        while ($dL < 0.95 && (self::contrast($onDark, [$dL, $C * 0.9, $H]) < 4.5 || self::contrast([$dL, $C * 0.9, $H], self::DARK_CARD) < 3.0)) {
            $dL += 0.005;
        }
        $dPrimary = self::fit([$dL, $C * 0.9, $H]);
        $dSoft = self::fit([0.29, min($C * 0.35, 0.05), $H]);
        $dText = self::lightenUntil([0.80, min($C, 0.11), $H], [$dSoft, self::DARK_CARD, self::DARK_BG], 4.5);

        // ---- garde-fous sémantiques
        $hueGap = abs(fmod($H - self::DESTRUCTIVE_HUE + 540.0, 360.0) - 180.0);
        if ($C > 0.08 && $hueGap < 25.0) {
            $warnings[] = 'Teinte proche du rouge « destructive » : les actions destructives gardent leur icône et leur libellé, ne les retirez pas.';
        }

        $light = [
            'primary' => $primary, 'primary-foreground' => self::LIGHT_ON, 'ring' => $primary,
            'sidebar-primary' => $primary, 'sidebar-primary-foreground' => self::LIGHT_ON, 'sidebar-ring' => $primary,
            'chart-1' => self::fit([min($pL + 0.04, 0.70), $C, $H]),
            'accent' => self::fit([0.950, min($C * 0.2, 0.025), $H]),
            'skrum-primary-soft' => $soft, 'skrum-primary-text' => $text,
        ];
        $dark = [
            'primary' => $dPrimary, 'primary-foreground' => $onDark, 'ring' => $dPrimary,
            'sidebar-primary' => $dPrimary, 'sidebar-primary-foreground' => $onDark, 'sidebar-ring' => $dPrimary,
            'chart-1' => $dPrimary,
            'accent' => self::fit([0.290, min($C * 0.25, 0.030), $H]),
            'skrum-primary-soft' => $dSoft, 'skrum-primary-text' => $dText,
        ];

        return new self($light, $dark, max(0, min(16, $radiusPx)), $warnings);
    }

    public function css(): string
    {
        $block = static fn (array $vars): string => implode("\n", array_map(
            static fn (string $k, array $v): string => sprintf('  --%s: oklch(%.3f %.3f %.1f);', $k, $v[0], $v[1], $v[2]),
            array_keys($vars), $vars,
        ));

        return ":root {\n  --radius: ".($this->radiusPx / 16)."rem;\n".$block($this->light)."\n}\n.dark {\n".$block($this->dark)."\n}\n";
    }

    // ------------------------------------------------------------------ colour maths (OKLCH ⇄ sRGB, WCAG)

    /** @return array{0:float,1:float,2:float} */
    public static function hexToOklch(string $hex): array
    {
        $hex = ltrim(trim($hex), '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }
        if (! preg_match('/^[0-9a-f]{6}$/i', $hex)) {
            throw new \InvalidArgumentException("Couleur invalide : #{$hex}");
        }
        $lin = static function (int $c): float {
            $c /= 255;

            return $c <= 0.04045 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
        };
        [$r, $g, $b] = array_map($lin, array_map('hexdec', str_split($hex, 2)));
        $l = (0.4122214708 * $r + 0.5363325363 * $g + 0.0514459929 * $b) ** (1 / 3);
        $m = (0.2119034982 * $r + 0.6806995451 * $g + 0.1073969566 * $b) ** (1 / 3);
        $s = (0.0883024619 * $r + 0.2817188376 * $g + 0.6299787005 * $b) ** (1 / 3);
        $L = 0.2104542553 * $l + 0.7936177850 * $m - 0.0040720468 * $s;
        $a = 1.9779984951 * $l - 2.4285922050 * $m + 0.4505937099 * $s;
        $bb = 0.0259040371 * $l + 0.7827717662 * $m - 0.8086757660 * $s;
        $H = rad2deg(atan2($bb, $a));

        return [$L, sqrt($a * $a + $bb * $bb), $H < 0 ? $H + 360 : $H];
    }

    /** @param array{0:float,1:float,2:float} $c @return array{0:float,1:float,2:float,3:bool} linear sRGB + in-gamut flag */
    private static function toLinear(array $c): array
    {
        [$L, $C, $H] = $c;
        $a = $C * cos(deg2rad($H));
        $b = $C * sin(deg2rad($H));
        $l = ($L + 0.3963377774 * $a + 0.2158037573 * $b) ** 3;
        $m = ($L - 0.1055613458 * $a - 0.0638541728 * $b) ** 3;
        $s = ($L - 0.0894841775 * $a - 1.2914855480 * $b) ** 3;
        $rgb = [
            4.0767416621 * $l - 3.3077115913 * $m + 0.2309699292 * $s,
            -1.2684380046 * $l + 2.6097574011 * $m - 0.3413193965 * $s,
            -0.0041960863 * $l - 0.7034186147 * $m + 1.7076147010 * $s,
        ];
        $in = min($rgb) >= -0.002 && max($rgb) <= 1.002;

        return [...array_map(static fn (float $x): float => max(0.0, min(1.0, $x)), $rgb), $in];
    }

    /** Réduit la chroma jusqu'à rentrer dans sRGB (évite l'écrêtage navigateur qui fausse les contrastes). */
    private static function fit(array $c): array
    {
        while ($c[1] > 0 && ! self::toLinear($c)[3]) {
            $c[1] = max(0.0, $c[1] - 0.002);
        }

        return $c;
    }

    public static function contrast(array $x, array $y): float
    {
        $lum = static function (array $c): float {
            [$r, $g, $b] = self::toLinear(self::fit($c));

            return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b;
        };
        [$hi, $lo] = [max($lum($x), $lum($y)), min($lum($x), $lum($y))];

        return ($hi + 0.05) / ($lo + 0.05);
    }

    private static function darkenUntil(array $c, array $grounds, float $min): array
    {
        while ($c[0] > 0.2 && min(array_map(static fn ($g) => self::contrast($c, $g), $grounds)) < $min) {
            $c[0] -= 0.005;
        }

        return self::fit($c);
    }

    private static function lightenUntil(array $c, array $grounds, float $min): array
    {
        while ($c[0] < 0.97 && min(array_map(static fn ($g) => self::contrast($c, $g), $grounds)) < $min) {
            $c[0] += 0.005;
        }

        return self::fit($c);
    }
}
