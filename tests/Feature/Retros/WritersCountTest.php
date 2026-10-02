<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Events\Retros\CardCreated;
use App\Events\Retros\CardDeleted;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function writersSnapshot(Retro $retro, Participant $viewer): array
{
    return resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);
}

it('counts each participant who wrote once, however many cards', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);
    $other = Participant::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->count(2)->create(['retro_id' => $retro->id, 'participant_id' => $viewer->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id]);

    expect(writersSnapshot($retro, $viewer)['writersCount'])->toBe(2);
});

it('is in the snapshot of every phase and of a guest', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $guest->id]);

    expect(writersSnapshot($retro, $guest)['writersCount'])->toBe(1);
})->with([RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Completed]);

it('is zero without cards', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);

    expect(writersSnapshot($retro, $viewer)['writersCount'])->toBe(0);
});

it('carries the new count on card creation and no author on an anonymous retro', function () {
    $retro = Retro::factory()->anonymous()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user, $viewer] = retroMember($retro);
    $other = Participant::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $other->id]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'Mine'])
        ->assertCreated();

    Event::assertDispatched(function (CardCreated $event) use ($viewer, $other) {
        $payload = $event->broadcastWith();

        return array_keys($payload) === ['card', 'writersCount']
            && $payload['writersCount'] === 2
            && $payload['card']['author'] === null
            && ! str_contains(json_encode($payload), $viewer->id)
            && ! str_contains(json_encode($payload), $other->id);
    });
});

it('lowers the count when a participant deletes their only card', function () {
    $retro = Retro::factory()->create();
    [$user, $viewer] = retroMember($retro);
    $other = Participant::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $viewer->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $card]))->assertNoContent();

    Event::assertDispatched(fn (CardDeleted $event) => $event->broadcastWith()['writersCount'] === 1);
    expect(writersSnapshot($retro, $other)['writersCount'])->toBe(1);
});

it('keeps the count when a participant deletes one of several cards', function () {
    $retro = Retro::factory()->create();
    [$user, $viewer] = retroMember($retro);
    [$first] = Card::factory()->count(2)->create(['retro_id' => $retro->id, 'participant_id' => $viewer->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $first]))->assertNoContent();

    Event::assertDispatched(fn (CardDeleted $event) => $event->broadcastWith()['writersCount'] === 1);
});

it('answers the author of a new card with the new count', function () {
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'First'])
        ->assertCreated()
        ->assertJsonPath('writersCount', 1)
        ->assertJsonPath('card.content', 'First');
});
