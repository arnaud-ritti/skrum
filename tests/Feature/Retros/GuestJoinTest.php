<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Retros\GuestCookie;
use App\Enums\WorkspaceRole;
use App\Models\Retro;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the join form for an enabled guest link', function () {
    $retro = Retro::factory()->withGuestAccess()->create(['title' => 'Sprint 42']);

    $this->get(route('retros.join.show', $retro->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('retros/join')
            ->where('isInvalid', false)
            ->where('retroTitle', 'Sprint 42')
            ->where('suggestedName', null));
});

it('joins as a guest and resumes with the cookie', function () {
    $retro = Retro::factory()->withGuestAccess()->create();

    $response = $this->post(route('retros.join.store', $retro->guest_token), ['name' => 'Visitor'])
        ->assertRedirect(route('retros.show', $retro))
        ->assertCookie(GuestCookie::name($retro->id));

    $guest = $retro->participants()->where('guest_name', 'Visitor')->sole();
    $cookieValue = $response->getCookie(GuestCookie::name($retro->id), decrypt: true)->getValue();

    expect(str_starts_with($cookieValue, $guest->id.'|'))->toBeTrue()
        ->and($guest->guest_secret_hash)->not->toContain(explode('|', $cookieValue)[1]);

    $this->withCookies([GuestCookie::name($retro->id) => $cookieValue])
        ->get(route('retros.join.show', $retro->guest_token))
        ->assertRedirect(route('retros.show', $retro));
});

it('requires a display name', function (string $name) {
    $retro = Retro::factory()->withGuestAccess()->create();

    $this->post(route('retros.join.store', $retro->guest_token), ['name' => $name])->assertSessionHasErrors('name');
})->with(['', str_repeat('a', 51)]);

it('refuses disabled or unknown links without revealing the retro', function (string $kind) {
    $retro = Retro::factory()->create(['title' => 'Private']);
    $token = $kind === 'disabled' ? $retro->guest_token : 'unknown-token';

    $this->get(route('retros.join.show', $token))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('retros/join')
            ->where('isInvalid', true)
            ->missing('retroTitle'));

    $this->post(route('retros.join.store', $token), ['name' => 'X'])->assertNotFound();
})->with(['disabled', 'unknown']);

it('invalidates old links when the token changes', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $oldToken = $retro->guest_token;
    $retro->update(['guest_token' => 'a-brand-new-token']);

    $this->get(route('retros.join.show', $oldToken))->assertNotFound();
});

it('sends team members straight to the board as themselves', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $user = User::factory()->create();
    $retro->team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $retro->team->members()->attach($user);

    $this->actingAs($user)
        ->get(route('retros.join.show', $retro->guest_token))
        ->assertRedirect(route('retros.show', $retro));

    expect($retro->participants()->where('user_id', $user->id)->exists())->toBeTrue();
});

it('lets a logged in outsider join as a guest without team access', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $outsider = User::factory()->create(['name' => 'Olga']);

    $this->actingAs($outsider)
        ->get(route('retros.join.show', $retro->guest_token))
        ->assertInertia(fn (Assert $page) => $page->where('suggestedName', 'Olga'));

    $this->actingAs($outsider)->post(route('retros.join.store', $retro->guest_token), ['name' => 'Olga']);

    expect($retro->participants()->where('guest_name', 'Olga')->whereNull('user_id')->exists())->toBeTrue()
        ->and($outsider->can('view', $retro->team))->toBeFalse();
});

it('shares the guest link with the facilitator only', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $member] = retroMember($retro);

    $snapshot = app(BuildBoardSnapshot::class);

    expect($snapshot->handle($retro->fresh(), $facilitator)['retro']['guestUrl'])->toBe(route('retros.join.show', $retro->guest_token))
        ->and($snapshot->handle($retro->fresh(), $member)['retro']['guestUrl'])->toBeNull();

    $retro->update(['guest_access_enabled' => false]);

    expect($snapshot->handle($retro->fresh(), $facilitator)['retro']['guestUrl'])->toBeNull();
});
