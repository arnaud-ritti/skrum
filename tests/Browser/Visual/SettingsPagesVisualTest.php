<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider as TwoFactorAuthenticationProviderContract;
use Laravel\Fortify\TwoFactorAuthenticationProvider;
use PragmaRX\Google2FA\Google2FA;

function p18eSettingsMember(bool $verified = true): User
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);

    $member = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000010',
        'name' => 'Mona Member',
        'email' => 'mona.member@example.com',
        'email_verified_at' => $verified ? now() : null,
    ]);
    $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($member);

    return $member;
}

/**
 * @param  array<string, string>  $options
 */
function p18eSettingsVisit(User $member, string $path, array $options, string $marker): mixed
{
    User::query()->whereKey($member->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

    $page = visit('/login', $options);

    $page->fill('#email', $member->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    $page->navigate($path);

    return $page->assertPresent($marker)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

it('renders the profile settings without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-profile-page',
        '/settings/profile',
        fn (string $path, array $options) => p18eSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="profile-email-verified"]',
        ),
    );
});

it('renders the account deletion dialog without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-profile-delete-dialog',
        '/settings/profile',
        fn (string $path, array $options) => p18eSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-test="delete-user-button"]',
        )->click('@delete-user-button')
            ->assertPresent('[role="dialog"] #password'),
    );
});

it('renders the profile of an unverified member without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember(verified: false);

    $this->captureVisuals(
        'settings-profile-unverified',
        '/settings/profile',
        fn (string $path, array $options) => p18eSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="alert"]',
        ),
    );
});

const P18eSettingsTwoFactorSecret = 'JBSWY3DPEHPK3PXP';

const P18eSettingsRecoveryCodes = [
    'q7Kd2mXpLs-9VwTz4HbNc',
    'p9VwR3hTbA-c6NfJ8rZyU',
    'l2YeK5qAkM-w8TdS4mVsE',
    'b3GhT9xPnQ-r5JcL2wFlD',
    'h7ZqN6eUdC-n4KsM8bYtR',
    'f2MaP7cRwX-t6HvB3jQeZ',
    'x4DnS8kLmW-g5PcV9rTaY',
    'z8BtH2yJfK-m3QwN6eXuC',
];

/**
 * The security page asks for the password again: the visit goes through it.
 *
 * @param  array<string, string>  $options
 */
function p18eSecurityVisit(User $member, array $options, string $marker): mixed
{
    return p18eSettingsVisit($member, '/settings/security', $options, '[data-test="confirm-password-button"]')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings/security')
        ->assertPresent($marker);
}

/**
 * Every member of these captures gets the same secret, so the QR code and
 * the setup key are the same picture on every run. The provider has no cache:
 * the captures of one run type the same code again within its 30 seconds.
 */
function p18ePinTwoFactorSecret(): void
{
    app()->singleton(TwoFactorAuthenticationProviderContract::class, fn (): TwoFactorAuthenticationProvider => new class(resolve(Google2FA::class)) extends TwoFactorAuthenticationProvider
    {
        public function generateSecretKey(int $secretLength = 16): string
        {
            return P18eSettingsTwoFactorSecret;
        }
    });
}

function p18eWithoutTwoFactor(User $member): void
{
    $member->forceFill([
        'two_factor_secret' => null,
        'two_factor_recovery_codes' => null,
        'two_factor_confirmed_at' => null,
    ])->save();
}

it('renders the security settings without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-security-page',
        '/settings/security',
        fn (string $path, array $options) => p18eSecurityVisit(
            $member,
            $options,
            '[data-slot="settings-shell"] [data-slot="password-card"]',
        )->fill('#password', 'abcdefghijklmn')
            ->fill('#password_confirmation', 'abcdefghijklmn')
            ->assertPresent('[data-slot="password-strength"][data-level="good"]')
            ->assertPresent('[data-slot="password-mark"]'),
    );
});

it('renders the two-factor setup inside its card without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());
    p18ePinTwoFactorSecret();

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-security-two-factor-setup',
        '/settings/security',
        function (string $path, array $options) use ($member) {
            p18eWithoutTwoFactor($member);

            return p18eSecurityVisit($member, $options, '[data-slot="settings-shell"] [data-slot="password-card"]')
                ->click('button:has-text("2FA")')
                ->assertPresent('[data-slot="two-factor-qr"] svg')
                ->assertNotPresent('[data-slot="two-factor-key"] [data-slot="skeleton"]')
                ->assertNotPresent('[role="dialog"]')
                ->fill('input[name="code"]', '482');
        },
    );
});

it('renders the recovery codes of a new second factor without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());
    p18ePinTwoFactorSecret();

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-security-recovery-codes',
        '/settings/security',
        function (string $path, array $options) use ($member) {
            p18eWithoutTwoFactor($member);

            $page = p18eSecurityVisit($member, $options, '[data-slot="settings-shell"] [data-slot="password-card"]')
                ->click('button:has-text("2FA")')
                ->assertPresent('[data-slot="two-factor-qr"] svg');

            $member->refresh()->forceFill([
                'two_factor_recovery_codes' => encrypt(json_encode(P18eSettingsRecoveryCodes)),
            ])->save();

            return $page
                ->fill('input[name="code"]', resolve(Google2FA::class)->getCurrentOtp(P18eSettingsTwoFactorSecret))
                ->click('[data-slot="two-factor-confirm"] button[type="submit"]')
                ->assertPresent('ol[aria-label] li:nth-child(8)')
                ->click('#recovery-codes-saved');
        },
    );
});

it('renders an enabled second factor with its recovery codes without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-security-two-factor-on',
        '/settings/security',
        function (string $path, array $options) use ($member) {
            p18eWithoutTwoFactor($member);

            $page = p18eSettingsVisit($member, '/settings/security', $options, '[data-test="confirm-password-button"]')
                ->fill('#password', 'password')
                ->click('@confirm-password-button')
                ->assertPathIs('/settings/security');

            $member->forceFill([
                'two_factor_secret' => encrypt(P18eSettingsTwoFactorSecret),
                'two_factor_recovery_codes' => encrypt(json_encode(array_slice(P18eSettingsRecoveryCodes, 0, 7))),
                'two_factor_confirmed_at' => '2026-03-12 09:14:00',
            ])->save();

            return $page->navigate('/settings/security')
                ->assertPresent('[data-slot="two-factor-row"]')
                ->click('[data-slot="two-factor-row"] button[aria-expanded="false"]')
                ->assertPresent('ol[aria-label] li:nth-child(7)');
        },
    );
});

it('renders the appearance settings without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-appearance-page',
        '/settings/appearance',
        fn (string $path, array $options) => p18eSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="theme-picker"] [role="radio"][aria-checked="true"]',
        )->assertPresent('[data-slot="language-field"] [role="radio"][aria-checked="true"]'),
    );
});

it('renders the notification settings without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();
    $member->forceFill(['action_item_reminders_by_email' => false])->save();

    $this->captureVisuals(
        'settings-notifications-page',
        '/settings/notifications',
        fn (string $path, array $options) => p18eSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="notifications-card"] #action-item-reminders-in-app',
        ),
    );
});

it('renders the notification settings of an instance without reminders without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true, 'skrum.action_item_reminders.enabled' => false]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-notifications-reminders-off',
        '/settings/notifications',
        fn (string $path, array $options) => p18eSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="notifications-card"] [data-slot="alert"]',
        ),
    );
});
