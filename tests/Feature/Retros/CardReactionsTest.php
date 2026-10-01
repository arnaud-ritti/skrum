<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CardReactionsChanged;
use App\Models\Card;
use App\Models\CardReaction;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function reactingRetro(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    return [$retro, $user, $participant, $card];
}

it('adds and removes a reaction idempotently', function () {
    [$retro, $user, $participant, $card] = reactingRetro();
    $route = route('retros.cards.reactions.update', [$retro, $card]);

    $this->actingAs($user)->putJson($route, ['emoji' => '🎉'])->assertOk();
    $this->actingAs($user)->putJson($route, ['emoji' => '🎉'])
        ->assertOk()
        ->assertJson(['cardId' => $card->id, 'reactions' => [['emoji' => '🎉', 'count' => 1, 'mine' => true]]]);

    expect(CardReaction::count())->toBe(1);

    $this->actingAs($user)->deleteJson(route('retros.cards.reactions.destroy', [$retro, $card]), ['emoji' => '🎉'])
        ->assertOk()
        ->assertJsonPath('reactions', []);
    $this->actingAs($user)->deleteJson(route('retros.cards.reactions.destroy', [$retro, $card]), ['emoji' => '🎉'])->assertOk();

    expect(CardReaction::count())->toBe(0);
});

it('summarises reactions by count and broadcasts no participant ids', function () {
    [$retro, $user, $participant, $card] = reactingRetro();
    CardReaction::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'emoji' => '👍']);

    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $card]), ['emoji' => '🤔'])
        ->assertJsonPath('reactions.0.emoji', '👍')
        ->assertJsonPath('reactions.0.count', 2)
        ->assertJsonPath('reactions.0.mine', false)
        ->assertJsonPath('reactions.1.emoji', '🤔')
        ->assertJsonPath('reactions.1.names', [$user->name]);

    Event::assertDispatched(fn (CardReactionsChanged $event) => $event->broadcastAs() === 'card.reactions.changed'
        && $event->broadcastWith()['cardId'] === $card->id
        && ! str_contains(json_encode($event->broadcastWith()), $participant->id)
        && ! array_key_exists('mine', $event->broadcastWith()['reactions'][0]));
});

it('hides who reacted on anonymous retros', function () {
    [$retro, $user, , $card] = reactingRetro(RetroPhase::Grouping, ['is_anonymous' => true]);

    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $card]), ['emoji' => '👍'])
        ->assertJsonPath('reactions.0.names', []);
});

it('refuses reactions before grouping, once completed, when turned off and when locked', function (RetroPhase $phase, array $attributes, int $status) {
    [$retro, $user, , $card] = reactingRetro($phase, $attributes);

    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $card]), ['emoji' => '👍'])->assertStatus($status);
})->with([
    'writing' => [RetroPhase::Writing, [], 403],
    'completed' => [RetroPhase::Completed, [], 403],
    'turned off' => [RetroPhase::Voting, ['reactions_enabled' => false], 403],
    'locked' => [RetroPhase::Discussing, ['is_locked' => true], 423],
]);

it('rejects invalid emoji', function () {
    [$retro, $user, , $card] = reactingRetro();

    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $card]), ['emoji' => 'lol'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['emoji' => 'Choose a single emoji.']);
});

it('returns 404 for cards of another retro', function () {
    [$retro, $user] = reactingRetro();
    $foreign = Card::factory()->create();

    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $foreign]), ['emoji' => '👍'])->assertNotFound();
});
