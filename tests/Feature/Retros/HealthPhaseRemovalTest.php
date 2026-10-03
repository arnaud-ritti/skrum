<?php

use App\Enums\RetroPhase;
use App\Models\Retro;
use Illuminate\Support\Facades\DB;

function runHealthPhaseMove(): void
{
    $migration = require database_path('migrations/2026_10_20_100200_move_retros_out_of_the_health_check_phase.php');

    $migration->up();
}

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

it('opens a retro that was in the health-check phase, in another phase, with its answers on their scale and an open health check', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    oldHealthStatements($retro, [['key' => 'vision', 'builtin' => 'vision']]);
    oldHealthAnswer($retro, $participant, 'vision', 7);
    oldHealthFlag($retro, true, 'health_check');

    runHealthPhaseMove();

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('retro.phase', 'writing')
        ->assertJsonMissingPath('retro.healthCheckEnabled')
        ->assertJsonPath('healthCheck.isClosed', false)
        ->assertJsonPath('healthCheck.scale', 10)
        ->assertJsonPath('healthCheck.statements.0.key', 'vision')
        ->assertJsonPath('healthCheck.statements.0.myScore', 7)
        ->assertJsonPath('healthCheck.hasSubmitted', true);
});

it('can run twice', function () {
    $retro = Retro::factory()->create();
    DB::table('retros')->where('id', $retro->id)->update(['phase' => 'health_check']);

    runHealthPhaseMove();
    runHealthPhaseMove();

    expect($retro->fresh()->phase)->toBe(RetroPhase::Writing);
});

it('gives the factory state a real health check, on five', function () {
    $retro = Retro::factory()->withHealthCheck()->create();

    expect($retro->teamSurveys()->sole()->questions()->count())->toBe(6)
        ->and($retro->teamSurveys()->sole()->questions()->first()->scale_max)->toBe(5);
});

it('still creates the icebreaker room of a retro that arrived in that phase by the migration', function () {
    $retro = Retro::factory()->create(['icebreaker_enabled' => true]);
    [$user] = retroMember($retro);
    DB::table('retros')->where('id', $retro->id)->update(['phase' => 'health_check']);

    runHealthPhaseMove();

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))->assertOk();

    expect(DB::table('game_rooms')->where('retro_id', $retro->id)->count())->toBe(1);
});
