<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CardGrouped;
use App\Events\Retros\CardUngrouped;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Vote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function groupingRetro(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user] = retroMember($retro);

    return [$retro, $user];
}

it('groups a card under a lead in the lead column', function () {
    [$retro, $user] = groupingRetro();
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead->id])
        ->assertOk();

    expect($card->fresh()->only(['parent_card_id', 'column_id']))->toBe(['parent_card_id' => $lead->id, 'column_id' => $lead->column_id]);
    Event::assertDispatched(CardGrouped::class);
});

it('moves an existing group under the new lead and reassigns votes', function () {
    [$retro, $user] = groupingRetro();
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $card->column_id, 'parent_card_id' => $card->id]);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead->id])->assertOk();

    expect($child->fresh()->parent_card_id)->toBe($lead->id)
        ->and($child->fresh()->column_id)->toBe($lead->column_id)
        ->and($lead->votes()->count())->toBe(2)
        ->and($card->votes()->count())->toBe(0);
});

it('refuses invalid leads', function (Closure $lead) {
    [$retro, $user] = groupingRetro();
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead($retro, $card)])
        ->assertUnprocessable();
})->with([
    'itself' => [fn ($retro, $card) => $card->id],
    'a child card' => [fn ($retro) => Card::factory()->create([
        'retro_id' => $retro->id,
        'parent_card_id' => Card::factory()->create(['retro_id' => $retro->id])->id,
    ])->id],
    'another retro card' => [fn () => Card::factory()->create()->id],
]);

it('only groups during the grouping phase', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user] = retroMember($retro);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead->id])
        ->assertForbidden();
});

it('ungroups a card to the end of its column', function () {
    [$retro, $user] = groupingRetro();
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'position' => 0]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.group.destroy', [$retro, $card]))->assertOk();

    expect($card->fresh()->parent_card_id)->toBeNull()
        ->and($card->fresh()->position)->toBe(1);
    Event::assertDispatched(CardUngrouped::class);
});

it('refuses to ungroup a top level card', function () {
    [$retro, $user] = groupingRetro();
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.group.destroy', [$retro, $card]))->assertUnprocessable();
});

it('does not leak authors of anonymous retros in grouping broadcasts', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->anonymous()->create();
    [$user] = retroMember($retro);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead->id]);

    Event::assertDispatched(CardGrouped::class, fn (CardGrouped $event) => collect($event->cards)->every(fn (array $card) => $card['author'] === null));
});
