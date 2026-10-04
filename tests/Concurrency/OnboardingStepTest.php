<?php

use App\Models\Onboarding;
use App\Models\Workspace;
use Tests\Concurrency\Support\Race;

it('creates one workspace when step one is sent twice at the same instant', function () {
    $onboarding = Onboarding::factory()->create();
    $userId = $onboarding->user_id;

    $outcomes = Race::run(array_fill(0, 2, static fn (): int => Race::request($userId, 'PUT', '/onboarding/workspace', ['name' => 'Nordlys', 'locale' => 'en'])));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(Workspace::query()->count())->toBe(1)
        ->and($onboarding->fresh()->workspace_id)->toBe(Workspace::query()->sole()->id);
});

it('creates one team when step two is sent twice at the same instant', function () {
    $onboarding = Onboarding::factory()->create();
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en']);
    $userId = $onboarding->user_id;

    Race::run(array_fill(0, 2, static fn (): int => Race::request($userId, 'PUT', '/onboarding/team', ['name' => 'Atlas', 'color' => 'lagoon'])));

    expect($onboarding->fresh()->workspace->teams()->count())->toBe(1);
});
