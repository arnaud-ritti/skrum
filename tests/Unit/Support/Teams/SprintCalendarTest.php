<?php

use App\Support\Teams\SprintCalendar;
use Carbon\CarbonImmutable;

/**
 * @param  array<int, int>  $numbers
 */
function atlasSprints(array $numbers = [41, 42, 43, 44, 45], string $timezone = 'UTC', ?int $retroWeekday = 4, ?string $retroTime = '14:00'): SprintCalendar
{
    $all = [
        41 => ['2026-09-07', '2026-09-20'],
        42 => ['2026-09-21', '2026-10-04'],
        43 => ['2026-10-05', '2026-10-18'],
        44 => ['2026-10-19', '2026-11-01'],
        45 => ['2026-11-02', '2026-11-15'],
    ];

    $rows = array_map(fn (int $number): array => ['id' => "sprint-{$number}", 'number' => $number, 'startsOn' => $all[$number][0], 'endsOn' => $all[$number][1]], $numbers);

    return new SprintCalendar($rows, $timezone, $retroWeekday, $retroTime);
}

it('finds the sprint that contains a moment', function (string $moment, ?int $number) {
    expect(atlasSprints()->numberOn(CarbonImmutable::parse($moment, 'UTC')))->toBe($number);
})->with([
    'first day' => ['2026-09-21 00:00', 42],
    'a Wednesday' => ['2026-09-30 10:00', 42],
    'last day' => ['2026-10-04 23:59', 42],
    'before every sprint' => ['2026-09-06 12:00', null],
]);

it('has no sprint between two sprints', function () {
    $calendar = atlasSprints([41, 43]);

    expect($calendar->sprintOn(CarbonImmutable::parse('2026-09-25 10:00', 'UTC')))->toBeNull()
        ->and($calendar->shortLabelOn(CarbonImmutable::parse('2026-09-25 10:00', 'UTC')))->toBeNull();
});

it('gives a sprint its days and a short label', function () {
    $wednesday = CarbonImmutable::parse('2026-09-30 10:00', 'UTC');

    expect(atlasSprints()->sprintOn($wednesday))->toBe(['id' => 'sprint-42', 'number' => 42, 'startsOn' => '2026-09-21', 'endsOn' => '2026-10-04'])
        ->and(atlasSprints()->shortLabelOn($wednesday))->toBe('S42');
});

it('reads the day in the application time zone, past midnight in Paris while still the day before in UTC', function () {
    $lateSunday = CarbonImmutable::parse('2026-11-01 23:30', 'UTC');

    expect(atlasSprints(timezone: 'Europe/Paris')->numberOn($lateSunday))->toBe(45)
        ->and(atlasSprints(timezone: 'UTC')->numberOn($lateSunday))->toBe(44);
});

it('finds the next retro on the last retro weekday of the current sprint, else of the next one', function (string $now, ?array $expected) {
    expect(atlasSprints([42, 43])->nextRetro(CarbonImmutable::parse($now, 'UTC')))->toBe($expected);
})->with([
    'the day before' => ['2026-09-30 10:00', ['date' => '2026-10-01', 'time' => '14:00']],
    'the day itself, before the time' => ['2026-10-01 13:59', ['date' => '2026-10-01', 'time' => '14:00']],
    'the day itself, after the time' => ['2026-10-01 15:00', ['date' => '2026-10-15', 'time' => '14:00']],
    'the weekend after' => ['2026-10-03 09:00', ['date' => '2026-10-15', 'time' => '14:00']],
    'after the last sprint' => ['2026-10-19 09:00', null],
]);

it('has no next retro when the next sprint is not there yet', function () {
    expect(atlasSprints([42])->nextRetro(CarbonImmutable::parse('2026-10-01 15:00', 'UTC')))->toBeNull();
});

it('skips a sprint too short to hold the retro weekday', function () {
    $calendar = new SprintCalendar([
        ['id' => 'short', 'number' => 1, 'startsOn' => '2026-10-05', 'endsOn' => '2026-10-07'],
        ['id' => 'next', 'number' => 2, 'startsOn' => '2026-10-08', 'endsOn' => '2026-10-21'],
    ], 'UTC', 4);

    expect($calendar->nextRetro(CarbonImmutable::parse('2026-10-05 09:00', 'UTC')))->toBe(['date' => '2026-10-15', 'time' => null]);
});

it('keeps the retro day all day long without a time, and has none without a weekday', function () {
    expect(atlasSprints([42], retroTime: null)->nextRetro(CarbonImmutable::parse('2026-10-01 23:00', 'UTC')))->toBe(['date' => '2026-10-01', 'time' => null])
        ->and(atlasSprints([42], retroWeekday: null, retroTime: null)->nextRetro(CarbonImmutable::parse('2026-09-30 10:00', 'UTC')))->toBeNull();
});
