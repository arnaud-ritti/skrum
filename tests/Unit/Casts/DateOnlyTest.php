<?php

use App\Casts\DateOnly;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

function dateOnlyModel(): Model
{
    return new class extends Model {};
}

it('writes ten characters whatever it is given', function (mixed $value, ?string $stored) {
    expect((new DateOnly)->set(dateOnlyModel(), 'due_on', $value, []))->toBe($stored);
})->with([
    'a date string' => ['2026-10-10', '2026-10-10'],
    'a date and time string' => ['2026-10-10 15:30:00', '2026-10-10'],
    'a carbon instance' => [Carbon::parse('2026-10-10 23:59:59'), '2026-10-10'],
    'an immutable carbon instance' => [CarbonImmutable::parse('2026-10-10 23:59:59'), '2026-10-10'],
    'null' => [null, null],
    'an empty string' => ['', null],
]);

it('reads midnight of the stored day, from the short and from the long form', function (string $stored) {
    $read = (new DateOnly)->get(dateOnlyModel(), 'due_on', $stored, []);

    expect($read)->toBeInstanceOf(Carbon::class)
        ->and($read->toDateTimeString())->toBe('2026-10-10 00:00:00');
})->with(['2026-10-10', '2026-10-10 00:00:00']);

it('reads null as null', function () {
    expect((new DateOnly)->get(dateOnlyModel(), 'due_on', null, []))->toBeNull();
});
