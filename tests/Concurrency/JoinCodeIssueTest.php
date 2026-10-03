<?php

use App\Models\Retro;
use App\Models\SessionJoinCode;
use App\Support\Sessions\JoinCodes;
use Tests\Concurrency\Support\Race;

it('issues one code when two first shares of a session arrive at once', function () {
    $retroId = Retro::factory()->withGuestAccess()->create()->id;

    $outcomes = Race::run([
        static fn (): string => resolve(JoinCodes::class)->for(Retro::query()->findOrFail($retroId)),
        static fn (): string => resolve(JoinCodes::class)->for(Retro::query()->findOrFail($retroId)),
    ], Race::FirstQuery);

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and($outcomes[0]['value'])->toBe($outcomes[1]['value'])
        ->and(SessionJoinCode::query()->count())->toBe(1);
});
