<?php

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Events\Retros\CardHighlighted;
use App\Events\Retros\PhaseChanged;
use App\Events\Retros\RetroDeleted;
use App\Events\Retros\RetroSettingsChanged;
use App\Events\Retros\TimerChanged;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function facilitatedRetro(RetroPhase $phase = RetroPhase::Writing): array
{
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user, $participant] = retroFacilitator($retro);

    return [$retro->fresh(), $user, $participant];
}

it('moves to adjacent phases only', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'grouping'])->assertOk();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'discussing'])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'writing'])->assertOk();

    Event::assertDispatched(PhaseChanged::class, fn (PhaseChanged $event) => $event->phase === 'grouping');
});

it('completes and reopens a retro', function () {
    [$retro, $user] = facilitatedRetro(RetroPhase::Discussing);
    $retro->update(['timer_ends_at' => now()->addMinutes(5)]);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();

    expect($retro->fresh()->completed_at)->not->toBeNull()
        ->and($retro->fresh()->timer_ends_at)->toBeNull();

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'discussing'])->assertOk();

    expect($retro->fresh()->completed_at)->toBeNull();
});

it('reserves facilitation to the facilitator', function (Closure $request) {
    $retro = Retro::factory()->create();
    retroFacilitator($retro);
    [$user] = retroMember($retro);

    $request($this->actingAs($user), $retro)->assertForbidden();
})->with([
    'phase' => [fn ($test, $retro) => $test->putJson(route('retros.phase.update', $retro), ['phase' => 'grouping'])],
    'timer' => [fn ($test, $retro) => $test->putJson(route('retros.timer.update', $retro), ['seconds' => 60])],
    'settings' => [fn ($test, $retro) => $test->patchJson(route('retros.settings.update', $retro), ['title' => 'Mine'])],
    'guest token' => [fn ($test, $retro) => $test->postJson(route('retros.guest-token.store', $retro))],
    'delete' => [fn ($test, $retro) => $test->deleteJson(route('retros.destroy', $retro))],
]);

it('sets and clears the timer', function () {
    [$retro, $user] = facilitatedRetro();
    $this->freezeTime();

    $this->actingAs($user)
        ->putJson(route('retros.timer.update', $retro), ['seconds' => 300])
        ->assertOk()
        ->assertJsonPath('timerEndsAt', now()->addSeconds(300)->toIso8601String());

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => null])->assertOk();

    expect($retro->fresh()->timer_ends_at)->toBeNull();
    Event::assertDispatched(TimerChanged::class, 2);
});

it('validates timer durations and refuses them once completed', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 5])->assertUnprocessable();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertForbidden();
});

it('highlights top level cards while discussing', function () {
    [$retro, $user] = facilitatedRetro(RetroPhase::Discussing);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'parent_card_id' => $card->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $card->id])->assertOk();
    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $child->id])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => Card::factory()->create()->id])->assertUnprocessable();

    expect($retro->fresh()->highlighted_card_id)->toBe($card->id);
    Event::assertDispatched(CardHighlighted::class, fn (CardHighlighted $event) => $event->cardId === $card->id);

    $retro->update(['phase' => RetroPhase::Voting]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $card->id])->assertForbidden();
});

it('updates settings and asks clients to refetch', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), [
        'title' => 'Renamed',
        'is_anonymous' => true,
        'votes_per_participant' => 3,
        'guest_access_enabled' => true,
    ])->assertNoContent();

    expect($retro->fresh()->only(['title', 'is_anonymous', 'votes_per_participant', 'guest_access_enabled']))->toBe([
        'title' => 'Renamed',
        'is_anonymous' => true,
        'votes_per_participant' => 3,
        'guest_access_enabled' => true,
    ]);
    Event::assertDispatched(RetroSettingsChanged::class, fn (RetroSettingsChanged $event) => $event->broadcastWith() === []);
});

it('only turns anonymity off before any card exists', function () {
    [$retro, $user] = facilitatedRetro();
    $retro->update(['is_anonymous' => true]);
    Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.settings.update', $retro), ['is_anonymous' => false])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['is_anonymous' => 'Anonymity can only be turned off before any card is written.']);
});

it('only changes the vote allowance before voting', function () {
    [$retro, $user] = facilitatedRetro(RetroPhase::Voting);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['votes_per_participant' => 9])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Grouping]);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['votes_per_participant' => 21])->assertUnprocessable();
});

it('regenerates the guest link and locks out existing guests', function () {
    [$retro, $user] = facilitatedRetro();
    $retro->update(['guest_access_enabled' => true]);
    $oldToken = $retro->guest_token;

    $response = $this->actingAs($user)->postJson(route('retros.guest-token.store', $retro))->assertOk();

    expect($retro->fresh()->guest_token)->not->toBe($oldToken)
        ->and($response->json('guestUrl'))->toBe(route('retros.join.show', $retro->fresh()->guest_token));
    Event::assertDispatched(RetroSettingsChanged::class);
});

it('locks guests out when guest access is disabled', function () {
    [$retro, $user] = facilitatedRetro();
    $retro->update(['guest_access_enabled' => true]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCredentials()->withCookies(retroGuestCookie($guest))->getJson(route('retros.snapshot.show', $retro))->assertOk();

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['guest_access_enabled' => false]);
    auth()->logout();

    $this->withCredentials()->withCookies(retroGuestCookie($guest))->getJson(route('retros.snapshot.show', $retro))->assertForbidden();
});

it('hands facilitation to a team member or workspace manager', function () {
    [$retro, $user] = facilitatedRetro();
    $admin = User::factory()->create();
    $retro->team->workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);

    $this->actingAs($user)->putJson(route('retros.facilitator.update', $retro), ['user_id' => $admin->id])->assertNoContent();

    expect($retro->fresh()->facilitator->user_id)->toBe($admin->id);
});

it('refuses facilitators outside the team', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)
        ->putJson(route('retros.facilitator.update', $retro), ['user_id' => User::factory()->create()->id])
        ->assertUnprocessable();
});

it('deletes the retro', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)->deleteJson(route('retros.destroy', $retro))->assertNoContent();

    expect(Retro::find($retro->id))->toBeNull();
    Event::assertDispatched(RetroDeleted::class, fn (RetroDeleted $event) => $event->retroId === $retro->id);
});
