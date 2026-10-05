<?php

use App\Models\SocialAccount;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Request;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    config([
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'services.github.client_id' => null,
        'services.github.client_secret' => null,
        'skrum.signup_mode' => 'open',
    ]);
});

it('redirects to an enabled provider', function () {
    Socialite::fake('google');

    $this->get(route('sso.redirect', 'google'))
        ->assertRedirect('https://socialite.fake/google/authorize');
});

it('returns not found for disabled or unknown providers', function (string $provider) {
    $this->get("/auth/{$provider}/redirect")->assertNotFound();
    $this->get("/auth/{$provider}/callback")->assertNotFound();
})->with(['github', 'myspace']);

it('logs in a linked user and sends them to the dashboard', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'g-1']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-1']));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($user);
});

it('creates an account for a new verified person', function () {
    User::factory()->create();
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-2', 'email' => 'new@example.test', 'email_verified' => true]));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs(User::firstWhere('email', 'new@example.test'));
});

it('sends users with two-factor authentication to the challenge', function () {
    $user = User::factory()->withTwoFactor()->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'g-3']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-3']));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
    expect(session('login.id'))->toBe($user->id);
});

it('accepts a user without a confirmed secret when confirmation is disabled', function () {
    config(['fortify-options.two-factor-authentication.confirm' => false]);
    $user = User::factory()->withTwoFactor()->create(['two_factor_confirmed_at' => null]);
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'g-6']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-6']));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
});

it('logs in a user with an unconfirmed secret when confirmation is required', function () {
    config(['fortify-options.two-factor-authentication.confirm' => true]);
    $user = User::factory()->withTwoFactor()->create(['two_factor_confirmed_at' => null]);
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'g-7']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-7']));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($user);
});

it('returns to the login page when the redirect step fails', function () {
    $discovery = new MockHandler([new ConnectException('The identity provider is down.', new Request('GET', 'https://id.example.test/.well-known/openid-configuration'))]);
    config([
        'oidc.connections.generic.base_url' => 'https://id.example.test',
        'oidc.connections.generic.client_id' => 'id',
        'oidc.connections.generic.client_secret' => 'secret',
        'services.oidc_generic' => [
            'base_url' => 'https://id.example.test',
            'client_id' => 'id',
            'client_secret' => 'secret',
            'redirect' => 'https://skrum.test/auth/oidc/callback',
            'guzzle' => ['handler' => HandlerStack::create($discovery)],
        ],
    ]);

    $this->get(route('sso.redirect', 'oidc'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Sign-in with Single sign-on failed. Please try again.']);

    expect($discovery->count())->toBe(0);

    $this->assertGuest();
});

it('returns to the login page when the provider fails', function () {
    Socialite::fake('google', fn () => throw new InvalidStateException);

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Sign-in with Google failed. Please try again.']);

    $this->assertGuest();
});

it('returns to the login page with the refusal reason', function () {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-4', 'email' => 'new@example.test', 'email_verified' => true]));

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Signups are restricted on this instance.']);
});

it('accepts a followed invitation and clears it from the session', function () {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'guest@example.test']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-5', 'email' => 'guest@example.test', 'email_verified' => true]));

    $this->get(route('invitations.show', 'secret-token'));
    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    expect($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and(session('invitation_token'))->toBeNull()
        ->and(session('url.intended'))->toBeNull();
});

it('keeps logged in users away from sso routes', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('sso.redirect', 'google'))
        ->assertRedirect(route('dashboard'));
});
