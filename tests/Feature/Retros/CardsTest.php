<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CardCreated;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardsMoved;
use App\Events\Retros\CardUpdated;
use App\Events\Retros\OwnCardSaved;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Event::fake();
});

it('writes a card at the end of a column and hides it from others', function () {
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'position' => 0]);
    [$user, $participant] = retroMember($retro);

    $response = $this->actingAs($user)
        ->withHeader('X-Socket-ID', '111.222')
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'Deploys are slow'])
        ->assertCreated()
        ->assertJsonPath('card.content', 'Deploys are slow')
        ->assertJsonPath('card.isMine', true)
        ->assertJsonPath('card.position', 1);

    Event::assertDispatched(fn (CardCreated $event) => $event->retroId === $retro->id
        && $event->card['id'] === $response->json('card.id')
        && $event->card['hidden'] === true
        && $event->card['content'] === null
        && $event->card['author'] === null
        && $event->socket === '111.222');

    expect(Card::find($response->json('card.id'))->participant_id)->toBe($participant->id);
});

it('only accepts new cards while writing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'Late'])
        ->assertForbidden()
        ->assertJsonPath('message', 'This action is not available in the current phase.');
});

it('rejects columns of another retro and invalid content', function (Closure $payload) {
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $foreignColumn = Column::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), $payload($column, $foreignColumn))
        ->assertUnprocessable();
})->with([
    'foreign column' => [fn ($column, $foreign) => ['column_id' => $foreign->id, 'content' => 'x']],
    'empty' => [fn ($column) => ['column_id' => $column->id, 'content' => '']],
    'too long' => [fn ($column) => ['column_id' => $column->id, 'content' => str_repeat('a', 1001)]],
]);

it('lets authors edit and delete their cards in writing and grouping', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.cards.update', [$retro, $card]), ['content' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('card.content', 'Edited');

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $card]))->assertNoContent();

    Event::assertDispatched(CardUpdated::class);
    Event::assertDispatched(fn (CardDeleted $event) => $event->cardId === $card->id && $event->ungroupedCards === []);
    expect(Card::find($card->id))->toBeNull();
})->with([RetroPhase::Writing, RetroPhase::Grouping]);

it('refuses edits by other participants and in later phases', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.cards.update', [$retro, $card]), ['content' => 'Hijack'])
        ->assertForbidden();

    $retro->update(['phase' => RetroPhase::Voting]);

    $this->actingAs($card->participant->user)
        ->deleteJson(route('retros.cards.destroy', [$retro, $card]))
        ->assertForbidden();
});

it('returns 404 for cards of another retro', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $foreignCard = Card::factory()->create();

    $this->actingAs($user)
        ->patchJson(route('retros.cards.update', [$retro, $foreignCard]), ['content' => 'x'])
        ->assertNotFound();
});

it('ungroups children when their lead card is deleted', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user, $participant] = retroMember($retro);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id, 'position' => 0]);
    $other = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'position' => 0]);

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $lead]))->assertNoContent();

    expect($child->fresh()->parent_card_id)->toBeNull()
        ->and($child->fresh()->position)->toBe(1)
        ->and($other->fresh()->position)->toBe(0);
    Event::assertDispatched(fn (CardDeleted $event) => collect($event->ungroupedCards)->pluck('id')->all() === [$child->id]
        && $event->ungroupedCards[0]['position'] === 1);
});

it('moves own cards between columns while writing and resequences positions', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $from = Column::factory()->create(['retro_id' => $retro->id, 'position' => 0]);
    $to = Column::factory()->create(['retro_id' => $retro->id, 'position' => 1]);
    $moving = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $from->id, 'participant_id' => $participant->id, 'position' => 0]);
    $staying = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $from->id, 'position' => 1]);
    $first = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $to->id, 'position' => 0]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.position.update', [$retro, $moving]), ['column_id' => $to->id, 'index' => 0])
        ->assertOk();

    expect($moving->fresh()->only(['column_id', 'position']))->toBe(['column_id' => $to->id, 'position' => 0])
        ->and($first->fresh()->position)->toBe(1)
        ->and($staying->fresh()->position)->toBe(0);

    Event::assertDispatched(fn (CardsMoved $event) => collect($event->cards)->every(fn (array $card) => $card['content'] === null || $card['id'] !== $moving->id));
});

it('refuses moving others cards while writing but allows it while grouping', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.position.update', [$retro, $card]), ['column_id' => $card->column_id, 'index' => 0])
        ->assertForbidden();

    $retro->update(['phase' => RetroPhase::Grouping]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.position.update', [$retro, $card]), ['column_id' => $card->column_id, 'index' => 5])
        ->assertOk();
});

it('ungroups a child card that is moved and carries a lead card children along', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user] = retroMember($retro);
    $target = Column::factory()->create(['retro_id' => $retro->id]);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    $this->actingAs($user)->putJson(route('retros.cards.position.update', [$retro, $lead]), ['column_id' => $target->id, 'index' => 0]);

    expect($child->fresh()->column_id)->toBe($target->id)
        ->and($child->fresh()->parent_card_id)->toBe($lead->id);

    $this->actingAs($user)->putJson(route('retros.cards.position.update', [$retro, $child]), ['column_id' => $target->id, 'index' => 0]);

    expect($child->fresh()->parent_card_id)->toBeNull()
        ->and($child->fresh()->position)->toBe(0)
        ->and($lead->fresh()->position)->toBe(1);
});

it('keeps content hidden from others in grouping broadcasts only when anonymous authors apply', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->anonymous()->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->patchJson(route('retros.cards.update', [$retro, $card]), ['content' => 'Visible text']);

    Event::assertDispatched(fn (CardUpdated $event) => $event->card['content'] === 'Visible text' && $event->card['author'] === null);
});

it('sends the author their own card on their private channel', function () {
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user, $participant] = retroMember($retro);

    $response = $this->actingAs($user)
        ->withHeader('X-Socket-ID', '111.222')
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'Deploys are slow'])
        ->assertCreated();

    Event::assertDispatched(fn (OwnCardSaved $event) => $event->participantId === $participant->id
        && $event->card['id'] === $response->json('card.id')
        && $event->card['content'] === 'Deploys are slow'
        && $event->card['isMine'] === true
        && $event->socket === '111.222'
        && $event->broadcastOn()->name === "private-participant.{$participant->id}");

    $this->actingAs($user)
        ->withHeader('X-Socket-ID', '333.444')
        ->patchJson(route('retros.cards.update', [$retro, $response->json('card.id')]), ['content' => 'Deploys are faster'])
        ->assertOk();

    Event::assertDispatched(fn (OwnCardSaved $event) => $event->card['content'] === 'Deploys are faster'
        && $event->socket === '333.444');
});

it('does not send the author their card again when it is moved, grouped or deleted', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user, $participant] = retroMember($retro);
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $participant->id]);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.position.update', [$retro, $card]), ['column_id' => $column->id, 'index' => 1])
        ->assertOk();
    $this->actingAs($user)
        ->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead->id])
        ->assertOk();
    $this->actingAs($user)
        ->deleteJson(route('retros.cards.destroy', [$retro, $card]))
        ->assertNoContent();

    Event::assertNotDispatched(OwnCardSaved::class);
});

it('sends the author their own content and authorship in anonymous retros while others stay redacted', function () {
    $retro = Retro::factory()->anonymous()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user, $participant] = retroMember($retro);

    $response = $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'Deploys are slow'])
        ->assertCreated();

    Event::assertDispatched(fn (OwnCardSaved $event) => $event->participantId === $participant->id
        && $event->card['id'] === $response->json('card.id')
        && $event->card['content'] === 'Deploys are slow'
        && $event->card['author']['id'] === $participant->id
        && $event->card['isMine'] === true);

    Event::assertDispatched(fn (CardCreated $event) => $event->card['id'] === $response->json('card.id')
        && $event->card['content'] === null
        && $event->card['author'] === null
        && $event->card['isMine'] === false);
});

it('deletes comments and reactions with their card', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
    CardReaction::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $card]))->assertNoContent();

    expect(CardComment::count())->toBe(0)->and(CardReaction::count())->toBe(0);
});

it('hides a gif from others while writing but sends it to its author', function () {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'secret-key', 'rating' => 'pg']]);
    Http::fake(['api.giphy.com/v1/gifs/abc123*' => Http::response(['data' => [
        'id' => 'abc123',
        'images' => [
            'fixed_width' => ['url' => 'https://media.giphy.com/abc123/200w.gif', 'width' => '200', 'height' => '150'],
            'original' => ['url' => 'https://media.giphy.com/abc123/giphy.gif', 'width' => '480', 'height' => '360'],
        ],
    ]])]);
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'gif_id' => 'abc123'])
        ->assertCreated();

    Event::assertDispatched(fn (CardCreated $event) => $event->card['hidden'] === true && $event->card['gif'] === null);
    Event::assertDispatched(fn (OwnCardSaved $event) => $event->card['hidden'] === false && $event->card['gif']['id'] === 'abc123');
});

it('refuses gif changes on cards of others', function () {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'secret-key', 'rating' => 'pg']]);
    Http::fake();
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.cards.update', [$retro, $card]), ['gif_id' => 'abc123'])
        ->assertForbidden();

    expect($card->fresh()->gif_id)->toBeNull();
    Http::assertNothingSent();
});
