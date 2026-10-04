<?php

use App\Enums\RetroPhase;
use App\Events\Retros\WritingCountChanged;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function anonymousWritingRetro(array $attributes = []): Retro
{
    return Retro::factory()->inPhase(RetroPhase::Writing)->create(['is_anonymous' => true, ...$attributes]);
}

it('counts the people writing and sends the count with nothing else', function () {
    $retro = anonymousWritingRetro();
    [$first] = retroMember($retro);
    [$second] = retroMember($retro);

    $this->actingAs($first)->putJson(route('retros.writing.update', $retro))
        ->assertOk()
        ->assertExactJson(['count' => 1]);
    $this->actingAs($second)->putJson(route('retros.writing.update', $retro))
        ->assertOk()
        ->assertExactJson(['count' => 2]);

    Event::assertDispatched(fn (WritingCountChanged $event) => $event->broadcastWith() === ['count' => 2]);
    Event::assertDispatched(fn (WritingCountChanged $event) => array_keys($event->broadcastWith()) === ['count']);
});

it('sends the count again on every heartbeat', function () {
    $retro = anonymousWritingRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(route('retros.writing.update', $retro))->assertOk();
    $this->actingAs($user)->putJson(route('retros.writing.update', $retro))->assertExactJson(['count' => 1]);

    Event::assertDispatchedTimes(WritingCountChanged::class, 2);
});

it('stops counting a writer who stops or goes quiet', function () {
    $retro = anonymousWritingRetro();
    [$first, $one] = retroMember($retro);
    [$second] = retroMember($retro);

    $this->actingAs($first)->putJson(route('retros.writing.update', $retro))->assertOk();
    $this->actingAs($second)->putJson(route('retros.writing.update', $retro))->assertExactJson(['count' => 2]);

    $this->actingAs($first)->deleteJson(route('retros.writing.destroy', $retro))->assertExactJson(['count' => 1]);

    expect($one->fresh()->writing_until)->toBeNull();

    $this->travel(9)->seconds();

    $this->actingAs($first)->putJson(route('retros.writing.update', $retro))->assertExactJson(['count' => 1]);
});

it('lets a guest say they are writing', function () {
    $retro = anonymousWritingRetro();
    $guest = retroGuest($retro);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->putJson(route('retros.writing.update', $retro))
        ->assertExactJson(['count' => 1]);
});

it('refuses a named retro, another phase and a locked board', function () {
    $named = Retro::factory()->inPhase(RetroPhase::Writing)->create(['is_anonymous' => false]);
    [$user] = retroMember($named);
    $this->actingAs($user)->putJson(route('retros.writing.update', $named))->assertForbidden();

    $grouping = anonymousWritingRetro(['phase' => RetroPhase::Grouping]);
    [$user] = retroMember($grouping);
    $this->actingAs($user)->putJson(route('retros.writing.update', $grouping))->assertForbidden();

    $locked = anonymousWritingRetro(['is_locked' => true]);
    [$user] = retroMember($locked);
    $this->actingAs($user)->putJson(route('retros.writing.update', $locked))->assertStatus(423);

    Event::assertNotDispatched(WritingCountChanged::class);
});

it('limits the heartbeats of one participant', function () {
    $retro = anonymousWritingRetro();
    [$user] = retroMember($retro);
    [$other] = retroMember($retro);

    foreach (range(1, 40) as $beat) {
        $this->actingAs($user)->putJson(route('retros.writing.update', $retro))->assertOk();
    }

    $this->actingAs($user)->putJson(route('retros.writing.update', $retro))->assertTooManyRequests();
    $this->actingAs($other)->putJson(route('retros.writing.update', $retro))->assertOk();
});

it('limits the heartbeats of one guest without limiting another', function () {
    $retro = anonymousWritingRetro();
    $guest = retroGuest($retro);
    $otherGuest = retroGuest($retro, 'other-secret');

    foreach (range(1, 40) as $beat) {
        $this->withCookies(retroGuestCookie($guest))->withCredentials()->putJson(route('retros.writing.update', $retro))->assertOk();
    }

    $this->withCookies(retroGuestCookie($guest))->withCredentials()->putJson(route('retros.writing.update', $retro))->assertTooManyRequests();
    $this->withCookies(retroGuestCookie($otherGuest, 'other-secret'))->withCredentials()->putJson(route('retros.writing.update', $retro))->assertOk();
});
