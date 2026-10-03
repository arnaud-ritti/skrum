<?php

use App\Enums\RetroPhase;
use App\Events\Retros\TopicDiscussed;
use App\Models\Card;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('marks the topic left as discussed when the shared topic moves on in Discussing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro);
    $second = topicCard($retro);
    $retro->update(['highlighted_card_id' => $first->id]);

    $response = $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $second->id])->assertOk();

    expect($first->fresh()->discussed_at)->not->toBeNull()
        ->and($second->fresh()->discussed_at)->toBeNull()
        ->and($response->json('discussed.cardId'))->toBe($first->id);
    Event::assertDispatched(fn (TopicDiscussed $event) => $event->cardId === $first->id && $event->discussedAt !== null);
});

it('keeps the first mark of a topic discussed twice', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro, ['discussed_at' => now()->subMinutes(10)]);
    $second = topicCard($retro);
    $retro->update(['highlighted_card_id' => $first->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $second->id])
        ->assertOk()
        ->assertJsonPath('discussed', null);

    expect($first->fresh()->discussed_at->timestamp)->toBe(now()->subMinutes(10)->timestamp);
    Event::assertNotDispatched(TopicDiscussed::class);
});

it('marks nothing in Actions or when the highlight is cleared', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro);
    $second = topicCard($retro);
    $retro->update(['highlighted_card_id' => $first->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => null])->assertOk();

    $retro->update(['phase' => RetroPhase::Actions, 'highlighted_card_id' => $first->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $second->id])->assertOk();

    expect($first->fresh()->discussed_at)->toBeNull();
});

it('lets the facilitator mark and unmark a topic by hand in Discussing and Actions', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user] = retroFacilitator($retro);
    $topic = topicCard($retro);

    $this->actingAs($user)->putJson(route('retros.cards.discussion.update', [$retro, $topic]))
        ->assertOk()
        ->assertJsonPath('cardId', $topic->id);

    expect($topic->fresh()->discussed_at)->not->toBeNull();

    $this->actingAs($user)->deleteJson(route('retros.cards.discussion.destroy', [$retro, $topic]))
        ->assertOk()
        ->assertExactJson(['cardId' => $topic->id, 'discussedAt' => null]);

    expect($topic->fresh()->discussed_at)->toBeNull();
    Event::assertDispatched(fn (TopicDiscussed $event) => $event->cardId === $topic->id && $event->discussedAt === null);
})->with([RetroPhase::Discussing, RetroPhase::Actions]);

it('refuses the mark to a participant, in another phase, on a child card and on another retro\'s card', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);
    $topic = topicCard($retro);
    $child = topicCard($retro, ['parent_card_id' => $topic->id]);
    $elsewhere = Card::factory()->create();

    $this->actingAs($member)->putJson(route('retros.cards.discussion.update', [$retro, $topic]))->assertForbidden();
    $this->actingAs($facilitator)->putJson(route('retros.cards.discussion.update', [$retro, $child]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('card');
    $this->actingAs($facilitator)->putJson(route('retros.cards.discussion.update', [$retro, $elsewhere]))->assertNotFound();

    $retro->update(['phase' => RetroPhase::Voting]);

    $this->actingAs($facilitator)->putJson(route('retros.cards.discussion.update', [$retro, $topic]))->assertForbidden();
});
