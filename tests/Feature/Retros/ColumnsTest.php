<?php

use App\Enums\RetroPhase;
use App\Events\Retros\ColumnsChanged;
use App\Models\Card;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function columnsRetro(): array
{
    $retro = Retro::factory()->create();
    [$user] = retroFacilitator($retro);
    $first = Column::factory()->create(['retro_id' => $retro->id, 'position' => 0, 'title' => 'First']);
    $second = Column::factory()->create(['retro_id' => $retro->id, 'position' => 1, 'title' => 'Second']);

    return [$retro->fresh(), $user, $first, $second];
}

it('adds a column at the end', function () {
    [$retro, $user] = columnsRetro();

    $this->actingAs($user)
        ->postJson(route('retros.columns.store', $retro), ['title' => 'Kudos', 'color' => 'purple'])
        ->assertCreated()
        ->assertJsonPath('columns.2.title', 'Kudos')
        ->assertJsonPath('columns.2.position', 2);

    Event::assertDispatched(ColumnsChanged::class, fn (ColumnsChanged $event) => count($event->columns) === 3);
});

it('renames and removes empty columns only', function () {
    [$retro, $user, $first, $second] = columnsRetro();
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $first->id]);

    $this->actingAs($user)->patchJson(route('retros.columns.update', [$retro, $first]), ['title' => 'New'])->assertUnprocessable();
    $this->actingAs($user)->deleteJson(route('retros.columns.destroy', [$retro, $first]))->assertUnprocessable();

    $this->actingAs($user)->patchJson(route('retros.columns.update', [$retro, $second]), ['title' => 'Renamed', 'color' => 'red'])->assertOk();
    $this->actingAs($user)->deleteJson(route('retros.columns.destroy', [$retro, $second]))->assertOk()->assertJsonCount(1, 'columns');
});

it('resequences positions after removing a column', function () {
    [$retro, $user, $first, $second] = columnsRetro();

    $this->actingAs($user)->deleteJson(route('retros.columns.destroy', [$retro, $first]))->assertOk();

    expect($second->fresh()->position)->toBe(0);
});

it('reorders columns with the complete list only', function () {
    [$retro, $user, $first, $second] = columnsRetro();

    $this->actingAs($user)
        ->putJson(route('retros.columns.order.update', $retro), ['column_ids' => [$second->id, $first->id]])
        ->assertOk()
        ->assertJsonPath('columns.0.id', $second->id);

    $this->actingAs($user)->putJson(route('retros.columns.order.update', $retro), ['column_ids' => [$first->id]])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('retros.columns.order.update', $retro), ['column_ids' => [$first->id, Column::factory()->create()->id]])->assertUnprocessable();
});

it('validates titles and colors', function (array $payload) {
    [$retro, $user] = columnsRetro();

    $this->actingAs($user)->postJson(route('retros.columns.store', $retro), $payload)->assertUnprocessable();
})->with([
    [['title' => '', 'color' => 'green']],
    [['title' => str_repeat('a', 61), 'color' => 'green']],
    [['title' => 'Ok', 'color' => 'pink']],
]);

it('restricts column editing to the facilitator while writing', function () {
    [$retro] = columnsRetro();
    [$member] = retroMember($retro);

    $this->actingAs($member)->postJson(route('retros.columns.store', $retro), ['title' => 'X', 'color' => 'green'])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Grouping]);
    $facilitator = $retro->facilitator->user;

    $this->actingAs($facilitator)->postJson(route('retros.columns.store', $retro), ['title' => 'X', 'color' => 'green'])->assertForbidden();
});

it('returns 404 for columns of another retro', function () {
    [$retro, $user] = columnsRetro();

    $this->actingAs($user)
        ->patchJson(route('retros.columns.update', [$retro, Column::factory()->create()]), ['title' => 'X'])
        ->assertNotFound();
});

it('lets the facilitator prepare columns before writing', function (RetroPhase $phase) {
    [$retro, $user, $first, $second] = columnsRetro();
    $retro->update(['health_check_enabled' => true, 'icebreaker_enabled' => true, 'phase' => $phase]);

    $this->actingAs($user)->postJson(route('retros.columns.store', $retro), ['title' => 'Kudos', 'color' => 'purple'])->assertCreated();
    $this->actingAs($user)
        ->putJson(route('retros.columns.order.update', $retro), ['column_ids' => [$second->id, $first->id, Column::query()->where('retro_id', $retro->id)->where('title', 'Kudos')->value('id')]])
        ->assertOk();
})->with([RetroPhase::HealthCheck, RetroPhase::Icebreaker]);
