<?php

use App\Models\PersonalAccessToken;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Fortify\Features;

/*
 * The account settings open without a password. Each action that used to sit
 * behind the confirmed page asks for the confirmation itself: refused
 * without it, let through with it, whoever the account belongs to.
 */

beforeEach(function () {
    Features::twoFactorAuthentication(['confirm' => true, 'confirmPassword' => true]);
    Features::passkeys(['confirmPassword' => true]);
    config([
        'skrum.mcp.enabled' => true,
        'mail.default' => 'smtp',
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
    ]);
    Mail::fake();
});

/**
 * @return array<string, array{0: string, 1: string, 2: array<string, mixed>}>
 */
function guardedAccountActions(): array
{
    return [
        'open the security section' => ['get', 'security.edit', []],
        'open the API token section' => ['get', 'apiTokens.index', []],
        'turn the authenticator app on' => ['post', 'two-factor.enable', []],
        'confirm the authenticator app' => ['post', 'two-factor.confirm', ['code' => '000000']],
        'turn the authenticator app off' => ['delete', 'two-factor.disable', []],
        'read the QR code' => ['get', 'two-factor.qr-code', []],
        'read the setup key' => ['get', 'two-factor.secret-key', []],
        'show the recovery codes' => ['get', 'two-factor.recovery-codes', []],
        'regenerate the recovery codes' => ['post', 'two-factor.regenerate-recovery-codes', []],
        'ask for the options of a new passkey' => ['get', 'passkey.registration-options', []],
        'add a passkey' => ['post', 'passkey.store', ['name' => 'Laptop', 'credential' => []]],
        'remove a passkey' => ['delete', 'passkey.destroy', []],
        'ask for an e-mail code' => ['post', 'emailSecondFactor.codes.store', []],
        'turn the e-mail code on' => ['post', 'emailSecondFactor.store', ['code' => '000000']],
        'turn the e-mail code off' => ['delete', 'emailSecondFactor.destroy', []],
        'create a token' => ['post', 'apiTokens.store', ['name' => 'Laptop', 'expiration' => '90_days']],
        'revoke a token' => ['delete', 'apiTokens.destroy', []],
    ];
}

/**
 * @return array<string, array{0: Closure(): User}>
 */
function guardedAccounts(): array
{
    $ssoOnly = function (): User {
        $user = User::factory()->withTwoFactor()->create(['password' => Str::password(64)]);

        SocialAccount::factory()->for($user)->create();

        return $user;
    };

    return [
        'an account with a password' => [fn (): User => User::factory()->withTwoFactor()->create()],
        'an account that only signs in through SSO' => [$ssoOnly],
        'an account while SSO is required' => [function () use ($ssoOnly): User {
            resolve(InstanceSettings::class)->set('sso_required', true);

            return $ssoOnly();
        }],
    ];
}

/**
 * @param  array<string, mixed>  $payload
 */
function accountAction(User $user, string $method, string $route, array $payload, bool $json = false): TestResponse
{
    $parameters = match ($route) {
        'apiTokens.destroy' => [PersonalAccessToken::factory()->forUser($user)->create()->id],
        'passkey.destroy' => [$user->passkeys()->create([
            'name' => 'Laptop',
            'credential_id' => Str::random(16),
            'credential' => ['id' => 'credential', 'publicKey' => 'key'],
        ])->id],
        default => [],
    };

    $url = route($route, $parameters);

    if ($json) {
        return test()->actingAs($user)->json($method, $url, $payload);
    }

    return $method === 'get'
        ? test()->actingAs($user)->get($url)
        : test()->actingAs($user)->{$method}($url, $payload);
}

/**
 * What an account holds that the guarded actions could change.
 *
 * @return array<string, mixed>
 */
function accountSecurityState(User $user): array
{
    $user->refresh();

    return [
        'app' => $user->two_factor_confirmed_at?->toIso8601String(),
        'secret' => $user->two_factor_secret,
        'codes' => $user->two_factor_recovery_codes,
        'email' => $user->two_factor_email_enabled_at?->toIso8601String(),
        'passkeys' => $user->passkeys()->count(),
        'tokens' => $user->tokens()->count(),
    ];
}

it('refuses the action without a confirmed password', function (string $method, string $route, array $payload, Closure $account) {
    $user = $account();
    $before = accountSecurityState($user);

    $response = accountAction($user, $method, $route, $payload);

    $response->assertRedirect(route('password.confirm'));
    expect($response->getContent())->not->toContain('recovery-code-1');

    $after = accountSecurityState($user);

    expect([...$after, 'passkeys' => 0, 'tokens' => 0])->toBe([...$before, 'passkeys' => 0, 'tokens' => 0])
        ->and($after['passkeys'])->toBe($route === 'passkey.destroy' ? 1 : 0)
        ->and($after['tokens'])->toBe($route === 'apiTokens.destroy' ? 1 : 0);
})->with(guardedAccountActions())->with(guardedAccounts());

it('answers 423 to a JSON request without a confirmed password', function (string $method, string $route, array $payload) {
    $user = User::factory()->withTwoFactor()->create();

    $response = accountAction($user, $method, $route, $payload, json: true);

    $response->assertStatus(423);
    expect($response->getContent())->not->toContain('recovery-code-1');
})->with(guardedAccountActions());

it('refuses the action once the confirmation is older than the timeout', function (string $method, string $route, array $payload) {
    $user = User::factory()->withTwoFactor()->create();

    session(['auth.password_confirmed_at' => time() - config('auth.password_timeout') - 1]);

    accountAction($user, $method, $route, $payload)->assertRedirect(route('password.confirm'));
})->with(guardedAccountActions());

it('lets the action through after the password is confirmed', function (string $method, string $route, array $payload, Closure $account) {
    $user = $account();

    session(['auth.password_confirmed_at' => time()]);

    $response = accountAction($user, $method, $route, $payload);

    expect($response->getStatusCode())->not->toBe(423)
        ->and($response->headers->get('Location'))->not->toBe(route('password.confirm'));
})->with(guardedAccountActions())->with(guardedAccounts());

it('does what was asked after the password is confirmed', function () {
    $user = User::factory()->withTwoFactor()->withEmailSecondFactor()->create();
    $token = PersonalAccessToken::factory()->forUser($user)->create();

    session(['auth.password_confirmed_at' => time()]);

    $this->actingAs($user)->getJson(route('two-factor.recovery-codes'))->assertOk()->assertJson(['recovery-code-1']);

    $this->actingAs($user)->delete(route('emailSecondFactor.destroy'))->assertRedirect();
    expect($user->fresh()->two_factor_email_enabled_at)->toBeNull();

    $this->actingAs($user)->delete(route('apiTokens.destroy', $token->id))->assertRedirect();
    expect($user->tokens()->count())->toBe(0);

    $this->actingAs($user)->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => '90_days'])->assertSessionHasNoErrors();
    expect($user->tokens()->count())->toBe(1);

    $this->actingAs($user)->delete(route('two-factor.disable'))->assertRedirect();
    expect($user->fresh()->two_factor_secret)->toBeNull();
});

it('confirms a password only when it is the right one, so an account that knows none stays refused', function () {
    $user = User::factory()->create(['password' => Str::password(64)]);

    $this->actingAs($user)
        ->from(route('password.confirm'))
        ->post(route('password.confirm.store'), ['password' => 'password'])
        ->assertSessionHasErrors('password');

    expect(session('auth.password_confirmed_at'))->toBeNull();

    $this->actingAs($user)->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => '90_days'])
        ->assertRedirect(route('password.confirm'));

    expect($user->tokens()->count())->toBe(0);
});

it('still asks an unverified account to verify its address before any of the actions of this application', function (string $method, string $route, array $payload) {
    $user = User::factory()->unverified()->create();

    session(['auth.password_confirmed_at' => time()]);

    accountAction($user, $method, $route, $payload)->assertRedirect(route('verification.notice'));
})->with([
    'open the security section' => ['get', 'security.edit', []],
    'open the API token section' => ['get', 'apiTokens.index', []],
    'ask for an e-mail code' => ['post', 'emailSecondFactor.codes.store', []],
    'turn the e-mail code on' => ['post', 'emailSecondFactor.store', ['code' => '000000']],
    'turn the e-mail code off' => ['delete', 'emailSecondFactor.destroy', []],
    'create a token' => ['post', 'apiTokens.store', ['name' => 'Laptop', 'expiration' => '90_days']],
    'revoke a token' => ['delete', 'apiTokens.destroy', []],
]);
