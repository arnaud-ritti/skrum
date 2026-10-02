<?php

use App\Actions\Mcp\IssueMcpToken;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\McpScope;
use App\Enums\WorkspaceRole;
use App\Models\IntegrationDelivery;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonInterface;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider as TwoFactorAuthenticationProviderContract;
use Laravel\Fortify\TwoFactorAuthenticationProvider;
use Laravel\Sanctum\NewAccessToken;
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

const P18eSettingsPlainToken = '0199a000-0000-7000-8000-0000000000c1|skrum_7Hq2vN9xLk4mR8tW3yBc5dF1gJ6pZs0a';

/**
 * The API tokens page asks for the password again: the visit goes through it.
 *
 * @param  array<string, string>  $options
 */
function p18eTokensVisit(User $member, array $options, string $marker): mixed
{
    return p18eSettingsVisit($member, '/settings/api-tokens', $options, '[data-test="confirm-password-button"]')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings/api-tokens')
        ->assertPresent($marker);
}

/**
 * The test server listens on another port on every run: the address shown in
 * the server field and in the client configuration is replaced in the picture.
 */
function p18ePinServerUrl(mixed $page): mixed
{
    $page->script(<<<'JS'
        () => {
            const pinned = 'https://skrum.example';
            const field = document.getElementById('mcp-url');

            field.value = field.value.replace(location.origin, pinned);

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
function p18eSettingsToken(User $member, string $name, string $hint, array $scopes, string $createdAt, ?string $expiresAt = null, ?string $lastUsedAt = null, ?Team $team = null): void
{
    $token = $member->createToken($name, array_map(fn (McpScope $scope): string => $scope->value, $scopes))->accessToken;

    $token->forceFill([
        'team_id' => $team?->id,
        'token_hint' => $hint,
        'created_at' => $createdAt,
        'expires_at' => $expiresAt,
        'last_used_at' => $lastUsedAt,
    ])->save();
}

/**
 * Four tokens with the dates of the picture: all scopes on a team, two scopes
 * on every team, an expired one, and one bound to a team the member has left.
 */
function p18eSettingsTokens(User $member): void
{
    PersonalAccessToken::query()->whereMorphedTo('tokenable', $member)->delete();

    $left = Team::query()->firstWhere('name', 'Borealis')
        ?? Team::factory()->for(Workspace::factory()->create(['name' => 'Polaris']))->create(['name' => 'Borealis']);

    p18eSettingsToken($member, 'Claude Code', 'Zs0a', [McpScope::Read, McpScope::Write, McpScope::Delete], '2026-09-14 09:00:00', '2031-09-14 09:00:00', '2026-09-28 16:20:00', Team::query()->firstWhere('name', 'Atlas'));
    p18eSettingsToken($member, 'Cursor', 'k4mR', [McpScope::Read, McpScope::Write], '2026-06-02 09:00:00');
    p18eSettingsToken($member, 'Old CI script', 'x9Lq', [McpScope::Read], '2026-01-10 09:00:00', '2026-02-09 09:00:00', '2026-02-01 11:00:00');
    p18eSettingsToken($member, 'VS Code', 'tW3y', [McpScope::Read], '2025-11-20 09:00:00', null, null, $left);
}

/**
 * The token of the picture is the same on every run: its plain text, its hint
 * and its dates are pinned after the real action has created it.
 */
function p18ePinIssuedToken(): void
{
    app()->bind(IssueMcpToken::class, fn (): IssueMcpToken => new class extends IssueMcpToken
    {
        public function handle(User $user, string $name, array $scopes, ?Team $team, ?CarbonInterface $expiresAt): NewAccessToken
        {
            $issued = parent::handle($user, $name, $scopes, $team, $expiresAt);

            $issued->accessToken->forceFill([
                'token_hint' => substr(P18eSettingsPlainToken, -4),
                'created_at' => '2026-09-14 09:00:00',
                'expires_at' => '2031-09-14 09:00:00',
            ])->save();

            return new NewAccessToken($issued->accessToken, P18eSettingsPlainToken);
        }
    });
}

it('renders the API tokens settings without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-api-tokens-page',
        '/settings/api-tokens',
        function (string $path, array $options) use ($member) {
            p18eSettingsTokens($member);

            return p18ePinServerUrl(
                p18eTokensVisit($member, $options, '[data-slot="settings-shell"] [data-slot="token-list"]')
                    ->assertPresent('[data-slot="create-token-form"] #token-name')
                    ->assertPresent('#mcp-url'),
            );
        },
    );
});

it('renders the API tokens settings of a member without token without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-api-tokens-empty',
        '/settings/api-tokens',
        fn (string $path, array $options) => p18ePinServerUrl(p18eTokensVisit(
            $member,
            $options,
            '[data-slot="settings-shell"] [data-slot="token-list-empty"]',
        )),
    );
});

it('renders the token form with a refused name without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-api-tokens-error',
        '/settings/api-tokens',
        function (string $path, array $options) use ($member) {
            p18eSettingsTokens($member);

            return p18ePinServerUrl(
                p18eTokensVisit($member, $options, '[data-slot="settings-shell"] [data-slot="token-list"]')
                    ->fill('#token-name', 'Cursor')
                    ->click('#scope-write')
                    ->click('[data-slot="create-token-form"] button[type="submit"]')
                    ->assertPresent('[data-slot="create-token-form"] [data-slot="field-error"]'),
            );
        },
    );
});

it('renders a new token, shown once in the form, without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());
    p18ePinIssuedToken();

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-api-tokens-new-token',
        '/settings/api-tokens',
        function (string $path, array $options) use ($member) {
            PersonalAccessToken::query()->whereMorphedTo('tokenable', $member)->delete();

            return p18ePinServerUrl(
                p18eTokensVisit($member, $options, '[data-slot="settings-shell"] [data-slot="token-list-empty"]')
                    ->fill('#token-name', 'Claude Code')
                    ->click('#scope-write')
                    ->click('[data-slot="create-token-form"] button[type="submit"]')
                    ->assertPresent('[data-slot="new-token-panel"] input[readonly]')
                    ->assertPresent('[data-slot="token-list"] [data-slot="badge"]'),
            );
        },
    );
});

/**
 * A workspace admin of a team of eleven, with Slack connected, Microsoft Teams
 * to reconnect, and Telegram and Mattermost not connected yet.
 */
function p18eTeamSettingsAdmin(): User
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram, IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
    Http::fake([
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_bot']]),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => true]),
    ]);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);

    $admin = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000020',
        'name' => 'Ada Admin',
        'email' => 'ada.admin@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $team->members()->attach($admin);

    foreach (User::factory()->count(10)->create() as $member) {
        $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member);
    }

    TeamIntegration::factory()->slack()->create([
        'team_id' => $team->id,
        'connected_by_user_id' => $admin->id,
        'last_checked_at' => '2026-09-28 16:20:00',
    ]);
    TeamIntegration::factory()->microsoftTeams()->create([
        'team_id' => $team->id,
        'connected_by_user_id' => null,
        'status' => IntegrationStatus::ReconnectRequired,
        'last_error' => 'The workflow answered 404. Paste the URL of the workflow again.',
        'last_checked_at' => '2026-09-30 06:00:00',
    ]);

    return $admin;
}

function p18eIntegrationsPath(): string
{
    $team = Team::query()->where('name', 'Atlas')->sole();

    return route('teams.integrations.index', [$team->workspace, $team], false);
}

it('renders the team integrations without overflow', function () {
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $admin = p18eTeamSettingsAdmin();

    $this->captureVisuals(
        'team-integrations-page',
        p18eIntegrationsPath(),
        fn (string $path, array $options) => p18eSettingsVisit(
            $admin,
            $path,
            $options,
            '[data-slot="team-settings-shell"] [data-test="integration-card-msteams"] [data-slot="alert"]',
        )->assertPresent('nav[aria-label] a[aria-current="page"]')
            ->assertCount('[data-test^="integration-card-"]', 4),
    );
});

it('renders the dialog that connects a channel by its URL, with a refused URL, without overflow', function () {
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $admin = p18eTeamSettingsAdmin();

    $this->captureVisuals(
        'team-integrations-url-dialog',
        p18eIntegrationsPath(),
        fn (string $path, array $options) => p18eSettingsVisit(
            $admin,
            $path,
            $options,
            '[data-slot="team-settings-shell"] [data-test="integration-card-mattermost"]',
        )->click('[data-test="integration-card-mattermost"] button')
            ->fill('[role="dialog"] input[type="url"]', 'https://other.example.com/hooks/abcdefghijklmnopqrstuvwxyz')
            ->fill('[role="dialog"] input[maxlength="80"]', 'town-square')
            ->click('[role="dialog"] button[type="submit"]')
            ->assertPresent('[role="dialog"] [data-slot="field-error"]'),
    );
});

it('renders the Telegram command of a pending connection without overflow', function () {
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $admin = p18eTeamSettingsAdmin();

    $this->captureVisuals(
        'team-integrations-telegram-code',
        p18eIntegrationsPath(),
        function (string $path, array $options) use ($admin) {
            $page = p18eSettingsVisit(
                $admin,
                $path,
                $options,
                '[data-slot="team-settings-shell"] [data-test="integration-card-telegram"]',
            )->click('[data-test="integration-card-telegram"] button')
                ->assertPresent('[data-slot="telegram-pending-code"] code');

            $page->script(<<<'JS'
                () => {
                    document.querySelector('[data-slot="telegram-pending-code"] code').textContent = '/connect@skrum_bot K7M2QX9D';
                    document.querySelector('[data-slot="telegram-pending-state"]').textContent =
                        document.querySelector('[data-slot="telegram-pending-state"]').textContent.replace(/\d+:\d+/, '9:58');

                    return true;
                }
                JS);

            return $page;
        },
    );
});

/**
 * A workspace admin of a team of eleven whose webhook is connected, with four
 * deliveries: a redelivery still queued, a failure that can be sent again, a
 * success, and a shared link whose content is not kept.
 */
function p18eWebhookAdmin(): User
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);

    $admin = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000030',
        'name' => 'Ada Admin',
        'email' => 'ada.admin@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $team->members()->attach($admin);

    foreach (User::factory()->count(10)->create() as $member) {
        $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member);
    }

    $integration = TeamIntegration::factory()->webhook(['action_item.completed', 'retro.completed'])->create([
        'team_id' => $team->id,
        'connected_by_user_id' => $admin->id,
        'last_checked_at' => '2026-09-28 16:20:00',
        'last_delivery_succeeded_at' => '2026-09-30 09:12:04',
    ]);
    $integration->forceFill(['settings' => [...$integration->settings, 'channelLabel' => 'Ops receiver']])->save();

    $event = [
        'team_id' => $team->id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'event' => 'action_item.completed',
        'team_integration_id' => $integration->id,
        'requested_by_user_id' => null,
    ];

    $failed = IntegrationDelivery::factory()->failed('Webhook did not respond. Try again later.')->create([
        ...$event,
        'id' => '0199b000-0000-7000-8000-000000000002',
        'attempts' => 7,
        'response_status' => 503,
        'created_at' => '2026-09-30 06:00:00',
        'last_attempt_at' => '2026-09-30 09:42:30',
    ]);
    $failed->payload()->create([
        'message' => ['id' => $failed->id, 'event' => 'action_item.completed'],
        'request_headers' => [
            'Content-Type' => 'application/json',
            'User-Agent' => 'skrum-webhook/1',
            'X-Skrum-Event' => 'action_item.completed',
            'X-Skrum-Delivery' => $failed->id,
            'X-Skrum-Timestamp' => '1790761350',
            'X-Skrum-Signature' => 'sha256=3f9a…',
        ],
        'request_body' => json_encode([
            'version' => 1,
            'id' => $failed->id,
            'event' => 'action_item.completed',
            'occurredAt' => '2026-09-30T06:00:00Z',
            'team' => ['id' => $team->id, 'name' => 'Atlas'],
            'data' => ['actionItem' => ['content' => 'Fix the deploy', 'status' => 'completed', 'assignee' => ['name' => 'Ada Admin']]],
        ]),
        'response_status' => 503,
        'response_excerpt' => 'upstream down',
    ]);

    $queued = IntegrationDelivery::factory()->create([
        ...$event,
        'id' => '0199b000-0000-7000-8000-000000000001',
        'attempts' => 0,
        'redelivery_of_id' => $failed->id,
        'requested_by_user_id' => $admin->id,
        'created_at' => '2026-09-30 09:45:00',
    ]);
    $queued->payload()->create(['message' => ['id' => $failed->id, 'event' => 'action_item.completed']]);

    $sent = IntegrationDelivery::factory()->sent()->create([
        ...$event,
        'id' => '0199b000-0000-7000-8000-000000000003',
        'event' => 'retro.completed',
        'attempts' => 1,
        'response_status' => 200,
        'created_at' => '2026-09-29 15:30:00',
        'last_attempt_at' => '2026-09-29 15:30:02',
    ]);
    $sent->payload()->create(['message' => ['id' => $sent->id, 'event' => 'retro.completed']]);

    IntegrationDelivery::factory()->sent()->create([
        ...$event,
        'id' => '0199b000-0000-7000-8000-000000000004',
        'kind' => IntegrationDeliveryKind::RetroLink,
        'event' => null,
        'requested_by_user_id' => $admin->id,
        'attempts' => 1,
        'response_status' => 204,
        'created_at' => '2026-09-29 14:02:00',
        'last_attempt_at' => '2026-09-29 14:02:01',
    ]);

    return $admin;
}

/**
 * @param  array<string, string>  $options
 */
function p18eWebhookDeliveries(User $admin, string $path, array $options): mixed
{
    return p18eSettingsVisit(
        $admin,
        $path,
        $options,
        '[data-slot="team-settings-shell"] [data-test="integration-card-webhook"] [data-slot="webhook-events"]',
    )->click('[data-slot="webhook-deliveries"] button[aria-expanded="false"]')
        ->assertCount('table[aria-label] tbody tr', 4);
}

it('renders a connected webhook, its events and its deliveries, without overflow', function () {
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $admin = p18eWebhookAdmin();

    $this->captureVisuals(
        'team-integrations-webhook',
        p18eIntegrationsPath(),
        fn (string $path, array $options) => p18eWebhookDeliveries($admin, $path, $options),
    );
});

it('renders the request of a delivery without overflow', function () {
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $admin = p18eWebhookAdmin();

    $this->captureVisuals(
        'team-integrations-webhook-delivery',
        p18eIntegrationsPath(),
        fn (string $path, array $options) => p18eWebhookDeliveries($admin, $path, $options)
            ->click('table[aria-label] tbody tr:nth-child(2) button:first-child')
            ->assertPresent('#delivery-tabpanel pre'),
    );
});

it('renders the signing secret of a webhook, shown once, without overflow', function () {
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $admin = p18eWebhookAdmin();

    $this->captureVisuals(
        'team-integrations-webhook-secret',
        p18eIntegrationsPath(),
        function (string $path, array $options) use ($admin) {
            $page = p18eSettingsVisit(
                $admin,
                $path,
                $options,
                '[data-slot="team-settings-shell"] [data-test="integration-card-webhook"] [data-slot="webhook-events"]',
            )->click('@rotate-webhook-secret')
                ->click('[role="dialog"] button:last-child')
                ->assertPresent('[role="dialog"] input[readonly]');

            $page->script(<<<'JS'
                () => {
                    document.querySelector('[role="dialog"] input[readonly]').value = 'whsec_4f1c2e9a8d3b4b8e9f512a7c0d6e5b13a7c0d6e5';

                    return true;
                }
                JS);

            return $page;
        },
    );
});
