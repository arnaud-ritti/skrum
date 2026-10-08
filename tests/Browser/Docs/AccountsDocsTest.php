<?php

use App\Actions\Admin\RecordAuditEvent;
use App\Actions\Mcp\IssueMcpToken;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Models\BrowserSession;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SocialAccount;
use App\Models\Team;
use App\Models\User;
use App\Support\Auth\PasswordRule;
use App\Support\InstanceSettings;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider as TwoFactorAuthenticationProviderContract;
use Laravel\Fortify\TwoFactorAuthenticationProvider;
use Laravel\Sanctum\NewAccessToken;
use PragmaRX\Google2FA\Google2FA;
use Tests\Browser\Support\DocsWorld;

const DocsAccountsTwoFactorSecret = 'JBSWY3DPEHPK3PXP';

const DocsAccountsRecoveryCodes = [
    'q7Kd2mXpLs-9VwTz4HbNc',
    'p9VwR3hTbA-c6NfJ8rZyU',
    'l2YeK5qAkM-w8TdS4mVsE',
    'b3GhT9xPnQ-r5JcL2wFlD',
    'h7ZqN6eUdC-n4KsM8bYtR',
    'f2MaP7cRwX-t6HvB3jQeZ',
    'x4DnS8kLmW-g5PcV9rTaY',
    'z8BtH2yJfK-m3QwN6eXuC',
];

const DocsAccountsPlainToken = '0199d0c5-0000-7000-8000-0000000000c1|skrum_7Hq2vN9xLk4mR8tW3yBc5dF1gJ6pZs0a';

function docsAccountsEnableSignInProviders(): void
{
    config([
        'oidc.connections.generic.base_url' => 'https://sso.nordlys.example',
        'oidc.connections.generic.client_id' => 'docs',
        'oidc.connections.generic.client_secret' => 'docs',
        'oidc.connections.generic.label' => 'Nordlys SSO',
        'oidc.connections.entra.client_id' => 'docs',
        'oidc.connections.entra.client_secret' => 'docs',
        'services.google.client_id' => 'docs',
        'services.google.client_secret' => 'docs',
        'services.github.client_id' => 'docs',
        'services.github.client_secret' => 'docs',
    ]);
}

function docsAccountsMailDelivers(): void
{
    config(['mail.default' => 'smtp']);

    Mail::fake();
}

function docsAccountsConfirmPassword(mixed $page): mixed
{
    return $page->assertPresent('[data-test="confirm-password-button"]')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings');
}

function docsAccountsPinTwoFactorSecret(): void
{
    app()->singleton(TwoFactorAuthenticationProviderContract::class, fn (): TwoFactorAuthenticationProvider => new class(resolve(Google2FA::class)) extends TwoFactorAuthenticationProvider
    {
        public function generateSecretKey(int $secretLength = 16): string
        {
            return DocsAccountsTwoFactorSecret;
        }
    });
}

function docsAccountsPinServerUrl(mixed $page): mixed
{
    $page->script(<<<'JS'
        () => {
            const pinned = 'https://skrum.example';
            const field = document.getElementById('mcp-url');

            if (field !== null) {
                field.value = field.value.replace(location.origin, pinned);
            }

            const walker = document.createTreeWalker(document.querySelector('[data-slot="settings-shell"]'), NodeFilter.SHOW_TEXT);

            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (node.nodeValue.includes(location.origin)) {
                    node.nodeValue = node.nodeValue.replace(location.origin, pinned);
                }
            }

            return true;
        }
        JS);

    return $page;
}

/**
 * @param  array<int, McpScope>  $scopes
 */
function docsAccountsToken(User $person, string $name, string $hint, array $scopes, string $createdAt, ?string $lastUsedAt = null, ?Team $team = null): void
{
    $token = $person->createToken($name, array_map(fn (McpScope $scope): string => $scope->value, $scopes))->accessToken;

    $token->forceFill([
        'team_id' => $team?->id,
        'token_hint' => $hint,
        'created_at' => $createdAt,
        'expires_at' => null,
        'last_used_at' => $lastUsedAt,
    ])->save();
}

function docsAccountsPinIssuedToken(): void
{
    app()->bind(IssueMcpToken::class, fn (): IssueMcpToken => new class(resolve(RecordAuditEvent::class)) extends IssueMcpToken
    {
        public function handle(User $user, string $name, array $scopes, ?Team $team, ?CarbonInterface $expiresAt): NewAccessToken
        {
            $issued = parent::handle($user, $name, $scopes, $team, $expiresAt);

            return new NewAccessToken($issued->accessToken, DocsAccountsPlainToken);
        }
    });
}

function docsAccountsOtherBrowserSessions(User $person): void
{
    $devices = [
        ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', '203.0.113.42', now()->subHours(2)],
        ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', '2001:db8:85a3::8a2e:370:7334', now()->subDays(3)],
    ];

    foreach ($devices as $index => [$userAgent, $ipAddress, $lastActivity]) {
        (new BrowserSession)->forceFill([
            'id' => "docs-other-device-{$index}-".str_repeat('x', 16),
            'user_id' => $person->id,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'payload' => base64_encode(serialize([])),
            'last_activity' => $lastActivity->getTimestamp(),
        ])->save();
    }
}

beforeEach(function () {
    config(['skrum.mcp.enabled' => true]);
});

it('shows the sign-in page with the company accounts, the passkey, the password and the magic link', function () {
    DocsWorld::create();
    docsAccountsEnableSignInProviders();
    docsAccountsMailDelivers();
    config(['skrum.signup_mode' => 'open']);

    $page = $this->docsOpen('/login')
        ->assertPresent('[data-slot="login-form"] [data-slot="sso-buttons"]')
        ->assertPresent('[data-test="magic-link-button"]')
        ->assertSee('Create an account');

    $this->docShot($page->resize(1440, 400), 'accounts/login', 'main');
});

it('shows the registration form of an instance where sign-up is open', function () {
    DocsWorld::create();
    config(['skrum.signup_mode' => 'open']);

    $page = $this->docsOpen('/register')
        ->assertPresent('[data-slot="register-form"] #team_name');

    $this->docShot($page->resize(1440, 400), 'accounts/register', 'main');
});

it('shows the confirmation that a magic link was sent, once it can be sent again', function () {
    $world = DocsWorld::create();
    docsAccountsMailDelivers();

    $page = $this->docsOpen('/login')
        ->assertPresent('[data-test="magic-link-button"]')
        ->fill('#email', $world->person('Inès')->email)
        ->click('@magic-link-button')
        ->assertPresent('[data-slot="magic-link-sent"] [data-test="magic-link-resend-button"]')
        ->assertDisabled('@magic-link-resend-button');

    /** Accelerate the cooldown in this capture's browser context, preserving its React state changes. */
    $page->script(<<<'JS'
        () => {
            const schedule = window.setTimeout.bind(window);
            window.setTimeout = (callback, milliseconds, ...args) =>
                schedule(callback, milliseconds === 1000 ? 0 : milliseconds, ...args);

            return true;
        }
        JS);

    $page->assertEnabled('@magic-link-resend-button')
        ->assertSee('Resend the link');

    $this->docShot($page, 'accounts/magic-link', '[data-slot="magic-link-sent"]');
});

it('shows the QR code and the setup key of an authenticator app', function () {
    docsAccountsPinTwoFactorSecret();
    docsAccountsMailDelivers();
    $world = DocsWorld::create();

    $page = docsAccountsConfirmPassword($this->docsVisit($world->person('Inès'), '/settings/security'))
        ->assertPresent('[data-slot="password-card"]')
        ->click('button:has-text("Enable 2FA")')
        ->assertPresent('[data-slot="two-factor-qr"] svg')
        ->assertNotPresent('[data-slot="two-factor-key"] [data-slot="skeleton"]')
        ->fill('input[name="code"]', '482913');

    $this->docShot($page, 'accounts/two-factor-setup', '[data-slot="two-factor-confirm"]');
});

it('shows the recovery codes of a new authenticator app', function () {
    docsAccountsPinTwoFactorSecret();
    docsAccountsMailDelivers();
    $world = DocsWorld::create();
    $person = $world->person('Inès');

    $page = docsAccountsConfirmPassword($this->docsVisit($person, '/settings/security'))
        ->assertPresent('[data-slot="password-card"]')
        ->click('button:has-text("Enable 2FA")')
        ->assertPresent('[data-slot="two-factor-qr"] svg');

    $person->refresh()->forceFill([
        'two_factor_recovery_codes' => encrypt(json_encode(DocsAccountsRecoveryCodes)),
    ])->save();

    $page->fill('input[name="code"]', resolve(Google2FA::class)->getCurrentOtp(DocsAccountsTwoFactorSecret))
        ->click('[data-slot="two-factor-confirm"] button[type="submit"]')
        ->assertPresent('[data-slot="recovery-codes"] li:nth-child(8)')
        ->assertNotPresent('[data-slot="recovery-codes"] .animate-pulse');

    $page->script('() => { document.querySelector(\'[data-slot="recovery-codes"]\').scrollIntoView({ block: "center" }); return true; }');

    $this->docShot($page, 'accounts/recovery-codes', '[data-slot="settings-card"]:has([data-slot="recovery-codes"])');
});

it('shows two passkeys in the security settings', function () {
    $world = DocsWorld::create();
    $person = $world->person('Inès');

    $laptop = $person->passkeys()->create([
        'name' => 'MacBook Pro',
        'credential_id' => 'docs-laptop',
        'credential' => ['aaguid' => 'adce0002-35bc-c60a-648b-0b25f1f05503'],
    ]);
    $laptop->forceFill(['created_at' => now()->subDays(3), 'last_used_at' => now()->subHours(2)])->save();

    $phone = $person->passkeys()->create([
        'name' => 'iPhone',
        'credential_id' => 'docs-phone',
        'credential' => [],
    ]);
    $phone->forceFill(['created_at' => now()->subMonths(2)])->save();

    $page = docsAccountsConfirmPassword($this->docsVisit($person, '/settings/security'))
        ->assertCount('[data-slot="passkey-row"]', 2);

    $this->docShot($page, 'accounts/passkeys', '[data-slot="settings-card"]:has([data-slot="passkey-row"])');
});

it('shows the code asked at sign-in when two-factor authentication is on', function () {
    $world = DocsWorld::create();
    docsAccountsMailDelivers();
    $person = $world->person('Inès');

    $person->forceFill([
        'two_factor_secret' => encrypt(DocsAccountsTwoFactorSecret),
        'two_factor_recovery_codes' => encrypt(json_encode(DocsAccountsRecoveryCodes)),
        'two_factor_confirmed_at' => now(),
        'two_factor_email_enabled_at' => now(),
    ])->save();

    $page = $this->docsOpen('/login')
        ->fill('#email', $person->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIs('/two-factor-challenge')
        ->assertPresent('[data-slot="two-factor-form"] input[name="code"]')
        ->assertPresent('[data-slot="second-factor-method"]')
        ->assertNotPresent('html.nprogress-busy');

    $page->script('() => { document.activeElement.blur(); return true; }');

    $this->docShot($page->resize(1440, 400), 'accounts/two-factor-challenge', 'main');
});

it('shows the profile card with the presence colours and the photo upload', function () {
    $world = DocsWorld::create();
    resolve(InstanceSettings::class)->set('profile_photos', true);

    $page = $this->docsVisit($world->person('Inès'), '/settings')
        ->assertPresent('[data-slot="profile-card"] [data-slot="profile-email-verified"]')
        ->assertPresent('[data-slot="profile-photo"]')
        ->assertNotPresent('[data-slot="profile-card"] .animate-pulse');

    $this->docShot($page, 'accounts/profile', '[data-slot="profile-card"]');
});

it('shows the password card with a new password that meets the rules of a production instance', function () {
    Password::defaults(fn (): ?Password => PasswordRule::defaults(production: true, breachCheck: true));
    Http::fake(['api.pwnedpasswords.com/*' => Http::response("0018A45C4D1DEF81644B54AB7F969B88D65:10\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:3")]);
    $world = DocsWorld::create();

    $page = docsAccountsConfirmPassword($this->docsVisit($world->person('Inès'), '/settings/security'))
        ->assertPresent('[data-slot="password-card"]')
        ->fill('#current_password', 'password')
        ->fill('#password', 'Marmot-glacier-2026')
        ->fill('#password_confirmation', 'Marmot-glacier-2026')
        ->assertPresent('[data-slot="password-breach-line"][data-state="clear"]');

    $this->docShot($page, 'accounts/password', '[data-slot="password-card"]');
});

it('shows the devices signed in to an account and its linked accounts', function () {
    config(['session.driver' => 'database', 'session.lottery' => [0, 100]]);
    docsAccountsEnableSignInProviders();
    $world = DocsWorld::create();
    $person = $world->person('Inès');
    SocialAccount::factory()->for($person)->create(['provider' => 'google', 'created_at' => '2026-03-12 09:14:00']);

    $page = $this->docsVisit($person, '/settings/security');

    docsAccountsOtherBrowserSessions($person);

    docsAccountsConfirmPassword($page)
        ->assertCount('[data-slot="active-sessions"] tbody tr', 3)
        ->assertPresent('[data-slot="linked-accounts"]');

    $this->docShot($page, 'accounts/sessions', '[data-slot="active-sessions"]');
    $this->docShot($page, 'accounts/linked-accounts', '[data-slot="linked-accounts"]');
});

it('shows the notification preferences', function () {
    $world = DocsWorld::create();
    $person = $world->person('Inès');
    $person->forceFill(['recap_emails' => false])->save();

    $page = $this->docsVisit($person, '/settings/notifications')
        ->assertPresent('[data-slot="notifications-card"] #action-item-reminders-in-app');

    $this->docShot($page, 'accounts/notifications', '[data-slot="notifications-card"]');
});

it('shows the theme, the language, the animations and the single-key shortcuts', function () {
    $world = DocsWorld::create();

    $page = $this->docsVisit($world->person('Inès'), '/settings/appearance')
        ->assertPresent('[data-slot="theme-picker"] [role="radio"][aria-checked="true"]')
        ->assertPresent('[data-slot="language-field"] [role="radio"][aria-checked="true"]');

    $this->docShot($page, 'accounts/appearance', '#appearance');
});

it('shows the list of API tokens of an account', function () {
    $world = DocsWorld::create();
    $person = $world->person('Inès');

    docsAccountsToken($person, 'Claude Code', 'Zs0a', [McpScope::Read, McpScope::Write], '2026-09-14 09:00:00', '2026-09-28 16:20:00', $world->team);
    docsAccountsToken($person, 'Cursor', 'k4mR', [McpScope::Read], '2026-06-02 09:00:00');

    $page = docsAccountsConfirmPassword($this->docsVisit($person, '/settings/api-tokens'))
        ->assertPresent('[data-slot="token-list"] [data-slot="badge"]');

    $this->docShot($page, 'accounts/tokens', '[data-slot="token-list"]');
});

it('shows a new API token, displayed once with the configuration of the client', function () {
    docsAccountsPinIssuedToken();
    $world = DocsWorld::create();

    $page = docsAccountsConfirmPassword($this->docsVisit($world->person('Inès'), '/settings/api-tokens'))
        ->assertPresent('[data-slot="token-list-empty"]')
        ->fill('#token-name', 'Claude Code')
        ->click('#scope-write')
        ->click('[data-slot="create-token-form"] button[type="submit"]')
        ->assertPresent('[data-slot="new-token-panel"] input[readonly]');

    $this->docShot(docsAccountsPinServerUrl($page), 'accounts/token-created', '[data-slot="create-token-form"]');
});

it('shows the keyboard shortcuts dialog', function () {
    $world = DocsWorld::create();

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]')
        ->resize(1440, 1200);

    $page->keys('html > body', '?');
    $page->assertPresent('[data-slot="keyboard-shortcuts"] [data-slot="keyboard-shortcuts-row"]');

    $this->docShot($page, 'accounts/shortcuts-dialog', '[data-slot="keyboard-shortcuts"]');
});

it('shows the command menu with its actions, the recent sessions and the pages', function () {
    $world = DocsWorld::create();

    Retro::factory()->for($world->team)->inPhase(RetroPhase::Completed)->create([
        'title' => 'Sprint 42 retrospective',
        'updated_at' => now()->subDays(3),
    ]);
    PokerGame::factory()->for($world->team)->ended()->create([
        'title' => 'Sprint 43 planning',
        'updated_at' => now()->subDays(2),
    ]);

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]')
        ->click('@command-menu-button')
        ->assertPresent('[data-slot="command-input"]')
        ->assertSee('Sprint 42 retrospective')
        ->assertNotPresent('[data-slot="command-loading"]');

    $this->docShot($page, 'accounts/command-menu', '[role="dialog"]');
});

it('shows the password confirmation dialog for a protected direct link', function () {
    $world = DocsWorld::create();
    $page = $this->docsVisit($world->person('Camille'), '/user/confirm-password')
        ->assertPresent('[role="dialog"] #password');

    $this->docShot($page, 'accounts/password-confirmation', '[role="dialog"]');
});
