# White-label (self-host)

Un admin d'instance peut rebrander Skrüm **sans pouvoir casser l'accessibilité**. Principe : l'admin choisit, le serveur dérive et vérifie, l'app n'applique que des valeurs garanties.

## Ce qu'un admin peut changer

| Réglage | Où | Contraintes |
| --- | --- | --- |
| Couleur de marque | Admin › Branding | n'importe quel hex ; dérivations et contrastes automatiques |
| Logo (clair + sombre) | Admin › Branding | SVG ou PNG ≥ 128 px, affiché à 28 px (sidebar) et 48 px (auth) ; le logo sombre est optionnel (sinon logo clair sur pastille `card`) |
| Favicon | Admin › Branding | SVG ou PNG 32 px |
| Style d'avatar | Admin › Branding | un style DiceBear parmi la collection (défaut Notionists, CC0) ; option « les membres peuvent choisir » ; attribution automatique pour les styles CC BY |
| Rayon | Admin › Branding | `--radius` de 0 à 16 px (défaut 10) |
| Nom affiché | Admin › Branding | remplace « Skrüm » dans le titre, les e-mails, l'écran d'auth |
| « Propulsé par Skrüm » | Admin › Branding | masquable |
| Palette des colonnes par défaut | Paramètres d'équipe | choix parmi les 8 couleurs, jamais de couleur libre |

**Ne sont pas modifiables** : neutres (`background`, `foreground`, `card`, `muted`, `border`, `input`), couleurs d'état (`destructive`, `skrum-success/warning/info`), couleurs de colonnes, de présence et ROTI, typographie. Ce sont elles qui portent la lisibilité et le sens.

## Dérivations automatiques

À partir de la couleur saisie, convertie en OKLCH `(L, C, H)` :

| Token | Thème clair | Thème sombre |
| --- | --- | --- |
| `primary` | `L` abaissée jusqu'à ≥ 4.5:1 avec `primary-foreground` **et** ≥ 3:1 sur `background` ; `C ≤ 0.20` | `L = clamp(L + 0.15, 0.68, 0.80)`, relevée jusqu'à ≥ 4.5:1 avec le texte foncé ; `C × 0.9` |
| `primary-foreground` | `oklch(0.99 0.005 80)` | `oklch(0.19 min(C, 0.03) H)` |
| `ring`, `sidebar-primary`, `sidebar-ring` | = `primary` | = `primary` |
| `chart-1` | `primary` + 0.04 de L | = `primary` |
| `accent` | `oklch(0.95 min(C×0.2, 0.025) H)` | `oklch(0.29 min(C×0.25, 0.03) H)` |
| `skrum-primary-soft` | `oklch(0.945 min(C×0.25, 0.035) H)` | `oklch(0.29 min(C×0.35, 0.05) H)` |
| `skrum-primary-text` | `L` 0.48 abaissée jusqu'à ≥ 4.5:1 sur soft, card, background | `L` 0.80 relevée jusqu'à ≥ 4.5:1 |

Chaque valeur est ensuite ramenée dans le gamut sRGB en réduisant la chroma (sinon le navigateur écrête et fausse le contraste).

## Garde-fous affichés dans l'admin

- **Ajustement de luminosité** : « Trop claire pour porter du texte : luminosité ajustée de 88 % à 56 % en thème clair. » L'aperçu montre la valeur saisie ET la valeur appliquée.
- **Proximité avec le rouge d'erreur** (teinte à moins de 25° de `destructive` et chroma > 0.08) : avertissement ; les actions destructives gardent icône + libellé.
- **Couleur quasi neutre** (C < 0.02) : accepté, avertissement que l'état actif ne tient qu'à la luminosité.
- **Aperçu live** : bouton primaire, badge, carte sélectionnée, focus ring, en clair ET en sombre, avec le ratio de contraste affiché (« AA 5,8:1 »).
- Le rayon est borné à 0–16 px ; au-delà les PokerCard et colonnes perdent leur forme.

## Implémentation Laravel

1. `BrandPalette::derive($hex, $radius)` (ci-dessous) à l'enregistrement du réglage ; on stocke le CSS généré et les avertissements (table `instance_settings`, cache `skrum.brand.css`).
2. `resources/views/app.blade.php` : `<style id="skrum-brand">{!! $brandCss !!}</style>` **après** `@vite('resources/css/app.css')`.
3. Tests Pest : pour une liste de couleurs (jaune pur, vert fluo, gris, noir, rouge…), vérifier `contrast(primary-foreground, primary) ≥ 4.5` et `contrast(primary, background) ≥ 3` dans les deux thèmes.
4. Invalidation : Octane/FrankenPHP → vider le cache de config à la sauvegarde ; le CSS étant dans le HTML, pas de rebuild Vite.

```php
<?php

declare(strict_types=1);

namespace App\Support\Branding;

final class BrandPalette
{
    private const LIGHT_BG = [0.985, 0.004, 80.0];
    private const LIGHT_CARD = [1.0, 0.0, 0.0];
    private const DARK_BG = [0.165, 0.008, 55.0];
    private const DARK_CARD = [0.205, 0.009, 55.0];
    private const LIGHT_ON = [0.990, 0.005, 80.0];
    private const DESTRUCTIVE_HUE = 18.0;

    private function __construct(public readonly array $light, public readonly array $dark, public readonly int $radiusPx, public readonly array $warnings) {}

    public static function derive(string $hex, int $radiusPx = 10): self
    {
        [$L, $C, $H] = self::hexToOklch($hex);
        $warnings = [];
        $C = min($C, 0.20);
        if ($C < 0.02) {
            $warnings[] = 'Couleur quasi neutre : les états actifs reposeront sur la luminosité seule.';
        }

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

        $dL = max(0.68, min(0.80, $L + 0.15));
        $onDark = [0.19, min($C, 0.03), $H];
        while ($dL < 0.95 && (self::contrast($onDark, [$dL, $C * 0.9, $H]) < 4.5 || self::contrast([$dL, $C * 0.9, $H], self::DARK_CARD) < 3.0)) {
            $dL += 0.005;
        }
        $dPrimary = self::fit([$dL, $C * 0.9, $H]);
        $dSoft = self::fit([0.29, min($C * 0.35, 0.05), $H]);
        $dText = self::lightenUntil([0.80, min($C, 0.11), $H], [$dSoft, self::DARK_CARD, self::DARK_BG], 4.5);

        $hueGap = abs(fmod($H - self::DESTRUCTIVE_HUE + 540.0, 360.0) - 180.0);
        if ($C > 0.08 && $hueGap < 25.0) {
            $warnings[] = 'Teinte proche du rouge « destructive » : les actions destructives gardent leur icône et leur libellé.';
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

        return ":root {\n  --radius: " . ($this->radiusPx / 16) . "rem;\n" . $block($this->light) . "\n}\n.dark {\n" . $block($this->dark) . "\n}\n";
    }

    public static function hexToOklch(string $hex): array
    {
        $hex = ltrim(trim($hex), '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
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
```

Résultats de référence (vérifiés) : `#2B63B0` → clair 5,8:1 / sombre 6,4:1 sans ajustement ; `#FFD600` → abaissée à L 0,56 (4,5:1) avec avertissement ; `#0a0a0a` → accepté, avertissement « quasi neutre ».
