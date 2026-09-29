<?php

use App\Enums\SsoProvider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use SocialiteProviders\OpenIDConnect\Provider as OidcProvider;
use SocialiteProviders\OpenIDConnect\Providers\EntraProvider;

beforeEach(function () {
    config([
        'services.google.client_id' => null,
        'services.google.client_secret' => null,
        'services.github.client_id' => null,
        'services.github.client_secret' => null,
        'oidc.connections.entra.client_id' => null,
        'oidc.connections.entra.client_secret' => null,
        'oidc.connections.generic.base_url' => null,
        'oidc.connections.generic.client_id' => null,
        'oidc.connections.generic.client_secret' => null,
        'oidc.connections.generic.label' => null,
    ]);
});

it('enables no provider without credentials', function () {
    expect(SsoProvider::enabled())->toBe([])
        ->and(SsoProvider::options())->toBe([]);
});

it('enables a provider only when every credential is present', function () {
    config(['services.google.client_id' => 'id']);

    expect(SsoProvider::Google->isEnabled())->toBeFalse();

    config(['services.google.client_secret' => 'secret']);

    expect(SsoProvider::Google->isEnabled())->toBeTrue()
        ->and(SsoProvider::options())->toBe([['key' => 'google', 'label' => 'Google']]);
});

it('requires a base url for the generic oidc provider', function () {
    config([
        'oidc.connections.generic.client_id' => 'id',
        'oidc.connections.generic.client_secret' => 'secret',
    ]);

    expect(SsoProvider::Oidc->isEnabled())->toBeFalse();

    config(['oidc.connections.generic.base_url' => 'https://id.example.test']);

    expect(SsoProvider::Oidc->isEnabled())->toBeTrue();
});

it('labels the generic oidc provider from config', function () {
    expect(SsoProvider::Oidc->label())->toBe('Single sign-on');

    config(['oidc.connections.generic.label' => 'Acme ID']);

    expect(SsoProvider::Oidc->label())->toBe('Acme ID');
});

it('maps providers to socialite drivers', function (SsoProvider $provider, string $driver) {
    expect($provider->driver())->toBe($driver);
})->with([
    [SsoProvider::Google, 'google'],
    [SsoProvider::GitHub, 'github'],
    [SsoProvider::Entra, 'oidc_entra'],
    [SsoProvider::Oidc, 'oidc_generic'],
]);

it('decides which provider emails are verified', function (SsoProvider $provider, array $attributes, ?string $expected) {
    $user = SocialiteUser::fake(['email' => 'person@example.test'])->setRaw($attributes);

    expect($provider->verifiedEmail($user))->toBe($expected);
})->with([
    'google verified' => [SsoProvider::Google, ['email_verified' => true], 'person@example.test'],
    'google unverified' => [SsoProvider::Google, ['email_verified' => false], null],
    'google missing claim' => [SsoProvider::Google, [], null],
    'github always verified' => [SsoProvider::GitHub, [], 'person@example.test'],
    'entra with xms_edov' => [SsoProvider::Entra, ['xms_edov' => true, 'email' => 'person@example.test'], 'person@example.test'],
    'entra with string xms_edov' => [SsoProvider::Entra, ['xms_edov' => '1', 'email' => 'person@example.test'], 'person@example.test'],
    'entra without email claim' => [SsoProvider::Entra, ['xms_edov' => true], null],
    'entra with different email claim' => [SsoProvider::Entra, ['xms_edov' => true, 'email' => 'other@example.test'], null],
    'entra with email claim in other case' => [SsoProvider::Entra, ['xms_edov' => true, 'email' => ' Person@Example.test '], 'person@example.test'],
    'entra without xms_edov' => [SsoProvider::Entra, ['email_verified' => true], null],
    'oidc verified' => [SsoProvider::Oidc, ['email_verified' => 'true'], 'person@example.test'],
    'oidc unverified' => [SsoProvider::Oidc, ['email_verified' => false], null],
]);

it('treats a missing email as unverified', function () {
    $user = SocialiteUser::fake(['email' => null, 'email_verified' => true]);

    expect(SsoProvider::Google->verifiedEmail($user))->toBeNull();
});

it('wires the entra driver to the openid connect entra provider', function () {
    config([
        'services.oidc_entra' => [
            'client_id' => 'id',
            'client_secret' => 'secret',
            'redirect' => 'https://skrum.test/auth/entra/callback',
            'tenant' => 'common',
        ],
    ]);

    expect(Socialite::driver('oidc_entra'))->toBeInstanceOf(EntraProvider::class);
});

it('wires the generic driver to the openid connect provider', function () {
    config([
        'services.oidc_generic' => [
            'client_id' => 'id',
            'client_secret' => 'secret',
            'redirect' => 'https://skrum.test/auth/oidc/callback',
            'base_url' => 'https://id.example.test',
        ],
    ]);

    expect(Socialite::driver('oidc_generic'))->toBeInstanceOf(OidcProvider::class);
});

it('sends a pkce challenge to google', function () {
    config([
        'services.google.client_id' => 'id',
        'services.google.client_secret' => 'secret',
        'services.google.redirect' => 'https://skrum.test/auth/google/callback',
    ]);

    request()->setLaravelSession(app('session.store'));

    $location = SsoProvider::Google->socialiteDriver()->redirect()->headers->get('Location');

    expect($location)->toContain('code_challenge=')->toContain('code_challenge_method=S256');
});
