<?php

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Event::fake();
    Http::fake();
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'secret-key', 'rating' => 'pg']]);
});

it('refuses board changes while the board is closed for editing', function (RetroPhase $phase, Closure $request) {
    $retro = Retro::factory()->inPhase($phase)->create(['is_locked' => true]);
    [$user, $participant] = retroFacilitator($retro);
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $participant->id]);
    $other = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id]);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id]);
    $comment = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);

    $request($this->actingAs($user), $retro, $card, $other, $column, $item, $comment)
        ->assertStatus(423)
        ->assertJsonPath('message', 'The board is closed for editing.');
})->with([
    'write a card' => [RetroPhase::Writing, fn ($http, $retro, $card, $other, $column) => $http->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'x'])],
    'edit a card' => [RetroPhase::Writing, fn ($http, $retro, $card) => $http->patchJson(route('retros.cards.update', [$retro, $card]), ['content' => 'y'])],
    'delete a card' => [RetroPhase::Writing, fn ($http, $retro, $card) => $http->deleteJson(route('retros.cards.destroy', [$retro, $card]))],
    'move a card' => [RetroPhase::Grouping, fn ($http, $retro, $card, $other, $column) => $http->putJson(route('retros.cards.position.update', [$retro, $card]), ['column_id' => $column->id, 'index' => 0])],
    'group a card' => [RetroPhase::Grouping, fn ($http, $retro, $card, $other) => $http->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $other->id])],
    'ungroup a card' => [RetroPhase::Grouping, fn ($http, $retro, $card) => $http->deleteJson(route('retros.cards.group.destroy', [$retro, $card]))],
    'vote' => [RetroPhase::Voting, fn ($http, $retro, $card) => $http->postJson(route('retros.cards.votes.store', [$retro, $card]))],
    'retract a vote' => [RetroPhase::Voting, fn ($http, $retro, $card) => $http->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))],
    'add an action item' => [RetroPhase::Discussing, fn ($http, $retro) => $http->postJson(route('retros.action-items.store', $retro), ['content' => 'Do it'])],
    'edit an action item' => [RetroPhase::Discussing, fn ($http, $retro, $card, $other, $column, $item) => $http->patchJson(route('retros.action-items.update', [$retro, $item]), ['status' => 'completed'])],
    'delete an action item' => [RetroPhase::Discussing, fn ($http, $retro, $card, $other, $column, $item) => $http->deleteJson(route('retros.action-items.destroy', [$retro, $item]))],
    'react to a card' => [RetroPhase::Voting, fn ($http, $retro, $card) => $http->putJson(route('retros.cards.reactions.update', [$retro, $card]), ['emoji' => '👍'])],
    'remove a reaction' => [RetroPhase::Voting, fn ($http, $retro, $card) => $http->deleteJson(route('retros.cards.reactions.destroy', [$retro, $card]), ['emoji' => '👍'])],
    'comment on a card' => [RetroPhase::Discussing, fn ($http, $retro, $card) => $http->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'x'])],
    'edit a comment' => [RetroPhase::Discussing, fn ($http, $retro, $card, $other, $column, $item, $comment) => $http->patchJson(route('retros.comments.update', [$retro, $comment]), ['content' => 'y'])],
    'delete a comment' => [RetroPhase::Discussing, fn ($http, $retro, $card, $other, $column, $item, $comment) => $http->deleteJson(route('retros.comments.destroy', [$retro, $comment]))],
    'attach a gif' => [RetroPhase::Writing, fn ($http, $retro, $card) => $http->patchJson(route('retros.cards.update', [$retro, $card]), ['content' => 'y', 'gif_id' => 'abc123'])],
    'search gifs' => [RetroPhase::Writing, fn ($http, $retro) => $http->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))],
]);

it('keeps facilitation available while the board is closed for editing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['is_locked' => true]);
    [$user] = retroFacilitator($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $card->id])->assertOk();
    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertOk();
    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['is_locked' => false])->assertNoContent();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();
});
