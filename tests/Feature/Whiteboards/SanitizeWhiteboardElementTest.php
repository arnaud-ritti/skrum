<?php

use App\Actions\Whiteboards\SanitizeWhiteboardElement;

function sanitizeElement(mixed $raw): ?array
{
    return (new SanitizeWhiteboardElement)->handle($raw);
}

it('keeps a well-formed element unchanged', function () {
    $element = sceneElement();

    expect(sanitizeElement($element))->toBe($element);
});

it('accepts every element type of the canvas', function (string $type, array $extra) {
    expect(sanitizeElement(sceneElement(['type' => $type, ...$extra])))->not->toBeNull();
})->with([
    'rectangle' => ['rectangle', []],
    'diamond' => ['diamond', []],
    'ellipse' => ['ellipse', []],
    'arrow' => ['arrow', ['points' => [[0, 0], [10, 10]], 'startBinding' => null, 'endBinding' => null]],
    'line' => ['line', ['points' => [[0, 0], [10, 10]]]],
    'freedraw' => ['freedraw', ['points' => [[0, 0], [1, 1]], 'pressures' => [0.5, 0.5], 'simulatePressure' => true]],
    'text' => ['text', ['text' => 'Hello', 'originalText' => 'Hello', 'fontSize' => 20, 'fontFamily' => 5, 'containerId' => null]],
    'image' => ['image', ['fileId' => 'abc123', 'status' => 'saved', 'scale' => [1, 1]]],
    'frame' => ['frame', ['name' => 'Ideas']],
]);

it('rejects what is not an element', function (mixed $raw) {
    expect(sanitizeElement($raw))->toBeNull();
})->with([
    'a string' => ['nope'],
    'null' => [null],
    'a list' => [[1, 2, 3]],
    'unknown type' => [fn () => sceneElement(['type' => 'iframe'])],
    'embeddable' => [fn () => sceneElement(['type' => 'embeddable'])],
    'no id' => [fn () => array_diff_key(sceneElement(), ['id' => true])],
    'id with a slash' => [fn () => sceneElement(['id' => 'a/b'])],
    'id too long' => [fn () => sceneElement(['id' => str_repeat('a', 41)])],
    'version zero' => [fn () => sceneElement(['version' => 0])],
    'version as text' => [fn () => sceneElement(['version' => '3'])],
    'negative nonce' => [fn () => sceneElement(['versionNonce' => -1])],
    'x as text' => [fn () => sceneElement(['x' => 'left'])],
    'infinite width' => [fn () => sceneElement(['width' => INF])],
    'not a number in points' => [fn () => sceneElement(['type' => 'line', 'points' => [[0, NAN]]])],
    'image without file' => [fn () => sceneElement(['type' => 'image', 'fileId' => null])],
    'image with a path as file' => [fn () => sceneElement(['type' => 'image', 'fileId' => '../etc/passwd'])],
    'version above the column range' => [fn () => sceneElement(['version' => 2_147_483_648])],
    'nonce above the column range' => [fn () => sceneElement(['versionNonce' => 9_223_372_036_854_775_808])],
    'line without points' => [fn () => sceneElement(['type' => 'line'])],
    'arrow without points' => [fn () => sceneElement(['type' => 'arrow'])],
    'freedraw without points' => [fn () => sceneElement(['type' => 'freedraw'])],
    'points as a number' => [fn () => sceneElement(['type' => 'line', 'points' => 5])],
    'points as null' => [fn () => sceneElement(['type' => 'arrow', 'points' => null])],
    'no point at all' => [fn () => sceneElement(['type' => 'freedraw', 'points' => []])],
    'a point that is null' => [fn () => sceneElement(['type' => 'line', 'points' => [[0, 0], null]])],
    'a point with one coordinate' => [fn () => sceneElement(['type' => 'line', 'points' => [[0, 0], [1]]])],
    'a point with text coordinates' => [fn () => sceneElement(['type' => 'line', 'points' => [[0, 0], ['1', '2']]])],
    'points as a map' => [fn () => sceneElement(['type' => 'line', 'points' => ['a' => [0, 0], 'b' => [1, 1]]])],
    'pressures as a number' => [fn () => sceneElement(['type' => 'freedraw', 'points' => [[0, 0], [1, 1]], 'pressures' => 1])],
    'a pressure as text' => [fn () => sceneElement(['type' => 'freedraw', 'points' => [[0, 0], [1, 1]], 'pressures' => [0.5, 'hard']])],
    'group ids as text' => [fn () => sceneElement(['groupIds' => 'group'])],
    'a group id that is not text' => [fn () => sceneElement(['groupIds' => [['nested']]])],
    'bound elements as text' => [fn () => sceneElement(['boundElements' => 'arrow'])],
    'a bound element that is null' => [fn () => sceneElement(['boundElements' => [null]])],
    'a bound element without type' => [fn () => sceneElement(['boundElements' => [['id' => 'abc']]])],
    'a bound element with a numeric id' => [fn () => sceneElement(['boundElements' => [['id' => 5, 'type' => 'text']]])],
    'text element without text' => [fn () => sceneElement(['type' => 'text'])],
    'text element with null text' => [fn () => sceneElement(['type' => 'text', 'text' => null])],
    'image scale as a number' => [fn () => sceneElement(['type' => 'image', 'fileId' => 'abc123', 'scale' => 2])],
    'image scale with one factor' => [fn () => sceneElement(['type' => 'image', 'fileId' => 'abc123', 'scale' => [1]])],
    'image crop as text' => [fn () => sceneElement(['type' => 'image', 'fileId' => 'abc123', 'crop' => 'half'])],
    'frame id as a list' => [fn () => sceneElement(['frameId' => ['frame']])],
    'frame id with a slash' => [fn () => sceneElement(['frameId' => 'a/b'])],
    'container id as a number' => [fn () => sceneElement(['type' => 'text', 'text' => 'Hi', 'containerId' => 5])],
    'stroke colour as a list' => [fn () => sceneElement(['strokeColor' => ['#000']])],
    'stroke width as text' => [fn () => sceneElement(['strokeWidth' => 'thick'])],
    'opacity as a map' => [fn () => sceneElement(['opacity' => ['value' => 100]])],
    'font size as a list' => [fn () => sceneElement(['type' => 'text', 'text' => 'Hi', 'fontSize' => [20]])],
    'roundness as a number' => [fn () => sceneElement(['roundness' => 3])],
    'index as a number' => [fn () => sceneElement(['index' => 5])],
    'index that is not a fractional index' => [fn () => sceneElement(['index' => '!!'])],
    'index shorter than its integer part' => [fn () => sceneElement(['index' => 'b0'])],
    'index with a trailing zero' => [fn () => sceneElement(['index' => 'a0V0'])],
    'binding as text' => [fn () => sceneElement(['type' => 'arrow', 'points' => [[0, 0], [1, 1]], 'startBinding' => 'box'])],
    'binding without element' => [fn () => sceneElement(['type' => 'arrow', 'points' => [[0, 0], [1, 1]], 'endBinding' => ['focus' => 0, 'gap' => 1]])],
    'binding with a fixed point that is not a point' => [fn () => sceneElement(['type' => 'arrow', 'points' => [[0, 0], [1, 1]], 'startBinding' => ['elementId' => 'box', 'focus' => 0, 'gap' => 1, 'fixedPoint' => 5]])],
    'fixed segments as text' => [fn () => sceneElement(['type' => 'arrow', 'points' => [[0, 0], [1, 1]], 'elbowed' => true, 'fixedSegments' => 'all'])],
    'last committed point as text' => [fn () => sceneElement(['type' => 'line', 'points' => [[0, 0], [1, 1]], 'lastCommittedPoint' => 'end'])],
    'frame name as a list' => [fn () => sceneElement(['type' => 'frame', 'name' => ['Ideas']])],
]);

it('accepts the shapes excalidraw sends', function (array $overrides) {
    expect(sanitizeElement(sceneElement($overrides)))->not->toBeNull();
})->with([
    'a bound arrow' => [[
        'type' => 'arrow', 'points' => [[0, 0], [10.5, -3]], 'lastCommittedPoint' => null,
        'startBinding' => ['elementId' => 'box', 'focus' => 0.1, 'gap' => 4, 'fixedPoint' => null],
        'endBinding' => ['elementId' => 'other', 'focus' => -0.2, 'gap' => 1, 'fixedPoint' => [0.5, 1]],
        'startArrowhead' => null, 'endArrowhead' => 'arrow', 'elbowed' => false,
    ]],
    'an elbow arrow' => [[
        'type' => 'arrow', 'points' => [[0, 0], [0, 10], [10, 10]], 'elbowed' => true,
        'fixedSegments' => [['start' => [0, 0], 'end' => [0, 10], 'index' => 1]],
        'startIsSpecial' => null, 'endIsSpecial' => false,
    ]],
    'a single point' => [['type' => 'freedraw', 'points' => [[0, 0]], 'pressures' => [], 'simulatePressure' => false, 'lastCommittedPoint' => [0, 0]]],
    'a container' => [['groupIds' => ['g1', 'g2'], 'frameId' => 'frame-1', 'roundness' => ['type' => 3], 'boundElements' => [['id' => 'label', 'type' => 'text'], ['id' => 'link', 'type' => 'arrow']]]],
    'a bound text being typed' => [['type' => 'text', 'text' => '', 'originalText' => '', 'fontSize' => 20, 'fontFamily' => 5, 'textAlign' => 'center', 'verticalAlign' => 'middle', 'containerId' => 'box', 'autoResize' => true, 'lineHeight' => 1.25]],
    'a cropped image' => [['type' => 'image', 'fileId' => 'abc123', 'status' => 'saved', 'scale' => [1, -1], 'crop' => ['x' => 0, 'y' => 0, 'width' => 10, 'height' => 10, 'naturalWidth' => 20, 'naturalHeight' => 20]]],
    'an unnamed frame' => [['type' => 'frame', 'name' => null]],
    'no index yet' => [['index' => null]],
    'an index between two others' => [['index' => 'a0V']],
    'an index before the first' => [['index' => 'Zz']],
    'the highest version' => [['version' => 2_147_483_647]],
]);

it('strips keys it does not know', function () {
    $clean = sanitizeElement(sceneElement(['authorMemberId' => 'someone', 'onclick' => 'alert(1)', 'text' => 'not for rectangles']));

    expect($clean)->not->toHaveKeys(['authorMemberId', 'onclick', 'text']);
});

it('keeps only http and https links', function (?string $link, ?string $expected) {
    expect(sanitizeElement(sceneElement(['link' => $link]))['link'])->toBe($expected);
})->with([
    ['https://example.com/a?b=1', 'https://example.com/a?b=1'],
    ['http://example.com', 'http://example.com'],
    ['javascript:alert(1)', null],
    ['JaVaScRiPt:alert(1)', null],
    ['data:text/html,<script>', null],
    ['/relative', null],
    ['', null],
    [null, null],
]);

it('keeps text byte for byte and limits its length', function () {
    $text = sceneElement(['type' => 'text', 'text' => "  two spaces\n", 'originalText' => '']);

    expect(sanitizeElement($text)['text'])->toBe("  two spaces\n")
        ->and(sanitizeElement($text)['originalText'])->toBe('')
        ->and(sanitizeElement(sceneElement(['type' => 'text', 'text' => str_repeat('é', 10_000)])))->not->toBeNull()
        ->and(sanitizeElement(sceneElement(['type' => 'text', 'text' => str_repeat('é', 10_001)])))->toBeNull()
        ->and(sanitizeElement(sceneElement(['type' => 'text', 'text' => ['an', 'array']])))->toBeNull();
});

it('reduces custom data to the sticky marker', function () {
    $sticky = sanitizeElement(sceneElement(['customData' => ['skrum' => ['kind' => 'sticky', 'colour' => 'pink'], 'other' => 1]]));
    $forged = sanitizeElement(sceneElement(['type' => 'ellipse', 'customData' => ['skrum' => ['kind' => 'sticky']]]));
    $junk = sanitizeElement(sceneElement(['customData' => ['skrum' => ['kind' => 'admin']]]));

    expect($sticky['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and($forged)->not->toHaveKey('customData')
        ->and($junk)->not->toHaveKey('customData');
});

it('normalises the deleted and locked flags', function () {
    $clean = sanitizeElement(array_diff_key(sceneElement(['isDeleted' => 1]), ['locked' => true]));

    expect($clean['isDeleted'])->toBeTrue()
        ->and($clean['locked'])->toBeFalse();
});

it('rejects an element heavier than 64 KB', function () {
    $points = array_fill(0, 9000, [1.123456, 2.123456]);

    expect(sanitizeElement(sceneElement(['type' => 'freedraw', 'points' => $points])))->toBeNull()
        ->and(sanitizeElement(sceneElement(['type' => 'freedraw', 'points' => array_slice($points, 0, 500)])))->not->toBeNull();
});
