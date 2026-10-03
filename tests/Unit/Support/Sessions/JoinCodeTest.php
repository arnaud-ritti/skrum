<?php

use App\Support\Sessions\JoinCode;

it('generates codes of the mockup shape from the alphabet without look-alikes', function () {
    foreach (range(1, 200) as $ignored) {
        expect(JoinCode::generate())->toMatch('/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{3}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/');
    }
});

it('reads what people type', function (string $typed, ?string $code) {
    expect(JoinCode::normalise($typed))->toBe($code);
})->with([
    ['K7Q-P4M2', 'K7Q-P4M2'],
    ['k7q-p4m2', 'K7Q-P4M2'],
    ['k7qp4m2', 'K7Q-P4M2'],
    [' K7Q P4M2 ', 'K7Q-P4M2'],
    ['K7Q-P4M', null],
    ['K7Q-P4M22', null],
    ['K0Q-P4M2', null],
    ['KOQ-P4M2', null],
    ['K1Q-P4M2', null],
    ['KIQ-P4M2', null],
    ['K7Q_P4M2', null],
]);
