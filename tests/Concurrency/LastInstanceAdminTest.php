<?php

use App\Actions\Admin\RevokeInstanceAdmin;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('keeps one instance admin when the last two are revoked at the same time', function () {
    $firstId = User::factory()->instanceAdmin()->create()->id;
    $secondId = User::factory()->instanceAdmin()->create()->id;

    $outcomes = Race::run([
        static fn (): bool => resolve(RevokeInstanceAdmin::class)->handle(User::query()->findOrFail($firstId)),
        static fn (): bool => resolve(RevokeInstanceAdmin::class)->handle(User::query()->findOrFail($secondId)),
    ]);

    $answers = array_column($outcomes, 'value');
    sort($answers);

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(User::query()->where('is_instance_admin', true)->count())->toBe(1)
        ->and($answers)->toBe([false, true]);
});
