<?php

use App\Support\Branding\BrandPalette;

/**
 * @return array<string, string>
 */
function customPropertiesOfFirstBlock(string $stylesheet, string $selector): array
{
    preg_match('/^'.preg_quote($selector, '/').'\s*\{(.*?)^\}/ms', $stylesheet, $block);

    $declarations = preg_replace('#/\*.*?\*/#s', '', $block[1] ?? '');

    preg_match_all('/(--[\w-]+)\s*:\s*([^;]+);/', $declarations, $properties);

    return array_map(
        fn (string $value): string => preg_replace('/\s+/', ' ', trim($value)),
        array_combine($properties[1], $properties[2]),
    );
}

it('gives the light scope every light token of the root, with the same value', function () {
    $stylesheet = file_get_contents(resource_path('css/app.css'));

    $root = customPropertiesOfFirstBlock($stylesheet, ':root');
    $light = customPropertiesOfFirstBlock($stylesheet, '.light');

    unset($root['--radius']);

    expect($root)->not->toBeEmpty()
        ->and($root)->toHaveKeys(['--background', '--foreground', '--primary'])
        ->and($light)->toBe($root);
});

it('leaves the radius of the instance to the root', function () {
    $light = customPropertiesOfFirstBlock(file_get_contents(resource_path('css/app.css')), '.light');

    expect($light)->not->toHaveKey('--radius');
});

/**
 * @param  array<string, string>  $tokens
 * @return array{0: float, 1: float, 2: float}
 */
function oklchOfToken(array $tokens, string $name): array
{
    $value = $tokens["--{$name}"] ?? '';

    while (preg_match('/^var\((--[\w-]+)\)$/', $value, $reference) === 1) {
        $value = $tokens[$reference[1]] ?? '';
    }

    throw_unless(
        preg_match('/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/', $value, $parts) === 1,
        RuntimeException::class,
        "--{$name} is not an oklch colour.",
    );

    return [(float) $parts[1], (float) $parts[2], (float) $parts[3]];
}

dataset('tokenContrasts', function () {
    $pairs = [
        ['foreground', 'background', 7.0],
        ['foreground', 'card', 7.0],
        ['popover-foreground', 'popover', 7.0],
        ['accent-foreground', 'accent', 7.0],
        ['muted-foreground', 'background', 4.5],
        ['muted-foreground', 'card', 4.5],
        ['muted-foreground', 'muted', 4.5],
        ['secondary-foreground', 'secondary', 4.5],
        ['primary-foreground', 'primary', 4.5],
        ['destructive-foreground', 'destructive', 4.5],
        ['input', 'background', 3.0],
        ['input', 'card', 3.0],
        ['ring', 'background', 3.0],
        ['ring', 'card', 3.0],
    ];

    foreach ([':root', '.dark'] as $scope) {
        foreach ($pairs as [$text, $ground, $minimum]) {
            yield "{$scope}: {$text} on {$ground}" => [$scope, $text, $ground, $minimum];
        }
    }
});

it('keeps the contrast the rules ask for: AAA for body text, AA for secondary text, 3:1 for controls', function (string $scope, string $text, string $ground, float $minimum) {
    $tokens = customPropertiesOfFirstBlock(file_get_contents(resource_path('css/app.css')), $scope);

    expect(BrandPalette::contrast(oklchOfToken($tokens, $text), oklchOfToken($tokens, $ground)))->toBeGreaterThanOrEqual($minimum);
})->with('tokenContrasts');
