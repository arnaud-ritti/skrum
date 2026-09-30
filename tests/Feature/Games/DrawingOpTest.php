<?php

use App\Support\Games\DrawingOp;
use Illuminate\Validation\ValidationException;

it('keeps a valid stroke and counts its points', function () {
    $op = DrawingOp::parse([
        'type' => 'stroke',
        'color' => 'red',
        'size' => 10,
        'points' => [[0, 0], [1000, 750], [500, 375]],
        'extra' => 'dropped',
    ]);

    expect($op)->toBe(['type' => 'stroke', 'color' => 'red', 'size' => 10, 'points' => [[0, 0], [1000, 750], [500, 375]]])
        ->and(DrawingOp::pointCount($op))->toBe(3);
});

it('keeps a valid fill that counts no point', function () {
    $op = DrawingOp::parse(['type' => 'fill', 'color' => 'white', 'x' => 12, 'y' => 700]);

    expect($op)->toBe(['type' => 'fill', 'color' => 'white', 'x' => 12, 'y' => 700])
        ->and(DrawingOp::pointCount($op))->toBe(0);
});

it('accepts a stroke of exactly the maximum points', function () {
    $points = array_fill(0, DrawingOp::MaxStrokePoints, [10, 10]);

    expect(DrawingOp::pointCount(DrawingOp::parse(['type' => 'stroke', 'color' => 'black', 'size' => 4, 'points' => $points])))
        ->toBe(DrawingOp::MaxStrokePoints);
});

it('refuses invalid operations', function (mixed $op) {
    DrawingOp::parse($op);
})->throws(ValidationException::class)->with([
    'not an array' => ['stroke'],
    'unknown type' => [['type' => 'circle', 'color' => 'red', 'x' => 1, 'y' => 1]],
    'unknown colour' => [['type' => 'stroke', 'color' => 'pink', 'size' => 4, 'points' => [[1, 1]]]],
    'unknown size' => [['type' => 'stroke', 'color' => 'red', 'size' => 5, 'points' => [[1, 1]]]],
    'size as text' => [['type' => 'stroke', 'color' => 'red', 'size' => '4', 'points' => [[1, 1]]]],
    'no points' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => []]],
    'too many points' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => array_fill(0, 1001, [1, 1])]],
    'x beyond the canvas' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1001, 1]]]],
    'y beyond the canvas' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1, 751]]]],
    'negative coordinate' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[-1, 1]]]],
    'decimal coordinate' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1.5, 1]]]],
    'three coordinates' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1, 1, 1]]]],
    'keyed point' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [['x' => 1, 'y' => 1]]]],
    'fill outside' => [['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 800]],
    'fill without y' => [['type' => 'fill', 'color' => 'red', 'x' => 1]],
]);

it('names the drawing operation in the error', function () {
    try {
        DrawingOp::parse(['type' => 'fill', 'color' => 'teal', 'x' => 1, 'y' => 1]);
    } catch (ValidationException $exception) {
        expect($exception->errors())->toBe(['op' => [__('This drawing operation is not valid.')]]);

        return;
    }

    $this->fail('The operation should have been refused.');
});
