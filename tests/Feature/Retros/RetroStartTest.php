<?php

use App\Actions\Retros\MarkRetroStarted;
use App\Enums\RetroPhase;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('is started by the first card', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroMember($retro);
    $column = Column::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'First'])
        ->assertCreated();

    expect($retro->fresh()->started_at->timestamp)->toBe(now()->timestamp);
});

it('is started by the first health-check submission', function () {
    $this->freezeTime();
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.healthCheck.submission.store', $retro), ['scores' => [
            'interaction' => 3, 'task_clarity' => 4, 'manager_support' => 5, 'vision' => 4, 'processes' => 2, 'motivation' => 4,
        ]])
        ->assertOk();

    expect($retro->fresh()->started_at->timestamp)->toBe(now()->timestamp);
});

it('is started by a timer', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertOk();

    expect($retro->fresh()->started_at->timestamp)->toBe(now()->timestamp);
});

it('is not started by clearing the timer', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => null])->assertOk();

    expect($retro->fresh()->started_at)->toBeNull();
});

it('is started by a phase change', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'grouping'])->assertOk();

    expect($retro->fresh()->started_at->timestamp)->toBe(now()->timestamp);
});

it('keeps the first start time when a later event happens', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroFacilitator($retro);
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $firstStart = now();

    $this->actingAs($user)->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'First'])->assertCreated();
    $this->travel(10)->minutes();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'grouping'])->assertOk();

    expect($retro->fresh()->started_at->timestamp)->toBe($firstStart->timestamp);
});

it('keeps the start time when the retro is reopened and completed again', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$user] = retroFacilitator($retro);
    $firstStart = now();

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();
    $this->travel(5)->minutes();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'roti'])->assertOk();
    $this->travel(5)->minutes();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();

    expect($retro->fresh()->started_at->timestamp)->toBe($firstStart->timestamp);
});

it('sets the start time once and does not query again when it is set', function () {
    $this->freezeTime();
    $retro = Retro::factory()->started(now()->subHour())->create();
    $loaded = Retro::query()->findOrFail($retro->id);

    DB::enableQueryLog();
    resolve(MarkRetroStarted::class)->handle($loaded);

    expect(DB::getQueryLog())->toBeEmpty();
});

it('does not touch a retro that another request started meanwhile', function () {
    $this->freezeTime();
    $retro = Retro::factory()->create();
    $stale = Retro::query()->findOrFail($retro->id);
    Retro::query()->whereKey($retro->id)->update(['started_at' => now()->subMinutes(30)]);

    resolve(MarkRetroStarted::class)->handle($stale);

    expect($retro->fresh()->started_at->timestamp)->toBe(now()->subMinutes(30)->timestamp);
});

it('sets the start on the model it was given', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['started_at' => null]);

    resolve(MarkRetroStarted::class)->handle($retro);

    expect($retro->started_at?->timestamp)->toBe(now()->timestamp)
        ->and($retro->isDirty('started_at'))->toBeFalse();
});
