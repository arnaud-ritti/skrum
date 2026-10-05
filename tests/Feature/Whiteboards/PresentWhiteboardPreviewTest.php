<?php

use App\Actions\Whiteboards\PresentWhiteboardPreview;

it('outlines a scene from its top-left corner, without any text', function () {
    $preview = resolve(PresentWhiteboardPreview::class)->handle([
        sceneElement(['id' => 'zone', 'type' => 'frame', 'x' => -100, 'y' => 50, 'width' => 400, 'height' => 300, 'name' => 'Secret zone']),
        sceneElement(['id' => 'note', 'x' => -60.4, 'y' => 90.6, 'width' => 200, 'height' => 200, 'backgroundColor' => '#fff3bf', 'strokeColor' => 'transparent']),
        sceneElement(['id' => 'words', 'type' => 'text', 'text' => 'Secret words', 'containerId' => 'note']),
        sceneElement(['id' => 'title', 'type' => 'text', 'text' => 'Secret title', 'x' => 0, 'y' => 0, 'width' => 120, 'height' => 25]),
        sceneElement(['id' => 'round', 'type' => 'ellipse', 'x' => 400, 'y' => 400, 'width' => 80, 'height' => 40]),
        sceneElement(['id' => 'choice', 'type' => 'diamond', 'x' => 0, 'y' => 500, 'width' => 80, 'height' => 40]),
        sceneElement(['id' => 'link', 'type' => 'arrow', 'x' => 100, 'y' => 100, 'points' => [[0, 0], [50, -20]]]),
        sceneElement(['id' => 'erased', 'x' => -5000, 'isDeleted' => true]),
    ]);

    expect($preview['width'])->toBe(580)
        ->and($preview['height'])->toBe(540)
        ->and(array_column($preview['shapes'], 'kind'))->toBe(['rect', 'rect', 'text', 'ellipse', 'diamond', 'path'])
        ->and($preview['shapes'][0])->toBe(['kind' => 'rect', 'x' => 0, 'y' => 50, 'width' => 400, 'height' => 300, 'fill' => null, 'stroke' => '#1e1e1e', 'points' => []])
        ->and($preview['shapes'][1])->toBe(['kind' => 'rect', 'x' => 40, 'y' => 91, 'width' => 200, 'height' => 200, 'fill' => '#fff3bf', 'stroke' => null, 'points' => []])
        ->and($preview['shapes'][5]['points'])->toBe([[200, 100], [250, 80]])
        ->and($preview['shapes'][5]['y'])->toBe(80)
        ->and(json_encode($preview))->not->toContain('Secret');
});

it('gives an empty scene an empty preview', function () {
    expect(resolve(PresentWhiteboardPreview::class)->handle([]))->toBe(['width' => 0, 'height' => 0, 'shapes' => []]);
});

it('stops at three hundred shapes, and at two dozen points of a line plus its end', function () {
    $elements = array_map(fn (int $position) => sceneElement(['x' => $position]), range(1, 320));
    $stroke = sceneElement(['type' => 'freedraw', 'x' => 0, 'y' => 0, 'points' => array_map(fn (int $x) => [$x, 0], range(0, 999))]);

    $preview = resolve(PresentWhiteboardPreview::class);

    expect($preview->handle($elements)['shapes'])->toHaveCount(PresentWhiteboardPreview::MaxShapes)
        ->and($preview->handle([$stroke])['shapes'][0]['points'])->toHaveCount(25)
        ->and(last($preview->handle([$stroke])['shapes'][0]['points']))->toBe([999, 0])
        ->and($preview->handle([$stroke])['shapes'][0]['width'])->toBe(999);
});

it('ignores a colour that is not a plain hex value', function () {
    $preview = resolve(PresentWhiteboardPreview::class)->handle([
        sceneElement(['backgroundColor' => 'url(#x)', 'strokeColor' => 'red;']),
    ]);

    expect($preview['shapes'][0]['fill'])->toBeNull()
        ->and($preview['shapes'][0]['stroke'])->toBeNull();
});
