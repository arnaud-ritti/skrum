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
    $sticky = sanitizeElement(sceneElement(['customData' => ['skrum' => ['kind' => 'sticky', 'masked' => true], 'other' => 1]]));
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
