<?php

use App\Support\Branding\BrandPalette;

dataset('brandColours', ['#FFD600', '#22c55e', '#777777', '#0a0a0a', '#e11d48', '#2B63B0']);

function brandSweepColours(): array
{
    $colours = [];

    foreach (range(0, 345, 15) as $hue) {
        foreach ([0.30, 0.50, 0.70, 0.88] as $lightness) {
            foreach ([0.03, 0.12, 0.30] as $chroma) {
                $colours[] = sweepHex($lightness, $chroma, (float) $hue);
            }
        }
    }

    foreach (range(0, 255, 17) as $grey) {
        $colours[] = sprintf('#%02x%02x%02x', $grey, $grey, $grey);
    }

    return $colours;
}

function sweepHex(float $lightness, float $chroma, float $hue): string
{
    $a = $chroma * cos(deg2rad($hue));
    $b = $chroma * sin(deg2rad($hue));
    $l = ($lightness + 0.3963377774 * $a + 0.2158037573 * $b) ** 3;
    $m = ($lightness - 0.1055613458 * $a - 0.0638541728 * $b) ** 3;
    $s = ($lightness - 0.0894841775 * $a - 1.2914855480 * $b) ** 3;
    $linear = [
        4.0767416621 * $l - 3.3077115913 * $m + 0.2309699292 * $s,
        -1.2684380046 * $l + 2.6097574011 * $m - 0.3413193965 * $s,
        -0.0041960863 * $l - 0.7034186147 * $m + 1.7076147010 * $s,
    ];

    return '#'.implode('', array_map(function (float $value): string {
        $value = max(0.0, min(1.0, $value));
        $encoded = $value <= 0.0031308 ? 12.92 * $value : 1.055 * $value ** (1 / 2.4) - 0.055;

        return sprintf('%02x', (int) round($encoded * 255));
    }, $linear));
}

it('keeps the sweep wide enough', function () {
    expect(count(brandSweepColours()))->toBeGreaterThanOrEqual(200);
});

it('keeps text readable on primary in both themes', function (string $hex) {
    $palette = BrandPalette::derive($hex);

    expect(BrandPalette::contrast($palette->light['primary-foreground'], $palette->light['primary']))->toBeGreaterThanOrEqual(4.5)
        ->and(BrandPalette::contrast($palette->dark['primary-foreground'], $palette->dark['primary']))->toBeGreaterThanOrEqual(4.5);
})->with('brandColours');

it('keeps primary visible on its ground in both themes', function (string $hex) {
    $palette = BrandPalette::derive($hex);

    expect(BrandPalette::contrast($palette->light['primary'], BrandPalette::LightBackground))->toBeGreaterThanOrEqual(3.0)
        ->and(BrandPalette::contrast($palette->dark['primary'], BrandPalette::DarkCard))->toBeGreaterThanOrEqual(3.0);
})->with('brandColours');

it('keeps the primary text readable on soft, card and background', function (string $hex) {
    $palette = BrandPalette::derive($hex);

    foreach ([
        [$palette->light, [$palette->light['skrum-primary-soft'], BrandPalette::LightCard, BrandPalette::LightBackground]],
        [$palette->dark, [$palette->dark['skrum-primary-soft'], BrandPalette::DarkCard, BrandPalette::DarkBackground]],
    ] as [$theme, $grounds]) {
        foreach ($grounds as $ground) {
            expect(BrandPalette::contrast($theme['skrum-primary-text'], $ground))->toBeGreaterThanOrEqual(4.5);
        }
    }
})->with('brandColours');

it('holds every floor across a deterministic sweep of colours', function () {
    foreach (brandSweepColours() as $hex) {
        $palette = BrandPalette::derive($hex);

        expect(BrandPalette::contrast($palette->light['primary-foreground'], $palette->light['primary']))->toBeGreaterThanOrEqual(4.5, $hex)
            ->and(BrandPalette::contrast($palette->light['primary'], BrandPalette::LightBackground))->toBeGreaterThanOrEqual(3.0, $hex)
            ->and(BrandPalette::contrast($palette->dark['primary-foreground'], $palette->dark['primary']))->toBeGreaterThanOrEqual(4.5, $hex)
            ->and(BrandPalette::contrast($palette->dark['primary'], BrandPalette::DarkCard))->toBeGreaterThanOrEqual(3.0, $hex);
    }
});

it('accepts the blue of the design system without adjusting it', function () {
    $palette = BrandPalette::derive('#2B63B0', radiusPx: 8);
    $ratios = $palette->ratios();

    expect($palette->warnings)->toBeEmpty()
        ->and($ratios['light']['onPrimary'])->toEqualWithDelta(5.8, 0.1)
        ->and($ratios['dark']['onPrimary'])->toEqualWithDelta(6.4, 0.1);
});

it('lowers a yellow too light to carry text and says so', function () {
    $palette = BrandPalette::derive('#FFD600');

    expect($palette->light['primary'][0])->toEqualWithDelta(0.56, 0.02)
        ->and($palette->warnings)->toHaveCount(1)
        ->and($palette->warnings[0]['key'])->toBe('Too light to carry text: lightness adjusted from :from % to :to % in the light theme.')
        ->and($palette->warnings[0]['replace']['from'])->toBeGreaterThan($palette->warnings[0]['replace']['to']);
});

it('accepts a near black colour with the near neutral warning', function () {
    $palette = BrandPalette::derive('#0a0a0a');

    expect(array_column($palette->warnings, 'key'))->toContain('Nearly neutral colour: active states will rely on lightness alone.');
});

it('warns when the hue is close to the destructive red', function () {
    $keys = array_column(BrandPalette::derive('#e11d48')->warnings, 'key');

    expect($keys)->toContain('Hue close to the destructive red: destructive actions keep their icon and label, do not remove them.');
});

it('does not warn about destructive proximity for a blue', function () {
    $keys = array_column(BrandPalette::derive('#2B63B0')->warnings, 'key');

    expect($keys)->not->toContain('Hue close to the destructive red: destructive actions keep their icon and label, do not remove them.');
});

it('expands three digit hex and does not require the hash', function () {
    expect(BrandPalette::derive('f80')->css())->toBe(BrandPalette::derive('#ff8800')->css());
});

it('rejects anything that is not a hex colour', function (string $input) {
    BrandPalette::derive($input);
})->with(['', 'red', '#12', '#gggggg', '"><script>', '##fff', "#fff\n", '#ffff', '#fffffff'])->throws(InvalidArgumentException::class);

it('clamps the radius between 0 and 16', function (int $given, int $expected, string $rem) {
    $palette = BrandPalette::derive('#2B63B0', radiusPx: $given);

    expect($palette->radiusPx)->toBe($expected)
        ->and($palette->css())->toContain("--radius: {$rem};");
})->with([
    [-5, 0, '0rem'],
    [40, 16, '1rem'],
    [10, 10, '0.625rem'],
]);

it('emits only numbers produced by the class in the css', function (string $hex) {
    $css = BrandPalette::derive($hex)->css();
    $number = '-?\d+(?:\.\d+)?';
    $lines = explode("\n", rtrim($css, "\n"));

    expect($lines[0])->toBe(':root {')
        ->and($lines[1])->toMatch("/^  --radius: {$number}rem;$/")
        ->and(array_slice($lines, 2))->each->toMatch("/^(  --[a-z0-9-]+: oklch\\({$number} {$number} {$number}\\);|\\}|\\.dark \\{)$/")
        ->and(substr_count($css, '{'))->toBe(2)
        ->and(substr_count($css, '}'))->toBe(2);
})->with('brandColours');

it('exports the same tokens as hex for both themes', function (string $hex) {
    $palette = BrandPalette::derive($hex);
    $exported = $palette->toHex();

    expect(array_keys($exported))->toBe(['light', 'dark'])
        ->and(array_keys($exported['light']))->toBe(array_keys($palette->light))
        ->and(array_keys($exported['dark']))->toBe(array_keys($palette->dark))->and([...$exported['light'], ...$exported['dark']])->each->toMatch('/^#[0-9a-f]{6}$/');
})->with('brandColours');

it('keeps the contrast through the hex round trip', function (string $hex) {
    $palette = BrandPalette::derive($hex);
    $exported = $palette->toHex();

    foreach (['light' => BrandPalette::LightBackground, 'dark' => BrandPalette::DarkCard] as $theme => $ground) {
        $original = BrandPalette::contrast($palette->{$theme}['primary-foreground'], $palette->{$theme}['primary']);
        $rounded = BrandPalette::contrast(
            BrandPalette::hexToOklch($exported[$theme]['primary-foreground']),
            BrandPalette::hexToOklch($exported[$theme]['primary']),
        );

        expect($rounded)->toEqualWithDelta($original, 0.15);

        $original = BrandPalette::contrast($palette->{$theme}['primary'], $ground);
        $rounded = BrandPalette::contrast(BrandPalette::hexToOklch($exported[$theme]['primary']), $ground);

        expect($rounded)->toEqualWithDelta($original, 0.15);
    }
})->with('brandColours');

it('reports the two ratios of each theme', function () {
    $ratios = BrandPalette::derive('#2B63B0')->ratios();

    expect(array_keys($ratios))->toBe(['light', 'dark'])
        ->and(array_keys($ratios['light']))->toBe(['onPrimary', 'primaryOnBackground'])
        ->and($ratios['light']['primaryOnBackground'])->toBeGreaterThanOrEqual(3.0)
        ->and($ratios['dark']['primaryOnBackground'])->toBeGreaterThanOrEqual(3.0);
});

it('defines every warning key in every locale', function (string $locale) {
    $translations = json_decode(file_get_contents(dirname(__DIR__, 3)."/lang/{$locale}.json"), true);
    $keys = [];

    foreach (['#FFD600', '#0a0a0a', '#e11d48'] as $hex) {
        array_push($keys, ...array_column(BrandPalette::derive($hex)->warnings, 'key'));
    }

    expect(array_unique($keys))->toHaveCount(3)
        ->and(array_diff($keys, array_keys($translations)))->toBeEmpty();
})->with(['en', 'fr', 'es', 'de']);
