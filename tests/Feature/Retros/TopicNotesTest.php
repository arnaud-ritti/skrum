<?php

use App\Enums\RetroPhase;
use App\Events\Retros\TopicNoteSaved;
use App\Models\Retro;
use App\Models\TopicNote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('saves the first note of a topic and every later one from the version it read', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);
    $topic = topicCard($retro);

    $this->actingAs($user)->putJson(route('retros.cards.notes.update', [$retro, $topic]), ['body' => 'Any addition goes through the PO.', 'version' => 0])
        ->assertOk()
        ->assertJsonPath('note.cardId', $topic->id)
        ->assertJsonPath('note.body', 'Any addition goes through the PO.')
        ->assertJsonPath('note.version', 1);

    $this->actingAs($user)->putJson(route('retros.cards.notes.update', [$retro, $topic]), ['body' => "Any addition goes through the PO.\nTry one in, one out.", 'version' => 1])
        ->assertOk()
        ->assertJsonPath('note.version', 2);

    $note = TopicNote::query()->sole();

    expect($note->body)->toBe("Any addition goes through the PO.\nTry one in, one out.")
        ->and($note->updated_by_participant_id)->toBe($participant->id)
        ->and($note->retro_id)->toBe($retro->id);
    Event::assertDispatched(fn (TopicNoteSaved $event) => $event->broadcastWith()['note']['version'] === 2
        && ! str_contains(json_encode($event->broadcastWith()), $participant->id));
});

it('refuses a save from an older version with the current note, and writes nothing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $topic = topicCard($retro);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $topic->id, 'body' => 'Theirs', 'version' => 3]);

    $this->actingAs($user)->putJson(route('retros.cards.notes.update', [$retro, $topic]), ['body' => 'Mine', 'version' => 2])
        ->assertStatus(409)
        ->assertJsonPath('note.body', 'Theirs')
        ->assertJsonPath('note.version', 3);

    expect(TopicNote::query()->sole()->body)->toBe('Theirs');
    Event::assertNotDispatched(TopicNoteSaved::class);
});

it('answers an empty note at version 0 when the first save claims a later version', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $topic = topicCard($retro);

    $this->actingAs($user)->putJson(route('retros.cards.notes.update', [$retro, $topic]), ['body' => 'Mine', 'version' => 4])
        ->assertStatus(409)
        ->assertJsonPath('note', ['cardId' => $topic->id, 'body' => '', 'version' => 0, 'updatedAt' => null]);
});

it('lets a guest write the notes and empties them with an empty text', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $guest = retroGuest($retro);
    $topic = topicCard($retro);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $topic->id, 'body' => 'Draft', 'version' => 1]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->putJson(route('retros.cards.notes.update', [$retro, $topic]), ['body' => '', 'version' => 1])
        ->assertOk()
        ->assertJsonPath('note.body', '');
});

it('refuses notes outside Discussing, on a locked board, on a child card, and beyond the length', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $topic = topicCard($retro);
    $child = topicCard($retro, ['parent_card_id' => $topic->id]);
    $notes = fn ($card, array $payload) => $this->actingAs($user)->putJson(route('retros.cards.notes.update', [$retro, $card]), $payload);

    $notes($child, ['body' => 'x', 'version' => 0])->assertUnprocessable()->assertJsonValidationErrors('card');
    $notes($topic, ['body' => str_repeat('a', TopicNote::MaxLength + 1), 'version' => 0])->assertUnprocessable()->assertJsonValidationErrors('body');
    $notes($topic, ['body' => 'x'])->assertUnprocessable()->assertJsonValidationErrors('version');

    $retro->update(['is_locked' => true]);
    $notes($topic, ['body' => 'x', 'version' => 0])->assertStatus(423);

    $retro->update(['is_locked' => false, 'phase' => RetroPhase::Actions]);
    $notes($topic, ['body' => 'x', 'version' => 0])->assertForbidden();

    expect(TopicNote::query()->count())->toBe(0);
});
