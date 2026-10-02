<?php

use App\Models\SocialAccount;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    User::factory()->create();

    config([
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'services.github.client_id' => null,
        'services.github.client_secret' => null,
        'skrum.signup_mode' => 'invite',
    ]);
});

it('creates an account, joins the workspace and clears the token for the invited verified address', function () {
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'guest@example.test']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-1', 'email' => 'guest@example.test', 'email_verified' => true]));

    $this->get(route('invitations.show', 'secret-token'));
    $this->get(route('sso.callback', 'google'));

    $user = User::firstWhere('email', 'guest@example.test');

    $this->assertAuthenticatedAs($user);
    expect($user->belongsToWorkspace($invitation->workspace))->toBeTrue()
        ->and($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and(session('invitation_token'))->toBeNull();
});

it('keeps the invitation pending and refuses sign-in with another address in invite mode', function () {
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'guest@example.test']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-2', 'email' => 'other@example.test', 'email_verified' => true]));

    $this->get(route('invitations.show', 'secret-token'));

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Signups are restricted on this instance.']);

    $this->assertGuest();
    expect($invitation->fresh()->accepted_at)->toBeNull()
        ->and($invitation->fresh()->isPending())->toBeTrue()
        ->and(User::firstWhere('email', 'other@example.test'))->toBeNull();
});

it('does not auto-accept for an existing verified account and returns to the invitation page', function () {
    $user = User::factory()->create(['email' => 'member@example.test']);
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'member@example.test']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-3', 'email' => 'member@example.test', 'email_verified' => true]));

    $this->get(route('invitations.show', 'secret-token'));

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('invitations.show', 'secret-token'));

    $this->assertAuthenticatedAs($user);
    expect($user->belongsToWorkspace($invitation->workspace))->toBeFalse()
        ->and($invitation->fresh()->accepted_at)->toBeNull();

    $this->post(route('invitations.acceptance.store', 'secret-token'))
        ->assertRedirect(route('workspaces.show', $invitation->workspace));

    expect($user->belongsToWorkspace($invitation->workspace))->toBeTrue();
});

it('sends a user with a confirmed second factor to the challenge and joins nothing before it', function () {
    $user = User::factory()->withTwoFactor()->create(['email' => 'member@example.test']);
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'g-4']);
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'member@example.test']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-4', 'email' => 'member@example.test', 'email_verified' => true]));

    $this->get(route('invitations.show', 'secret-token'));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
    expect(session('login.id'))->toBe($user->id)
        ->and($user->belongsToWorkspace($invitation->workspace))->toBeFalse()
        ->and($invitation->fresh()->accepted_at)->toBeNull();
});
