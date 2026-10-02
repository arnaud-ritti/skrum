<?php

use App\Support\Branding\BrandPalette;
use App\Support\Games\DrawingOp;
use Illuminate\Validation\ValidationException;

const InkThemeColors = ['sun', 'apricot', 'coral', 'plum', 'iris', 'sky', 'lagoon', 'moss'];

it('accepts a stroke and a fill in every offered ink and every legacy ink', function (string $color) {
    $stroke = DrawingOp::parse(['type' => 'stroke', 'color' => $color, 'size' => 10, 'points' => [[1, 1]]]);
    $fill = DrawingOp::parse(['type' => 'fill', 'color' => $color, 'x' => 5, 'y' => 5]);

    expect($stroke['color'])->toBe($color)
        ->and($fill['color'])->toBe($color);
})->with([...DrawingOp::Colors, ...DrawingOp::LegacyColors]);

it('offers black, the eight theme colours and the eraser white', function () {
    expect(DrawingOp::Colors)->toBe(['black', ...InkThemeColors, 'white'])
        ->and(DrawingOp::LegacyColors)->toBe(['red', 'orange', 'green', 'blue', 'purple']);
});

it('refuses an unknown ink', function () {
    DrawingOp::parse(['type' => 'fill', 'color' => 'pink', 'x' => 1, 'y' => 1]);
})->throws(ValidationException::class);

it('keeps the ink literals of the front end equal to the light theme text tokens', function (string $name) {
    $css = file_get_contents(resource_path('css/app.css'));
    $script = file_get_contents(resource_path('js/lib/games/drawing.ts'));

    preg_match("/--skrum-col-{$name}-text:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)/", $css, $token);
    preg_match("/\\['{$name}',\\s*\\[(\\d+),\\s*(\\d+),\\s*(\\d+)\\]\\]/", $script, $literal);

    expect($token)->toHaveCount(4)
        ->and($literal)->toHaveCount(4);

    $expected = BrandPalette::oklchToHex([(float) $token[1], (float) $token[2], (float) $token[3]]);
    $actual = sprintf('#%02x%02x%02x', $literal[1], $literal[2], $literal[3]);

    expect($actual)->toBe($expected);
})->with(InkThemeColors);
