<?php

use App\Actions\Admin\DeactivateUser;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('keeps one active admin when the last two are deactivated at the same time', function () {
    $first = User::factory()->instanceAdmin()->create()->id;
    $second = User::factory()->instanceAdmin()->create()->id;

    $outcomes = Race::run([
        static fn (): bool => resolve(DeactivateUser::class)->handle(User::query()->findOrFail($second), User::query()->findOrFail($first)),
        static fn (): bool => resolve(DeactivateUser::class)->handle(User::query()->findOrFail($first), User::query()->findOrFail($second)),
    ]);

    $answers = array_column($outcomes, 'value');
    sort($answers);

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(User::query()->where('is_instance_admin', true)->whereNull('deactivated_at')->count())->toBe(1)
        ->and($answers)->toBe([false, true]);
});
