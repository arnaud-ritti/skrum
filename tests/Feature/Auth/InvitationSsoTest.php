<?php

use App\Models\SocialAccount;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\InstanceSettings;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    config([
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'services.github.client_id' => null,
        'services.github.client_secret' => null,
        'skrum.signup_mode' => 'invite',
    ]);
    User::factory()->instanceAdmin()->create();
});

function followInvitation(mixed $test, string $email = 'guest@example.test', string $token = 'secret-token'): WorkspaceInvitation
{
    $invitation = WorkspaceInvitation::factory()->withToken($token)->create(['email' => $email]);

    $test->get(route('invitations.show', $token))->assertOk();

    return $invitation;
}

function ssoAnswers(array $attributes): void
{
    Socialite::fake('google', SocialiteUser::fake($attributes));
}

it('offers the providers to a guest with a pending invitation only', function () {
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'guest@example.test']);

    $this->get(route('invitations.show', 'secret-token'))->assertInertia(fn (Assert $page) => $page
        ->where('ssoProviders', [['key' => 'google', 'label' => 'Google']])
        ->where('canRegister', true));

    $this->actingAs(User::factory()->create())->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page->where('ssoProviders', []));

    auth()->logout();
    $invitation->forceFill(['expires_at' => now()->subMinute()])->save();

    $this->get(route('invitations.show', 'secret-token'))->assertInertia(fn (Assert $page) => $page->missing('ssoProviders'));
    $this->get(route('invitations.show', 'unknown'))->assertNotFound()->assertInertia(fn (Assert $page) => $page->missing('ssoProviders'));
});

it('offers no password account on the invitation page when single sign-on is required', function () {
    resolve(InstanceSettings::class)->set('sso_required', true);
    WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'guest@example.test']);

    $this->get(route('invitations.show', 'secret-token'))->assertInertia(fn (Assert $page) => $page
        ->where('canRegister', false)
        ->where('ssoRequired', true)
        ->has('ssoProviders', 1));
});

it('refuses an address the provider does not mark verified, even with a matching invitation', function () {
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-0', 'email' => 'guest@example.test', 'email_verified' => false]);

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Google did not confirm your email address.']);

    $this->assertGuest();
    expect($invitation->fresh()->accepted_at)->toBeNull()
        ->and(User::query()->where('email', 'guest@example.test')->exists())->toBeFalse()
        ->and(session('invitation_token'))->toBe('secret-token');
});

it('creates the account and joins the workspace when the provider returns the invited address', function (string $spelling) {
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-1', 'email' => $spelling, 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    $user = User::query()->where('email', 'guest@example.test')->sole();
    $this->assertAuthenticatedAs($user);
    expect($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and($user->belongsToWorkspace($invitation->workspace))->toBeTrue()
        ->and(session('invitation_token'))->toBeNull();
})->with(['guest@example.test', 'Guest@Example.test', ' guest@example.test ']);

it('never sends the invitation token to the provider and never reads it from the callback', function () {
    $invitation = followInvitation($this);

    $location = (string) $this->get(route('sso.redirect', 'google'))->headers->get('Location');
    expect($location)->not->toContain('secret-token');

    $this->flushSession();
    ssoAnswers(['id' => 'g-2', 'email' => 'guest@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', ['provider' => 'google', 'invitation_token' => 'secret-token', 'token' => 'secret-token']))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Signups are restricted on this instance.']);

    $this->assertGuest();
    expect($invitation->fresh()->accepted_at)->toBeNull();
});

it('gives nothing to an identity whose address is not the invited one', function () {
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-3', 'email' => 'someone-else@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Signups are restricted on this instance.']);

    $this->assertGuest();
    expect($invitation->fresh()->accepted_at)->toBeNull()
        ->and(User::query()->where('email', 'someone-else@example.test')->exists())->toBeFalse()
        ->and(session('invitation_token'))->toBe('secret-token');
});

it('signs a different address in to its own account, outside the workspace, when sign-up is open', function () {
    config(['skrum.signup_mode' => 'open']);
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-4', 'email' => 'someone-else@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('invitations.show', 'secret-token'));

    $user = User::query()->where('email', 'someone-else@example.test')->sole();
    $this->assertAuthenticatedAs($user);
    expect($invitation->fresh()->accepted_at)->toBeNull()
        ->and($user->belongsToWorkspace($invitation->workspace))->toBeFalse();

    $this->get(route('invitations.show', 'secret-token'))->assertInertia(fn (Assert $page) => $page
        ->where('isLoggedIn', true)
        ->where('emailMatches', false));
    $this->post(route('invitations.acceptance.store', 'secret-token'))->assertForbidden();

    expect($invitation->fresh()->accepted_at)->toBeNull();
});

it('never links or opens the account that owns the invited address to another identity', function () {
    config(['skrum.signup_mode' => 'open']);
    $owner = User::factory()->create(['email' => 'guest@example.test']);
    followInvitation($this);
    ssoAnswers(['id' => 'g-5', 'email' => 'attacker@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('invitations.show', 'secret-token'));

    $this->assertAuthenticatedAs(User::query()->where('email', 'attacker@example.test')->sole());
    expect(auth()->id())->not->toBe($owner->id)
        ->and(SocialAccount::query()->where('user_id', $owner->id)->exists())->toBeFalse()
        ->and($owner->fresh()->email)->toBe('guest@example.test');
});

it('refuses an unverified provider address that claims an existing account, invitation or not', function () {
    $owner = User::factory()->create(['email' => 'guest@example.test']);
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-6', 'email' => 'guest@example.test', 'email_verified' => false]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('login'))->assertSessionHasErrors('email');

    $this->assertGuest();
    expect(SocialAccount::query()->where('user_id', $owner->id)->exists())->toBeFalse()
        ->and($invitation->fresh()->accepted_at)->toBeNull();
});

it('signs in a linked account whose address differs, and its acceptance is refused', function () {
    $linked = User::factory()->create(['email' => 'other@example.test']);
    SocialAccount::factory()->for($linked)->create(['provider' => 'google', 'provider_user_id' => 'g-7']);
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-7', 'email' => 'guest@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('invitations.show', 'secret-token'));

    $this->assertAuthenticatedAs($linked);
    $this->post(route('invitations.acceptance.store', 'secret-token'))->assertForbidden();
    expect($invitation->fresh()->accepted_at)->toBeNull();
});

it('asks an existing account for its second factor before anything is joined', function () {
    $member = User::factory()->withTwoFactor()->create(['email' => 'guest@example.test']);
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-8', 'email' => 'guest@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
    expect($invitation->fresh()->accepted_at)->toBeNull()
        ->and($member->belongsToWorkspace($invitation->workspace))->toBeFalse()
        ->and(session('invitation_token'))->toBe('secret-token');

    $this->actingAs($member)->post(route('invitations.acceptance.store', 'secret-token'))
        ->assertRedirect(route('workspaces.show', $invitation->workspace));

    expect($invitation->fresh()->accepted_at)->not->toBeNull();
});

it('gives no right through an expired or already accepted invitation', function (array $state) {
    WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'guest@example.test', ...$state]);
    $this->get(route('invitations.show', 'secret-token'));
    ssoAnswers(['id' => 'g-9', 'email' => 'guest@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Signups are restricted on this instance.']);

    $this->assertGuest();
    expect(User::query()->where('email', 'guest@example.test')->exists())->toBeFalse();
})->with([
    'expired' => [['expires_at' => '2020-01-01 00:00:00']],
    'accepted' => [['accepted_at' => '2020-01-01 00:00:00']],
]);

it('does not auto-accept for an existing verified account and returns to the invitation page', function () {
    $user = User::factory()->create(['email' => 'member@example.test']);
    $invitation = followInvitation($this, 'member@example.test');
    ssoAnswers(['id' => 'g-10', 'email' => 'member@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('invitations.show', 'secret-token'));

    $this->assertAuthenticatedAs($user);
    expect($user->belongsToWorkspace($invitation->workspace))->toBeFalse()
        ->and($invitation->fresh()->accepted_at)->toBeNull();

    $this->post(route('invitations.acceptance.store', 'secret-token'))
        ->assertRedirect(route('workspaces.show', $invitation->workspace));

    expect($user->belongsToWorkspace($invitation->workspace))->toBeTrue();
});
