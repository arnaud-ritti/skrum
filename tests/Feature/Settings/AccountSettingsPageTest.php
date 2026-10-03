<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\PersonalAccessToken;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

beforeEach(function () {
    Features::twoFactorAuthentication(['confirm' => true, 'confirmPassword' => true]);
    Features::passkeys(['confirmPassword' => true]);
    config(['skrum.mcp.enabled' => true, 'mail.default' => 'smtp']);
});

function accountWithSecrets(array $attributes = []): User
{
    $user = User::factory()->withTwoFactor()->withEmailSecondFactor()->create($attributes);

    $user->passkeys()->create([
        'name' => 'Laptop of Mona',
        'credential_id' => 'credential-of-mona',
        'credential' => ['id' => 'credential-of-mona', 'publicKey' => 'key', 'aaguid' => null],
    ]);
    PersonalAccessToken::factory()->forUser($user)->create(['name' => 'Claude of Mona', 'token_hint' => 'zq9x']);

    return $user;
}

function ssoOnlyAccount(): User
{
    $user = accountWithSecrets(['password' => Str::password(64)]);

    SocialAccount::factory()->for($user)->create();

    return $user;
}

it('asks a guest to sign in', function () {
    $this->get(route('settings.edit'))->assertRedirect(route('login'));
});

it('shows every section on one page, and nothing the account settings protect, before the password is confirmed', function (Closure $account) {
    $user = $account();

    $response = $this->actingAs($user)->get(route('settings.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/account')
            ->where('profile.mustVerifyEmail', true)
            ->where('appearance.reduceMotion', false)
            ->has('notificationPreferences.preferences')
            ->where('security.locked', true)
            ->where('security.protected', null)
            ->where('security.canManageTwoFactor', true)
            ->where('security.canManagePasskeys', true)
            ->where('security.canManageEmailCode', true)
            ->has('security.passwordRules')
            ->where('apiTokens.locked', true)
            ->where('apiTokens.protected', null)
            ->where('apiTokens.defaultExpiration', '90_days')
            ->has('apiTokens.expirationOptions', 4));

    expect(array_keys($response->viewData('page')['props']['security']))->toEqualCanonicalizing([
        'passwordRules', 'checksCompromisedPasswords', 'canManageTwoFactor', 'canManagePasskeys',
        'canManageEmailCode', 'requiresConfirmation', 'locked', 'protected',
    ])->and(array_keys($response->viewData('page')['props']['apiTokens']))->toEqualCanonicalizing([
        'expirationOptions', 'defaultExpiration', 'locked', 'protected',
    ]);

    $props = json_encode($response->viewData('page')['props']['security']).json_encode($response->viewData('page')['props']['apiTokens']);

    expect($props)->not->toContain('Laptop of Mona')
        ->not->toContain('Claude of Mona')
        ->not->toContain('zq9x')
        ->not->toContain('twoFactorEnabled')
        ->not->toContain('recoveryCodesRemaining')
        ->not->toContain('confirmedAt')
        ->not->toContain('emailSecondFactor')
        ->not->toContain('mcpUrl')
        ->not->toContain('/mcp')
        ->not->toContain('teamGroups')
        ->not->toContain($user->email);
})->with([
    'an account with a password' => [fn () => accountWithSecrets()],
    'an account that only signs in through SSO' => [fn () => ssoOnlyAccount()],
    'an account while SSO is required' => [function () {
        config(['services.google.client_id' => 'google-id', 'services.google.client_secret' => 'google-secret']);
        resolve(InstanceSettings::class)->set('sso_required', true);

        return ssoOnlyAccount();
    }],
]);

it('sends what the security and API token sections protect once the password is confirmed', function (Closure $account) {
    $user = $account();

    $response = $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('settings.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('security.locked', false)
            ->where('security.protected.twoFactorEnabled', true)
            ->where('security.protected.twoFactor.recoveryCodesRemaining', 1)
            ->where('security.protected.passkeys.0.name', 'Laptop of Mona')
            ->where('security.protected.emailSecondFactor.enabled', true)
            ->where('security.protected.emailSecondFactor.address', $user->email)
            ->where('apiTokens.locked', false)
            ->where('apiTokens.protected.tokens.0.name', 'Claude of Mona')
            ->where('apiTokens.protected.tokens.0.hint', 'zq9x')
            ->where('apiTokens.protected.mcpUrl', url('/mcp'))
            ->has('apiTokens.protected.teamGroups'));

    $props = json_encode($response->viewData('page')['props']);

    expect($props)->not->toContain('recovery-code-1')
        ->not->toContain($user->tokens()->first()->token);
})->with([
    'an account with a password' => [fn () => accountWithSecrets()],
    'an account that only signs in through SSO' => [fn () => ssoOnlyAccount()],
    'an account while SSO is required' => [function () {
        config(['services.google.client_id' => 'google-id', 'services.google.client_secret' => 'google-secret']);
        resolve(InstanceSettings::class)->set('sso_required', true);

        return ssoOnlyAccount();
    }],
]);

it('keeps each protected prop back until the password is confirmed', function (string $section, string $prop) {
    $user = accountWithSecrets();

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where("{$section}.protected", null)
            ->missing("{$section}.{$prop}")
            ->missing($prop));

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->has("{$section}.protected.{$prop}"));
})->with([
    'the state of the authenticator app' => ['security', 'twoFactorEnabled'],
    'the date the app was added' => ['security', 'twoFactor.confirmedAt'],
    'the count of recovery codes left' => ['security', 'twoFactor.recoveryCodesRemaining'],
    'the count of recovery codes in all' => ['security', 'twoFactor.recoveryCodesTotal'],
    'the passkeys' => ['security', 'passkeys'],
    'the state of the e-mail code' => ['security', 'emailSecondFactor.enabled'],
    'whether the account may turn the e-mail code on' => ['security', 'emailSecondFactor.available'],
    'the address of the e-mail code' => ['security', 'emailSecondFactor.address'],
    'the wait before another e-mail code' => ['security', 'emailSecondFactor.resendIn'],
    'the tokens' => ['apiTokens', 'tokens'],
    'the teams a token may be limited to' => ['apiTokens', 'teamGroups'],
    'the address of the MCP server' => ['apiTokens', 'mcpUrl'],
]);

it('says nothing of the second factors of the account in the props every page shares', function (Closure $session) {
    $user = accountWithSecrets();

    $response = $this->actingAs($user)->withSession($session())->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.email', $user->email)
            ->missing('auth.user.two_factor_confirmed_at')
            ->missing('auth.user.two_factor_email_enabled_at')
            ->missing('auth.user.two_factor_secret')
            ->missing('auth.user.two_factor_recovery_codes')
            ->missing('auth.user.password'));

    $shared = collect($response->viewData('page')['props'])->except(['security', 'apiTokens'])->toJson();

    expect($shared)->not->toContain('two_factor')
        ->not->toContain('Laptop of Mona')
        ->not->toContain('Claude of Mona')
        ->not->toContain('zq9x');
})->with([
    'before the confirmation' => [fn () => []],
    'after the confirmation' => [fn () => ['auth.password_confirmed_at' => time()]],
]);

it('sends the protected props to the partial reload that follows a confirmation in the page', function () {
    $user = accountWithSecrets();

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('security.protected', null)->where('apiTokens.protected', null));

    $this->actingAs($user)
        ->postJson(route('password.confirm.store'), ['password' => 'password'])
        ->assertCreated();

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->reloadOnly(['security', 'apiTokens'], fn (Assert $reload) => $reload
            ->where('security.locked', false)
            ->where('security.protected.passkeys.0.name', 'Laptop of Mona')
            ->where('apiTokens.locked', false)
            ->where('apiTokens.protected.tokens.0.name', 'Claude of Mona')));
});

it('keeps the page locked after a wrong password in the dialog', function (Closure $account) {
    $user = $account();

    $this->actingAs($user)
        ->postJson(route('password.confirm.store'), ['password' => 'not-the-password'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('password');

    $this->actingAs($user)->getJson(route('password.confirmation'))->assertExactJson(['confirmed' => false]);

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->reloadOnly(['security', 'apiTokens'], fn (Assert $reload) => $reload
            ->where('security.protected', null)
            ->where('apiTokens.protected', null)));
})->with([
    'an account with a password' => [fn () => accountWithSecrets()],
    'an account that only signs in through SSO' => [fn () => ssoOnlyAccount()],
]);

it('tells the page whether the confirmation of the session is still accepted', function () {
    $user = accountWithSecrets();

    $this->actingAs($user)->getJson(route('password.confirmation'))->assertExactJson(['confirmed' => false]);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->getJson(route('password.confirmation'))
        ->assertExactJson(['confirmed' => true]);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time() - config('auth.password_timeout') - 1])
        ->getJson(route('password.confirmation'))
        ->assertExactJson(['confirmed' => false]);
});

it('locks the protected sections again once the confirmation is older than the timeout', function () {
    $user = accountWithSecrets();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time() - config('auth.password_timeout') - 1])
        ->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('security.locked', true)
            ->where('security.protected', null)
            ->where('apiTokens.locked', true)
            ->where('apiTokens.protected', null));
});

it('does not send the protected props to a partial reload that asks for them without a confirmed password', function () {
    $user = accountWithSecrets();

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->reloadOnly(['security', 'apiTokens'], fn (Assert $reload) => $reload
            ->where('security.protected', null)
            ->where('apiTokens.protected', null)));
});

it('gives an account whose address is not verified its profile only, even with a confirmed password', function () {
    $user = accountWithSecrets(['email_verified_at' => null]);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('settings.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('profile')
            ->where('security', null)
            ->where('appearance', false)
            ->where('notificationPreferences', null)
            ->where('apiTokens', null));
});

it('has no API token section when MCP is disabled', function () {
    config(['skrum.mcp.enabled' => false]);

    $this->actingAs(accountWithSecrets())
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('apiTokens', null));
});

it('says what the instance offers, and nothing of the account, before the confirmation', function (array $attributes) {
    Features::twoFactorAuthentication(['confirm' => true, 'confirmPassword' => true]);
    config(['fortify.features' => [], 'mail.default' => 'log']);

    $this->actingAs(User::factory()->create($attributes))
        ->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('security.locked', true)
            ->where('security.protected', null)
            ->where('security.canManageTwoFactor', false)
            ->where('security.canManagePasskeys', false)
            ->where('security.canManageEmailCode', false));
})->with([
    'an account with no second factor' => [[]],
    'an account that has the e-mail code on' => [['two_factor_email_enabled_at' => now()]],
]);

/**
 * An account in the middle of an authenticator setup: the secret is there,
 * the code was not typed yet, and the page was last opened a while ago.
 */
function accountSettingUpTheApp(): User
{
    session(['auth.password_confirmed_at' => time(), 'two_factor_empty_at' => time() - 60, 'two_factor_confirming_at' => time() - 30]);

    return User::factory()->create(['two_factor_secret' => encrypt('secret'), 'two_factor_confirmed_at' => null]);
}

it('keeps an authenticator setup that waits for its code when the page reloads itself', function (array $headers) {
    $user = accountSettingUpTheApp();

    $this->actingAs($user)->get(route('settings.edit'), [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => (string) resolve(HandleInertiaRequests::class)->version(request()),
        'Referer' => route('settings.edit'),
        ...$headers,
    ])->assertOk();

    expect($user->fresh()->two_factor_secret)->not->toBeNull();
})->with([
    'after another section was saved' => [[]],
    'for the protected props, after a confirmation' => [[
        'X-Inertia-Partial-Component' => 'settings/account',
        'X-Inertia-Partial-Data' => 'security,apiTokens',
    ]],
]);

it('drops an authenticator setup left without its code when the page is opened again', function (Closure $headers) {
    $user = accountSettingUpTheApp();

    $this->actingAs($user)->get(route('settings.edit'), $headers())->assertOk();

    expect($user->fresh()->two_factor_secret)->toBeNull();
})->with([
    'by the browser' => [fn () => []],
    'by the browser, from the page itself' => [fn () => ['Referer' => route('settings.edit')]],
    'from another page of the application' => [fn () => [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => (string) resolve(HandleInertiaRequests::class)->version(request()),
        'Referer' => route('dashboard'),
    ]],
    'by a request that names no page it comes from' => [fn () => [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => (string) resolve(HandleInertiaRequests::class)->version(request()),
    ]],
]);

it('leaves a pending authenticator setup alone while the password is not confirmed', function () {
    $user = accountSettingUpTheApp();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time() - config('auth.password_timeout') - 1])
        ->get(route('settings.edit'))
        ->assertOk();

    expect($user->fresh()->two_factor_secret)->not->toBeNull();
});

it('sends the old address of a section to its anchor on the page', function (string $route, string $anchor) {
    $this->actingAs(User::factory()->create())
        ->get(route($route))
        ->assertRedirect("/settings#{$anchor}");
})->with([
    'profile' => ['profile.edit', 'profile'],
    'appearance' => ['appearance.edit', 'appearance'],
    'notifications' => ['notificationPreferences.edit', 'notifications'],
]);

it('asks for the password at the old address of a protected section, then sends it to the anchor', function (string $route, string $anchor) {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route($route))->assertRedirect(route('password.confirm'));

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route($route))
        ->assertRedirect("/settings#{$anchor}");
})->with([
    'security' => ['security.edit', 'security'],
    'API tokens' => ['apiTokens.index', 'api-tokens'],
]);

it('keeps the old addresses of the sections an unverified account may not open behind the verification', function (string $route) {
    $this->actingAs(User::factory()->unverified()->create())
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route($route))
        ->assertRedirect(route('verification.notice'));
})->with(['security.edit', 'appearance.edit', 'notificationPreferences.edit', 'apiTokens.index']);
