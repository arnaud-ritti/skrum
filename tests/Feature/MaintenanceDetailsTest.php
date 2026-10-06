<?php

use App\Support\Maintenance\MaintenanceDetails;

beforeEach(fn () => config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'array']));
afterEach(fn () => $this->artisan('up'));

it('attaches the time of return to the payload', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 14, 0, 0));

    $this->artisan('down', ['--retry' => 1800])->assertSuccessful();

    expect(resolve(MaintenanceDetails::class)->read())->toBe(['backAt' => '2026-10-03T14:30:00+00:00'])
        ->and(app()->maintenanceMode()->data()['retry'])->toBe(1800);
});

it('has no time of return without --retry', function () {
    $this->artisan('down')->assertSuccessful();

    expect(resolve(MaintenanceDetails::class)->read())->toBe(['backAt' => null]);
});

it('reads nothing outside maintenance', function () {
    expect(resolve(MaintenanceDetails::class)->read())->toBeNull();
});

it('reads only the time of return from a payload an earlier build wrote', function () {
    app()->maintenanceMode()->activate([
        'retry' => 600,
        MaintenanceDetails::PayloadKey => [
            'message' => 'Back soon.',
            'author' => 'Hugo Lambert',
            'backAt' => '2026-10-03T14:30:00+00:00',
        ],
    ]);

    expect(resolve(MaintenanceDetails::class)->read())->toBe(['backAt' => '2026-10-03T14:30:00+00:00']);
});
