<?php

use App\Enums\InstanceSettingKey;
use App\Models\User;
use App\Support\InstanceSettings;
use App\Support\Maintenance\MaintenanceDetails;
use Illuminate\Support\Str;

beforeEach(fn () => config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'array']));
afterEach(fn () => $this->artisan('up'));

it('attaches the message, its author and the time of return to the payload', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 14, 0, 0));
    $admin = User::factory()->instanceAdmin()->create(['name' => 'Hugo Lambert']);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::MaintenanceMessage->value => 'Monthly update.',
        InstanceSettingKey::MaintenanceMessageBy->value => $admin->id,
    ]);

    $this->artisan('down', ['--retry' => 1800])->assertSuccessful();

    expect(resolve(MaintenanceDetails::class)->read())->toBe([
        'message' => 'Monthly update.',
        'author' => 'Hugo Lambert',
        'backAt' => '2026-10-03T14:30:00+00:00',
    ])->and(app()->maintenanceMode()->data()['retry'])->toBe(1800);
});

it('has no time of return without --retry and no message when none was saved', function () {
    $this->artisan('down')->assertSuccessful();

    expect(resolve(MaintenanceDetails::class)->read())->toBe(['message' => null, 'author' => null, 'backAt' => null]);
});

it('reads nothing outside maintenance', function () {
    expect(resolve(MaintenanceDetails::class)->read())->toBeNull();
});

it('names no author whose account is gone', function () {
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::MaintenanceMessage->value => 'Back soon.',
        InstanceSettingKey::MaintenanceMessageBy->value => (string) Str::uuid(),
    ]);

    $this->artisan('down')->assertSuccessful();

    expect(resolve(MaintenanceDetails::class)->read()['author'])->toBeNull();
});
