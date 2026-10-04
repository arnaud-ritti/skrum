<?php

use App\Enums\RetroPhase;
use App\Events\Retros\ColumnsChanged;
use App\Http\Requests\WorkspaceTemplateRequest;
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
        ->postJson(route('retros.columns.store', $retro), ['title' => 'Kudos', 'color' => 'plum'])
        ->assertCreated()
        ->assertJsonPath('columns.2.title', 'Kudos')
        ->assertJsonPath('columns.2.position', 2);

    Event::assertDispatched(fn (ColumnsChanged $event) => count($event->columns) === 3);
});

it('refuses a column past the column cap of a board', function () {
    [$retro, $user] = columnsRetro();
    Column::factory()->count(WorkspaceTemplateRequest::MaxColumns - 2)->sequence(fn ($sequence): array => ['position' => $sequence->index + 2])->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->postJson(route('retros.columns.store', $retro), ['title' => 'One more', 'color' => 'plum'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('column');

    expect($retro->columns()->count())->toBe(WorkspaceTemplateRequest::MaxColumns);
});

it('refuses to remove the last column of a board', function () {
    [$retro, $user, $first, $second] = columnsRetro();

    $this->actingAs($user)->deleteJson(route('retros.columns.destroy', [$retro, $second]))->assertOk();
    $this->actingAs($user)
        ->deleteJson(route('retros.columns.destroy', [$retro, $first]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('column');

    expect($first->fresh())->not->toBeNull();
});

it('renames and removes empty columns only', function () {
    [$retro, $user, $first, $second] = columnsRetro();
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $first->id]);

    $this->actingAs($user)->patchJson(route('retros.columns.update', [$retro, $first]), ['title' => 'New'])->assertUnprocessable();
    $this->actingAs($user)->deleteJson(route('retros.columns.destroy', [$retro, $first]))->assertUnprocessable();

    $this->actingAs($user)->patchJson(route('retros.columns.update', [$retro, $second]), ['title' => 'Renamed', 'color' => 'coral'])->assertOk();
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
    [['title' => '', 'color' => 'moss']],
    [['title' => str_repeat('a', 101), 'color' => 'moss']],
    [['title' => 'Ok', 'color' => 'moss', 'description' => str_repeat('a', 201)]],
    [['title' => 'Ok', 'color' => 'pink']],
]);

it('refuses the six old color names with an error on the color', function (string $oldColor) {
    [$retro, $user, $first] = columnsRetro();

    $this->actingAs($user)
        ->postJson(route('retros.columns.store', $retro), ['title' => 'Kudos', 'color' => $oldColor])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('color');

    $this->actingAs($user)
        ->patchJson(route('retros.columns.update', [$retro, $first]), ['color' => $oldColor])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('color');
})->with(['green', 'red', 'blue', 'amber', 'purple', 'slate']);

it('restricts column editing to the facilitator while writing', function () {
    [$retro] = columnsRetro();
    [$member] = retroMember($retro);

    $this->actingAs($member)->postJson(route('retros.columns.store', $retro), ['title' => 'X', 'color' => 'moss'])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Grouping]);
    $facilitator = $retro->facilitator->user;

    $this->actingAs($facilitator)->postJson(route('retros.columns.store', $retro), ['title' => 'X', 'color' => 'moss'])->assertForbidden();
});

it('returns 404 for columns of another retro', function () {
    [$retro, $user] = columnsRetro();

    $this->actingAs($user)
        ->patchJson(route('retros.columns.update', [$retro, Column::factory()->create()]), ['title' => 'X'])
        ->assertNotFound();
});

it('lets the facilitator prepare columns before writing', function (RetroPhase $phase) {
    [$retro, $user, $first, $second] = columnsRetro();
    $retro->update(['icebreaker_enabled' => true, 'phase' => $phase]);

    $this->actingAs($user)->postJson(route('retros.columns.store', $retro), ['title' => 'Kudos', 'color' => 'plum'])->assertCreated();
    $this->actingAs($user)
        ->putJson(route('retros.columns.order.update', $retro), ['column_ids' => [$second->id, $first->id, Column::query()->where('retro_id', $retro->id)->where('title', 'Kudos')->value('id')]])
        ->assertOk();
})->with([RetroPhase::Icebreaker]);

it('accepts titles up to 100 characters and a description', function () {
    [$retro, $user] = columnsRetro();

    $this->actingAs($user)
        ->postJson(route('retros.columns.store', $retro), [
            'title' => str_repeat('a', 100),
            'color' => 'moss',
            'description' => 'What pushed us forward',
        ])
        ->assertCreated()
        ->assertJsonPath('columns.2.description', 'What pushed us forward');
});

it('edits the description of a column with cards but not its title', function () {
    [$retro, $user, $first] = columnsRetro();
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $first->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.columns.update', [$retro, $first]), ['description' => 'Clarified'])
        ->assertOk()
        ->assertJsonPath('columns.0.description', 'Clarified');

    $this->actingAs($user)
        ->patchJson(route('retros.columns.update', [$retro, $first]), ['title' => 'Renamed', 'description' => 'Again'])
        ->assertUnprocessable();

    expect($first->fresh()->only(['title', 'description']))->toBe(['title' => 'First', 'description' => 'Clarified']);
    Event::assertDispatched(fn (ColumnsChanged $event) => $event->columns[0]['description'] === 'Clarified');
});

it('clears a description with null', function () {
    [$retro, $user, $first] = columnsRetro();
    $first->update(['description' => 'Old']);

    $this->actingAs($user)->patchJson(route('retros.columns.update', [$retro, $first]), ['description' => null])->assertOk();

    expect($first->fresh()->description)->toBeNull();
});
