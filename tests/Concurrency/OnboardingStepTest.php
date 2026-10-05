<?php

use App\Models\Onboarding;
use App\Models\Workspace;
use Tests\Concurrency\Support\Race;

it('creates one workspace when step one is sent twice at the same instant', function () {
    $onboarding = Onboarding::factory()->create();
    $userId = $onboarding->user_id;

    $uri = route('onboarding.workspace.update', absolute: false);

    $outcomes = Race::run(array_fill(0, 2, static fn (): int => Race::request($userId, 'PUT', $uri, ['name' => 'Nordlys', 'locale' => 'en'])));

    expect(array_column($outcomes, 'value'))->each->toBe(302)
        ->and(Workspace::query()->count())->toBe(1)
        ->and($onboarding->fresh()->workspace_id)->toBe(Workspace::query()->sole()->id);
});

it('creates one team when step two is sent twice at the same instant', function () {
    $onboarding = Onboarding::factory()->create();
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en'])->assertRedirect();
    $userId = $onboarding->user_id;
    $uri = route('onboarding.team.update', absolute: false);

    $outcomes = Race::run(array_fill(0, 2, static fn (): int => Race::request($userId, 'PUT', $uri, ['name' => 'Atlas', 'color' => 'lagoon'])));

    expect(array_column($outcomes, 'value'))->each->toBe(302)
        ->and($onboarding->fresh()->workspace->teams()->count())->toBe(1);
});
