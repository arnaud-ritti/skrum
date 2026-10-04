<?php

use App\Models\User;
use Database\Seeders\DatabaseSeeder;

it('creates the test user in the local and testing environments', function (string $environment) {
    app()->detectEnvironment(fn () => $environment);

    $this->seed(DatabaseSeeder::class);

    expect(User::query()->where('email', 'test@example.com')->exists())->toBeTrue();
})->with(['local', 'testing']);

it('creates no account with a known password on a real instance', function () {
    app()->detectEnvironment(fn () => 'production');

    $this->artisan('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true])->assertSuccessful();

    expect(User::count())->toBe(0);
});
