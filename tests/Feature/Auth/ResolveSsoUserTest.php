<?php

use App\Actions\Auth\ResolveSsoUser;
use App\Enums\SsoProvider;
use App\Enums\WorkspaceRole;
use App\Exceptions\SsoLoginRefused;
use App\Models\SocialAccount;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Laravel\Socialite\Two\User as SocialiteUser;

function resolveSso(SsoProvider $provider, array $attributes, ?WorkspaceInvitation $invitation = null): User
{
    return app(ResolveSsoUser::class)->handle($provider, SocialiteUser::fake($attributes), $invitation);
}

beforeEach(function () {
    config(['skrum.signup_mode' => 'open']);
});

it('logs in the linked account even when the provider email changed', function () {
    $user = User::factory()->create(['email' => 'old@example.test']);
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'abc']);

    $resolved = resolveSso(SsoProvider::Google, ['id' => 'abc', 'email' => 'new@example.test', 'email_verified' => true]);

    expect($resolved->is($user))->toBeTrue()
        ->and(User::count())->toBe(1);
});

it('matches numeric provider ids as strings', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'github', 'provider_user_id' => '42']);

    expect(resolveSso(SsoProvider::GitHub, ['id' => 42, 'email' => null])->is($user))->toBeTrue();
});

it('links an existing account through a verified email, case-insensitively', function () {
    $user = User::factory()->create(['email' => 'bob@example.test']);

    $resolved = resolveSso(SsoProvider::Google, ['id' => 'g-1', 'email' => 'Bob@Example.test', 'email_verified' => true]);

    expect($resolved->is($user))->toBeTrue()
        ->and($user->socialAccounts()->where('provider', 'google')->value('provider_user_id'))->toBe('g-1');
});

it('refuses to link into an account whose email was never verified', function () {
    $user = User::factory()->unverified()->create(['email' => 'bob@example.test']);

    expect(fn () => resolveSso(SsoProvider::Google, ['id' => 'g-1', 'email' => 'bob@example.test', 'email_verified' => true]))
        ->toThrow(SsoLoginRefused::class, 'An account already uses this email address. Log in with your password instead.');

    expect(SocialAccount::count())->toBe(0)
        ->and($user->fresh()->email_verified_at)->toBeNull();
});

it('refuses to link an existing account through an unverified email', function () {
    User::factory()->create(['email' => 'bob@example.test']);

    expect(fn () => resolveSso(SsoProvider::Google, ['id' => 'g-1', 'email' => 'bob@example.test', 'email_verified' => false]))
        ->toThrow(SsoLoginRefused::class, 'An account already uses this email address. Log in with your password instead.');

    expect(SocialAccount::count())->toBe(0);
});

it('links entra accounts only when xms_edov is true', function () {
    $user = User::factory()->create(['email' => 'ann@acme.test']);

    expect(fn () => resolveSso(SsoProvider::Entra, ['id' => 'e-1', 'email' => 'ann@acme.test']))
        ->toThrow(SsoLoginRefused::class);

    expect(resolveSso(SsoProvider::Entra, ['id' => 'e-1', 'email' => 'ann@acme.test', 'xms_edov' => true])->is($user))->toBeTrue();
});

it('creates a verified account for a new person', function () {
    User::factory()->create();

    $user = resolveSso(SsoProvider::Google, ['id' => 'g-2', 'name' => 'New Person', 'email' => 'new@example.test', 'email_verified' => true]);

    expect($user->email)->toBe('new@example.test')
        ->and($user->name)->toBe('New Person')
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($user->is_instance_admin)->toBeFalse()
        ->and($user->locale)->toBe('en')
        ->and($user->socialAccounts()->sole()->provider)->toBe('google');
});

it('makes the first user an instance admin', function () {
    config(['skrum.signup_mode' => 'invite']);

    $user = resolveSso(SsoProvider::GitHub, ['id' => 7, 'email' => 'first@example.test']);

    expect($user->is_instance_admin)->toBeTrue();
});

it('falls back to the nickname then the email for the name', function (array $attributes, string $expectedName) {
    User::factory()->create();

    $user = resolveSso(SsoProvider::GitHub, ['id' => 8, 'email' => 'octo.cat@example.test', ...$attributes]);

    expect($user->name)->toBe($expectedName);
})->with([
    'nickname' => [['name' => null, 'nickname' => 'octocat'], 'octocat'],
    'email local part' => [['name' => null, 'nickname' => null], 'octo.cat'],
]);

it('refuses when the provider returns no email', function () {
    User::factory()->create();

    expect(fn () => resolveSso(SsoProvider::GitHub, ['id' => 9, 'email' => null]))
        ->toThrow(SsoLoginRefused::class, 'GitHub did not share an email address with us.');
});

it('refuses to create an account from an unverified email', function () {
    User::factory()->create();

    expect(fn () => resolveSso(SsoProvider::Oidc, ['id' => 's-1', 'email' => 'new@example.test', 'email_verified' => false]))
        ->toThrow(SsoLoginRefused::class);

    expect(User::count())->toBe(1);
});

it('applies the signup gate', function () {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);

    expect(fn () => resolveSso(SsoProvider::Google, ['id' => 'g-3', 'email' => 'new@example.test', 'email_verified' => true]))
        ->toThrow(SsoLoginRefused::class, 'Signups are restricted on this instance.');
});

it('creates and joins through a matching invitation even without a verified email', function () {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);
    $invitation = WorkspaceInvitation::factory()->create(['email' => 'Guest@Example.test', 'role' => WorkspaceRole::Admin]);

    $user = resolveSso(SsoProvider::Entra, ['id' => 'e-2', 'email' => 'guest@example.test'], $invitation);

    expect($user->roleIn($invitation->workspace))->toBe(WorkspaceRole::Admin)
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($invitation->fresh()->accepted_at)->not->toBeNull();
});

it('ignores an invitation addressed to someone else', function () {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);
    $invitation = WorkspaceInvitation::factory()->create(['email' => 'invited@example.test']);

    expect(fn () => resolveSso(SsoProvider::Oidc, ['id' => 's-2', 'email' => 'other@example.test', 'email_verified' => false], $invitation))
        ->toThrow(SsoLoginRefused::class);

    expect($invitation->fresh()->accepted_at)->toBeNull();
});

it('refuses a provider user without an id', function () {
    expect(fn () => resolveSso(SsoProvider::Google, ['id' => '', 'email' => 'ann@acme.test', 'email_verified' => true]))
        ->toThrow(SsoLoginRefused::class, 'Sign-in with Google failed. Please try again.');

    expect(User::count())->toBe(0);
});
