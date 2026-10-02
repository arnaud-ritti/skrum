<?php

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
    config(['skrum.mcp.enabled' => true]);
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
            ->where('appearance', true)
            ->has('notificationPreferences.preferences')
            ->where('security.locked', true)
            ->where('security.protected', null)
            ->where('security.hasProtectedSettings', true)
            ->where('security.canManageTwoFactor', true)
            ->where('security.canManagePasskeys', true)
            ->has('security.passwordRules')
            ->where('apiTokens', ['locked' => true, 'protected' => null]));

    $props = json_encode($response->viewData('page')['props']['security']).json_encode($response->viewData('page')['props']['apiTokens']);

    expect($props)->not->toContain('Laptop of Mona')
        ->not->toContain('Claude of Mona')
        ->not->toContain('zq9x')
        ->not->toContain('twoFactorEnabled')
        ->not->toContain('recoveryCodesRemaining')
        ->not->toContain('confirmedAt')
        ->not->toContain('emailSecondFactor')
        ->not->toContain('mcpUrl')
        ->not->toContain('teamGroups');
})->with([
    'an account with a password' => [fn () => accountWithSecrets()],
    'an account that only signs in through SSO' => [fn () => ssoOnlyAccount()],
    'an account while SSO is required' => [function () {
        config(['services.google.client_id' => 'google-id', 'services.google.client_secret' => 'google-secret']);
        resolve(InstanceSettings::class)->set('sso_required', true);

        return ssoOnlyAccount();
    }],
]);

it('sends what the security and API token sections protect once the password is confirmed', function () {
    $user = accountWithSecrets();

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
            ->where('apiTokens.protected.defaultExpiration', '90_days')
            ->has('apiTokens.protected.expirationOptions', 4));

    $props = json_encode($response->viewData('page')['props']);

    expect($props)->not->toContain('recovery-code-1')
        ->not->toContain($user->tokens()->first()->token);
});

it('locks the protected sections again once the confirmation is older than the timeout', function () {
    $user = accountWithSecrets();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time() - config('auth.password_timeout') - 1])
        ->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('security.locked', true)
            ->where('security.protected', null)
            ->where('apiTokens', ['locked' => true, 'protected' => null]));
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

it('says there is nothing to unlock when the instance offers no second factor and no passkey', function () {
    Features::twoFactorAuthentication(['confirm' => true, 'confirmPassword' => true]);
    config(['fortify.features' => [], 'mail.default' => 'log']);

    $this->actingAs(User::factory()->create())
        ->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('security.canManageTwoFactor', false)
            ->where('security.canManagePasskeys', false)
            ->where('security.hasProtectedSettings', false));
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
