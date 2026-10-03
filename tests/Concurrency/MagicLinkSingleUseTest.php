<?php

use App\Actions\Auth\ConsumeMagicLink;
use App\Models\MagicLink;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('signs in once when one link is consumed six times at the same instant', function () {
    $user = User::factory()->create();
    $token = 'race-token-0123456789abcdefghijklmnopqrstuvwxyz';
    MagicLink::factory()->create(['user_id' => $user->id, 'token_hash' => MagicLink::hashToken($token)]);

    $outcomes = Race::run(
        array_fill(0, 6, static fn (): ?string => resolve(ConsumeMagicLink::class)->handle($token)?->id),
        Race::FirstQuery,
    );

    $winners = array_values(array_filter(array_column($outcomes, 'value')));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and($winners)->toBe([$user->id])
        ->and(MagicLink::query()->whereNotNull('consumed_at')->count())->toBe(1);
});
