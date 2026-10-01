<?php

namespace App\Actions\Whiteboards;

/**
 * What the template gallery draws: the outline of each element, without any
 * text, moved so that the scene starts at 0,0.
 *
 * @phpstan-type Shape array{
 *     kind: string,
 *     x: int,
 *     y: int,
 *     width: int,
 *     height: int,
 *     fill: ?string,
 *     stroke: ?string,
 *     points: list<array{0: int, 1: int}>
 * }
 * @phpstan-type Preview array{width: int, height: int, shapes: list<Shape>}
 */
class PresentWhiteboardPreview
{
    public const MaxShapes = 300;

    private const MaxPoints = 24;

    private const Kinds = [
        'rectangle' => 'rect',
        'image' => 'rect',
        'frame' => 'rect',
        'ellipse' => 'ellipse',
        'diamond' => 'diamond',
        'line' => 'path',
        'arrow' => 'path',
        'freedraw' => 'path',
        'text' => 'text',
    ];

    private const ColorPattern = '/^#[0-9a-fA-F]{3,8}$/';

    /**
     * @param  array<int, array<string, mixed>>  $elements  in canvas order
     * @return Preview
     */
    public function handle(array $elements): array
    {
        $shapes = [];

        foreach ($elements as $element) {
            if (count($shapes) === self::MaxShapes) {
                break;
            }

            $shape = $this->shape($element);

            if ($shape !== null) {
                $shapes[] = $shape;
            }
        }

        if ($shapes === []) {
            return ['width' => 0, 'height' => 0, 'shapes' => []];
        }

        $left = min(array_column($shapes, 'x'));
        $top = min(array_column($shapes, 'y'));

        $shapes = array_map(fn (array $shape): array => [
            ...$shape,
            'x' => $shape['x'] - $left,
            'y' => $shape['y'] - $top,
            'points' => array_map(fn (array $point): array => [$point[0] - $left, $point[1] - $top], $shape['points']),
        ], $shapes);

        return [
            'width' => max(1, max(array_map(fn (array $shape): int => $shape['x'] + $shape['width'], $shapes))),
            'height' => max(1, max(array_map(fn (array $shape): int => $shape['y'] + $shape['height'], $shapes))),
            'shapes' => $shapes,
        ];
    }

    /**
     * @param  array<string, mixed>  $element
     * @return Shape|null
     */
    private function shape(array $element): ?array
    {
        $kind = self::Kinds[$element['type'] ?? ''] ?? null;

        if ($kind === null || ($element['isDeleted'] ?? false) || ($element['containerId'] ?? null) !== null) {
            return null;
        }

        $points = $kind === 'path' ? $this->points($element) : [];
        $xs = $points === [] ? [(int) round($element['x']), (int) round($element['x'] + $element['width'])] : array_column($points, 0);
        $ys = $points === [] ? [(int) round($element['y']), (int) round($element['y'] + $element['height'])] : array_column($points, 1);

        return [
            'kind' => $kind,
            'x' => min($xs),
            'y' => min($ys),
            'width' => max($xs) - min($xs),
            'height' => max($ys) - min($ys),
            'fill' => $this->color($element['backgroundColor'] ?? null),
            'stroke' => $this->color($element['strokeColor'] ?? null),
            'points' => $points,
        ];
    }

    /**
     * @param  array<string, mixed>  $element
     * @return list<array{0: int, 1: int}>
     */
    private function points(array $element): array
    {
        $points = $element['points'] ?? [];
        $step = max(1, (int) ceil(count($points) / self::MaxPoints));
        $kept = [];

        foreach ($points as $position => $point) {
            if ($position % $step === 0 || $position === count($points) - 1) {
                $kept[] = [(int) round($element['x'] + $point[0]), (int) round($element['y'] + $point[1])];
            }
        }

        return $kept;
    }

    private function color(mixed $color): ?string
    {
        if (! is_string($color) || preg_match(self::ColorPattern, $color) !== 1) {
            return null;
        }

        return $color;
    }
}
