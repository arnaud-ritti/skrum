<?php

use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SignInMethods;
use App\Support\InstanceSettings;
use Illuminate\Support\Str;

beforeEach(fn () => config([
    'services.google.client_id' => 'g', 'services.google.client_secret' => 's',
    'services.github.client_id' => 'h', 'services.github.client_secret' => 't',
    'mail.default' => 'array',
]));

/**
 * @return array<int, string>
 */
function ways(User $user, ?SocialAccount $without = null): array
{
    return resolve(SignInMethods::class)->remaining($user->fresh(), $without);
}

it('counts a known password, linked providers, a magic link and a passkey', function () {
    config(['mail.default' => 'smtp']);
    $user = User::factory()->create();
    $google = SocialAccount::factory()->for($user)->create(['provider' => 'google']);

    expect(ways($user))->toBe(['sso:google', 'password', 'magic_link'])
        ->and(ways($user, $google))->toBe(['password', 'magic_link']);

    $user->passkeys()->create([
        'name' => 'Laptop',
        'credential_id' => Str::random(16),
        'credential' => ['id' => 'credential', 'publicKey' => 'key'],
    ]);

    expect(ways($user))->toBe(['sso:google', 'password', 'magic_link', 'passkey']);
});

it('does not count a password nobody chose, nor a provider turned off', function () {
    $user = User::factory()->create(['password_set_at' => null]);
    SocialAccount::factory()->for($user)->create(['provider' => 'entra']);

    expect(ways($user))->toBe([]);
});

it('counts only single sign-on for a member while it is required', function () {
    config(['mail.default' => 'smtp']);
    resolve(InstanceSettings::class)->set('sso_required', true);
    $user = User::factory()->create();
    $google = SocialAccount::factory()->for($user)->create(['provider' => 'google']);
    $user->passkeys()->create([
        'name' => 'Laptop',
        'credential_id' => Str::random(16),
        'credential' => ['id' => 'credential', 'publicKey' => 'key'],
    ]);

    expect(ways($user))->toBe(['sso:google'])
        ->and(ways($user, $google))->toBe([])
        ->and(resolve(SignInMethods::class)->isManagedByAdmin($google))->toBeTrue();
});

it('lets nothing be managed by the admin while single sign-on is optional', function () {
    $google = SocialAccount::factory()->for(User::factory()->create())->create(['provider' => 'google']);

    expect(resolve(SignInMethods::class)->isManagedByAdmin($google))->toBeFalse();
});
