<?php

use App\Support\Sessions\SessionCursor;
use Carbon\CarbonImmutable;

it('reads back the cursor it writes', function () {
    $cursor = new SessionCursor(CarbonImmutable::parse('2026-10-03 09:15:42', 'UTC'), '0199a1b2-0000-7000-8000-000000000001');

    $read = SessionCursor::parse($cursor->toString());

    expect($cursor->toString())->toBe('2026-10-03T09:15:42+00:00|0199a1b2-0000-7000-8000-000000000001')
        ->and($read?->updatedAt->equalTo($cursor->updatedAt))->toBeTrue()
        ->and($read?->id)->toBe($cursor->id);
});

it('refuses what it did not write', function (?string $value) {
    expect(SessionCursor::parse($value))->toBeNull();
})->with([
    'null' => [null],
    'empty' => [''],
    'no separator' => ['2026-10-03T09:15:42+00:00'],
    'bad date' => ['yesterday|0199a1b2-0000-7000-8000-000000000001'],
    'bad id' => ['2026-10-03T09:15:42+00:00|1; drop'],
]);
