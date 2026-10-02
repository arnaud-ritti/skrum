<?php

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
