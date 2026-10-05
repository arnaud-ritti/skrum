<?php

use App\Enums\RetroPhase;
use App\Models\Retro;

it('has no health-check phase any more', function () {
    expect(RetroPhase::tryFrom('health_check'))->toBeNull()
        ->and(array_column(RetroPhase::cases(), 'value'))
        ->toBe(['icebreaker', 'writing', 'grouping', 'voting', 'discussing', 'actions', 'roti', 'completed']);
});

it('runs a retro through its phases without a health-check step', function () {
    $plain = Retro::factory()->create();
    $withIcebreaker = Retro::factory()->create(['icebreaker_enabled' => true]);

    expect(array_map(fn (RetroPhase $phase) => $phase->value, $plain->phases()))
        ->toBe(['writing', 'grouping', 'voting', 'discussing', 'actions', 'roti', 'completed'])
        ->and($withIcebreaker->firstPhase())->toBe(RetroPhase::Icebreaker)
        ->and(RetroPhase::hidingOthersCards())->toBe([RetroPhase::Icebreaker, RetroPhase::Writing]);
});

it('gives the factory state a real health check, on five', function () {
    $retro = Retro::factory()->withHealthCheck()->create();

    expect($retro->teamSurveys()->sole()->questions()->count())->toBe(6)
        ->and($retro->teamSurveys()->sole()->questions()->first()->scale_max)->toBe(5);
});
