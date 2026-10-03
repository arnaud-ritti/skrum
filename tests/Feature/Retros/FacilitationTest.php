<?php

use App\Actions\HealthCheck\HealthCheckSurvey;
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
use Illuminate\Support\Facades\DB;
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

    Event::assertDispatched(fn (PhaseChanged $event) => $event->phase === 'grouping');
});

it('completes and reopens a retro', function () {
    [$retro, $user] = facilitatedRetro(RetroPhase::Roti);
    $retro->update(['timer_ends_at' => now()->addMinutes(5)]);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();

    expect($retro->fresh()->completed_at)->not->toBeNull()
        ->and($retro->fresh()->timer_ends_at)->toBeNull();

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'roti'])->assertOk();

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
    'highlight' => [fn ($test, $retro) => $test->putJson(route('retros.highlight.update', $retro), ['card_id' => null])],
    'facilitator' => [fn ($test, $retro) => $test->putJson(route('retros.facilitator.update', $retro), ['user_id' => User::factory()->create()->id])],
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
    Event::assertDispatched(fn (CardHighlighted $event) => $event->cardId === $card->id);

    $retro->update(['phase' => RetroPhase::Voting]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $card->id])->assertForbidden();
});

it('clears the highlighted card when leaving the discussing phase', function () {
    [$retro, $user] = facilitatedRetro(RetroPhase::Discussing);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $retro->update(['highlighted_card_id' => $card->id]);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'voting'])->assertOk();

    expect($retro->fresh()->highlighted_card_id)->toBeNull();
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
    Event::assertDispatched(fn (RetroSettingsChanged $event) => $event->broadcastWith() === []);
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
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $this->withCredentials()->withCookies(retroGuestCookie($guest))->getJson(route('retros.snapshot.show', $retro))->assertOk();
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);

    $response = $this->actingAs($user)->postJson(route('retros.guest-token.store', $retro))->assertOk();

    expect($retro->fresh()->guest_token)->not->toBe($oldToken)
        ->and($response->json('guestUrl'))->toBe(route('retros.join.show', $retro->fresh()->guest_token));
    Event::assertDispatched(RetroSettingsChanged::class);
    $this->get(route('retros.join.show', $oldToken))->assertNotFound();
    auth()->logout();
    $this->withCredentials()->withCookies(retroGuestCookie($guest))->getJson(route('retros.snapshot.show', $retro))->assertForbidden();
    $this->withCredentials()->withCookies(retroGuestCookie($guest))->postJson(route('broadcasting.auth'), [
        'socket_id' => '1234.5678',
        'channel_name' => "presence-retro.{$retro->id}",
    ])->assertForbidden();
    expect($guest->fresh()->guest_secret_hash)->toBeNull();
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
    Event::assertDispatched(fn (RetroDeleted $event) => $event->retroId === $retro->id);
});

it('updates the engagement settings and asks clients to refetch', function () {
    [$retro, $user] = facilitatedRetro(RetroPhase::Discussing);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), [
        'reactions_enabled' => false,
        'cursors_enabled' => false,
        'gifs_enabled' => false,
        'hide_vote_counts' => true,
        'is_locked' => true,
        'presentation_mode' => true,
    ])->assertNoContent();

    expect($retro->fresh()->only([
        'reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode',
    ]))->toBe([
        'reactions_enabled' => false,
        'cursors_enabled' => false,
        'gifs_enabled' => false,
        'hide_vote_counts' => true,
        'is_locked' => true,
        'presentation_mode' => true,
    ]);
    Event::assertDispatched(RetroSettingsChanged::class);
});

it('refuses engagement settings from others and once completed', function (string $setting) {
    [$retro, $facilitator] = facilitatedRetro();
    [$member] = retroMember($retro);

    $this->actingAs($member)->patchJson(route('retros.settings.update', $retro), [$setting => true])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)->patchJson(route('retros.settings.update', $retro), [$setting => true])->assertForbidden();
})->with(['reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode']);

it('moves through the enabled pre-writing phases', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'grouping'])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'writing'])->assertOk();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])->assertOk();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'writing'])->assertOk();

    expect($retro->fresh()->phase)->toBe(RetroPhase::Writing);
    Event::assertDispatched(PhaseChanged::class, 3);
});

it('never moves into a disabled phase', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)
        ->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['phase' => 'The retrospective can only move to the previous or next phase.']);
});

it('turns the pre-writing phases on and off', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), [
        'health_check_enabled' => true,
        'icebreaker_enabled' => true,
    ])->assertNoContent();

    expect($retro->fresh()->icebreaker_enabled)->toBeTrue()
        ->and((bool) DB::table('retros')->where('id', $retro->id)->value('health_check_enabled'))->toBeFalse();
    Event::assertDispatched(RetroSettingsChanged::class);

    $this->actingAs($user)->postJson(route('retros.healthCheck.store', $retro))->assertCreated();

    expect(resolve(HealthCheckSurvey::class)->forRetro($retro))->not->toBeNull();

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])->assertOk();

    $this->actingAs($user)->deleteJson(route('retros.healthCheck.destroy', $retro))->assertNoContent();

    expect(resolve(HealthCheckSurvey::class)->forRetro($retro))->toBeNull();
});

it('refuses to turn off the current phase', function (RetroPhase $phase, string $setting, mixed $off) {
    $retro = Retro::factory()->withHealthCheck()->withIcebreaker()->inPhase($phase)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->patchJson(route('retros.settings.update', $retro), [$setting => $off])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$setting => 'Move to another phase before turning this phase off.']);

    expect($retro->fresh()->{$setting})->toBeTrue();
})->with([
    'icebreaker' => [RetroPhase::Icebreaker, 'icebreaker_enabled', false],
    'icebreaker as string zero' => [RetroPhase::Icebreaker, 'icebreaker_enabled', '0'],
]);

it('refuses phase toggles from others and once completed', function (string $setting) {
    [$retro, $facilitator] = facilitatedRetro();
    [$member] = retroMember($retro);

    $this->actingAs($member)->patchJson(route('retros.settings.update', $retro), [$setting => true])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)->patchJson(route('retros.settings.update', $retro), [$setting => true])->assertForbidden();
})->with(['icebreaker_enabled']);

it('ignores the old health-check flag in the settings', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['health_check_enabled' => true]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['health_check_enabled' => false])->assertNoContent();

    expect((bool) DB::table('retros')->where('id', $retro->id)->value('health_check_enabled'))->toBeTrue();
});

it('refuses to add or remove the health check for others and once completed', function () {
    [$retro, $facilitator] = facilitatedRetro();
    [$member] = retroMember($retro);

    $this->actingAs($member)->postJson(route('retros.healthCheck.store', $retro))->assertForbidden();
    $this->actingAs($member)->deleteJson(route('retros.healthCheck.destroy', $retro))->assertForbidden();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)->postJson(route('retros.healthCheck.store', $retro))->assertForbidden();
    $this->actingAs($facilitator)->deleteJson(route('retros.healthCheck.destroy', $retro))->assertForbidden();
});

it('accepts the timer and engagement settings in the pre-writing phases', function (RetroPhase $phase) {
    $retro = Retro::factory()->withHealthCheck()->withIcebreaker()->inPhase($phase)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 120])->assertOk();
    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['cursors_enabled' => false])->assertNoContent();
})->with([RetroPhase::Icebreaker]);

it('switches the vote limit to automatic before voting', function (RetroPhase $phase) {
    $retro = Retro::factory()->withHealthCheck()->withIcebreaker()->inPhase($phase)->create(['votes_per_participant' => 5]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['votes_per_participant' => null])->assertNoContent();

    expect($retro->fresh()->votes_per_participant)->toBeNull();
})->with([RetroPhase::Icebreaker, RetroPhase::Writing, RetroPhase::Grouping]);

it('refuses turning anonymity off once someone answered the health check', function () {
    $retro = Retro::factory()->withHealthCheck()->create(['is_anonymous' => true]);
    [$user, $participant] = retroFacilitator($retro);
    answerHealthCheck($retro, $participant, ['vision' => 4]);

    $this->actingAs($user)
        ->patchJson(route('retros.settings.update', $retro), ['is_anonymous' => false])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('is_anonymous');

    expect($retro->fresh()->is_anonymous)->toBeTrue();
});
