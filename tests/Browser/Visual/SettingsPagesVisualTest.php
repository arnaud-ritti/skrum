<?php

use App\Actions\Admin\RecordAuditEvent;
use App\Actions\Mcp\IssueMcpToken;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationWebhookStatus;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\BrowserSession;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationUserMapping;
use App\Models\Participant;
use App\Models\PersonalAccessToken;
use App\Models\Retro;
use App\Models\SocialAccount;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Workspace;
use App\Support\InstanceSettings;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use Carbon\CarbonInterface;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider as TwoFactorAuthenticationProviderContract;
use Laravel\Fortify\TwoFactorAuthenticationProvider;
use Laravel\Sanctum\NewAccessToken;
use PragmaRX\Google2FA\Google2FA;

function settingsVisualSettingsMember(bool $verified = true): User
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
function settingsVisualSettingsVisit(User $member, string $path, array $options, string $marker): mixed
{
    $page = visualSignIn($member, $path, $options);

    return $page->assertPresent($marker)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

beforeEach(function () {
    config(['app.name' => 'Skrum']);

    RateLimiter::for('login', fn (): Limit => Limit::none());
    RateLimiter::for('passwordConfirmations', fn (): Limit => Limit::none());
});

it('renders the profile settings without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-profile-page',
        '/settings/profile',
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="profile-email-verified"]',
        ),
    );
});

it('renders the account deletion dialog without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-profile-delete-dialog',
        '/settings/profile',
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-test="delete-user-button"]',
        )->click('@delete-user-button')
            ->assertPresent('[role="dialog"] #delete-account-password'),
    );
});

it('renders the profile of an unverified member without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember(verified: false);

    $this->captureVisuals(
        'settings-profile-unverified',
        '/settings/profile',
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="alert"]',
        ),
    );
});

const SettingsVisualTwoFactorSecret = 'JBSWY3DPEHPK3PXP';

const SettingsVisualRecoveryCodes = [
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
function settingsVisualSecurityVisit(User $member, array $options, string $marker): mixed
{
    return settingsVisualSettingsVisit($member, '/settings/security', $options, '[data-test="confirm-password-button"]')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings')
        ->assertPresent($marker);
}

/**
 * Every member of these captures gets the same secret, so the QR code and
 * the setup key are the same picture on every run. The provider has no cache:
 * the captures of one run type the same code again within its 30 seconds.
 */
function settingsVisualPinTwoFactorSecret(): void
{
    app()->singleton(TwoFactorAuthenticationProviderContract::class, fn (): TwoFactorAuthenticationProvider => new class(resolve(Google2FA::class)) extends TwoFactorAuthenticationProvider
    {
        public function generateSecretKey(int $secretLength = 16): string
        {
            return SettingsVisualTwoFactorSecret;
        }
    });
}

function settingsVisualWithoutTwoFactor(User $member): void
{
    $member->forceFill([
        'two_factor_secret' => null,
        'two_factor_recovery_codes' => null,
        'two_factor_confirmed_at' => null,
    ])->save();
}

it('renders the security settings without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-security-page',
        '/settings/security',
        fn (string $path, array $options) => settingsVisualSecurityVisit(
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
    config(['skrum.mcp.enabled' => true]);
    settingsVisualPinTwoFactorSecret();

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-security-two-factor-setup',
        '/settings/security',
        function (string $path, array $options) use ($member) {
            settingsVisualWithoutTwoFactor($member);

            return settingsVisualSecurityVisit($member, $options, '[data-slot="settings-shell"] [data-slot="password-card"]')
                ->click('button:has-text("2FA")')
                ->assertPresent('[data-slot="two-factor-qr"] svg')
                ->assertNotPresent('[data-slot="two-factor-key"] [data-slot="skeleton"]')
                ->assertNotPresent('[role="dialog"]')
                ->fill('input[name="code"]', '482');
        },
    );
});

it('renders the recovery codes of a new second factor without overflow', function () {
    config(['skrum.mcp.enabled' => true]);
    settingsVisualPinTwoFactorSecret();

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-security-recovery-codes',
        '/settings/security',
        function (string $path, array $options) use ($member) {
            settingsVisualWithoutTwoFactor($member);

            $page = settingsVisualSecurityVisit($member, $options, '[data-slot="settings-shell"] [data-slot="password-card"]')
                ->click('button:has-text("2FA")')
                ->assertPresent('[data-slot="two-factor-qr"] svg');

            $member->refresh()->forceFill([
                'two_factor_recovery_codes' => encrypt(json_encode(SettingsVisualRecoveryCodes)),
            ])->save();

            return $page
                ->fill('input[name="code"]', resolve(Google2FA::class)->getCurrentOtp(SettingsVisualTwoFactorSecret))
                ->click('[data-slot="two-factor-confirm"] button[type="submit"]')
                ->assertPresent('ol[aria-label] li:nth-child(8)')
                ->click('#recovery-codes-saved');
        },
    );
});

it('renders an enabled second factor with its recovery codes without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-security-two-factor-on',
        '/settings/security',
        function (string $path, array $options) use ($member) {
            settingsVisualWithoutTwoFactor($member);

            $page = settingsVisualSettingsVisit($member, '/settings/security', $options, '[data-test="confirm-password-button"]')
                ->fill('#password', 'password')
                ->click('@confirm-password-button')
                ->assertPathIs('/settings');

            $member->forceFill([
                'two_factor_secret' => encrypt(SettingsVisualTwoFactorSecret),
                'two_factor_recovery_codes' => encrypt(json_encode(array_slice(SettingsVisualRecoveryCodes, 0, 7))),
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
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-appearance-page',
        '/settings/appearance',
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="theme-picker"] [role="radio"][aria-checked="true"]',
        )->assertPresent('[data-slot="language-field"] [role="radio"][aria-checked="true"]'),
    );
});

it('renders the notification settings without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();
    $member->forceFill(['action_item_reminders_by_email' => false])->save();

    $this->captureVisuals(
        'settings-notifications-page',
        '/settings/notifications',
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="notifications-card"] #action-item-reminders-in-app',
        ),
    );
});

it('renders the notification settings of an instance without reminders without overflow', function () {
    config(['skrum.mcp.enabled' => true, 'skrum.action_item_reminders.enabled' => false]);

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-notifications-reminders-off',
        '/settings/notifications',
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="notifications-card"] [data-slot="alert"]',
        ),
    );
});

const SettingsVisualPlainToken = '0199a000-0000-7000-8000-0000000000c1|skrum_7Hq2vN9xLk4mR8tW3yBc5dF1gJ6pZs0a';

/**
 * The API tokens page asks for the password again: the visit goes through it.
 *
 * @param  array<string, string>  $options
 */
function settingsVisualTokensVisit(User $member, array $options, string $marker): mixed
{
    return settingsVisualSettingsVisit($member, '/settings/api-tokens', $options, '[data-test="confirm-password-button"]')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings')
        ->assertPresent($marker);
}

/**
 * The test server listens on another port on every run: the address shown in
 * the server field and in the client configuration is replaced in the picture.
 */
function settingsVisualPinServerUrl(mixed $page): mixed
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
function settingsVisualSettingsToken(User $member, string $name, string $hint, array $scopes, string $createdAt, ?string $expiresAt = null, ?string $lastUsedAt = null, ?Team $team = null): void
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
function settingsVisualSettingsTokens(User $member): void
{
    PersonalAccessToken::query()->whereMorphedTo('tokenable', $member)->delete();

    $left = Team::query()->firstWhere('name', 'Borealis')
        ?? Team::factory()->for(Workspace::factory()->create(['name' => 'Polaris']))->create(['name' => 'Borealis']);

    settingsVisualSettingsToken($member, 'Claude Code', 'Zs0a', [McpScope::Read, McpScope::Write, McpScope::Delete], '2026-09-14 09:00:00', '2031-09-14 09:00:00', '2026-09-28 16:20:00', Team::query()->firstWhere('name', 'Atlas'));
    settingsVisualSettingsToken($member, 'Cursor', 'k4mR', [McpScope::Read, McpScope::Write], '2026-06-02 09:00:00');
    settingsVisualSettingsToken($member, 'Old CI script', 'x9Lq', [McpScope::Read], '2026-01-10 09:00:00', '2026-02-09 09:00:00', '2026-02-01 11:00:00');
    settingsVisualSettingsToken($member, 'VS Code', 'tW3y', [McpScope::Read], '2025-11-20 09:00:00', null, null, $left);
}

/**
 * The token of the picture is the same on every run: its plain text, its hint
 * and its dates are pinned after the real action has created it.
 */
function settingsVisualPinIssuedToken(): void
{
    app()->bind(IssueMcpToken::class, fn (): IssueMcpToken => new class(resolve(RecordAuditEvent::class)) extends IssueMcpToken
    {
        public function handle(User $user, string $name, array $scopes, ?Team $team, ?CarbonInterface $expiresAt): NewAccessToken
        {
            $issued = parent::handle($user, $name, $scopes, $team, $expiresAt);

            $issued->accessToken->forceFill([
                'token_hint' => substr(SettingsVisualPlainToken, -4),
                'created_at' => '2026-09-14 09:00:00',
                'expires_at' => '2031-09-14 09:00:00',
            ])->save();

            return new NewAccessToken($issued->accessToken, SettingsVisualPlainToken);
        }
    });
}

it('renders the API tokens settings without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-api-tokens-page',
        '/settings/api-tokens',
        function (string $path, array $options) use ($member) {
            settingsVisualSettingsTokens($member);

            return settingsVisualPinServerUrl(
                settingsVisualTokensVisit($member, $options, '[data-slot="settings-shell"] [data-slot="token-list"]')
                    ->assertPresent('[data-slot="create-token-form"] #token-name')
                    ->assertPresent('#mcp-url'),
            );
        },
    );
});

it('renders the API tokens settings of a member without token without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-api-tokens-empty',
        '/settings/api-tokens',
        fn (string $path, array $options) => settingsVisualPinServerUrl(settingsVisualTokensVisit(
            $member,
            $options,
            '[data-slot="settings-shell"] [data-slot="token-list-empty"]',
        )),
    );
});

it('renders the token form with a refused name without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-api-tokens-error',
        '/settings/api-tokens',
        function (string $path, array $options) use ($member) {
            settingsVisualSettingsTokens($member);

            return settingsVisualPinServerUrl(
                settingsVisualTokensVisit($member, $options, '[data-slot="settings-shell"] [data-slot="token-list"]')
                    ->fill('#token-name', 'Cursor')
                    ->click('#scope-write')
                    ->click('[data-slot="create-token-form"] button[type="submit"]')
                    ->assertPresent('[data-slot="create-token-form"] [data-slot="field-error"]'),
            );
        },
    );
});

it('renders a new token, shown once in the form, without overflow', function () {
    config(['skrum.mcp.enabled' => true]);
    settingsVisualPinIssuedToken();

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-api-tokens-new-token',
        '/settings/api-tokens',
        function (string $path, array $options) use ($member) {
            PersonalAccessToken::query()->whereMorphedTo('tokenable', $member)->delete();

            return settingsVisualPinServerUrl(
                settingsVisualTokensVisit($member, $options, '[data-slot="settings-shell"] [data-slot="token-list-empty"]')
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
function settingsVisualTeamSettingsAdmin(): User
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

function settingsVisualIntegrationsPath(): string
{
    $team = Team::query()->where('name', 'Atlas')->sole();

    return route('teams.integrations.index', [$team->workspace, $team], false);
}

it('renders the team integrations without overflow', function () {
    $admin = settingsVisualTeamSettingsAdmin();

    $this->captureVisuals(
        'team-integrations-page',
        settingsVisualIntegrationsPath(),
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $admin,
            $path,
            $options,
            '[data-slot="team-settings-shell"] [data-test="integration-card-msteams"][data-status="reconnect"]',
        )->assertPresent('nav[aria-label] a[aria-current="page"]')
            ->assertCount('[data-test^="integration-card-"]', 4),
    );
});

it('renders the dialog that connects a channel by its URL, with a refused URL, without overflow', function () {
    $admin = settingsVisualTeamSettingsAdmin();

    $this->captureVisuals(
        'team-integrations-url-dialog',
        settingsVisualIntegrationsPath(),
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $admin,
            $path,
            $options,
            '[data-slot="team-settings-shell"] [data-test="integration-card-mattermost"]',
        )->click('[data-test="integration-card-mattermost"] [data-slot="provider-row-configure"]')
            ->click('[data-test="integration-panel-mattermost"] [data-test="integration-connect"]')
            ->fill('[role="dialog"]:not([data-slot="sheet-content"]) input[type="url"]', 'https://other.example.com/hooks/abcdefghijklmnopqrstuvwxyz')
            ->fill('[role="dialog"]:not([data-slot="sheet-content"]) input[maxlength="80"]', 'town-square')
            ->click('[role="dialog"]:not([data-slot="sheet-content"]) button[type="submit"]')
            ->assertPresent('[role="dialog"]:not([data-slot="sheet-content"]) [data-slot="field-error"]'),
    );
});

it('renders the Telegram command of a pending connection without overflow', function () {
    $admin = settingsVisualTeamSettingsAdmin();

    $this->captureVisuals(
        'team-integrations-telegram-code',
        settingsVisualIntegrationsPath(),
        function (string $path, array $options) use ($admin) {
            $page = settingsVisualSettingsVisit(
                $admin,
                $path,
                $options,
                '[data-slot="team-settings-shell"] [data-test="integration-card-telegram"]',
            )->click('[data-test="integration-card-telegram"] [data-slot="provider-row-configure"]')
                ->click('[data-test="integration-panel-telegram"] [data-test="integration-connect"]')
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
function settingsVisualWebhookAdmin(): User
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
function settingsVisualWebhookDeliveries(User $admin, string $path, array $options): mixed
{
    return settingsVisualSettingsVisit(
        $admin,
        $path,
        $options,
        '[data-slot="team-settings-shell"] [data-test="integration-card-webhook"]',
    )->click('[data-test="integration-card-webhook"] [data-slot="provider-row-configure"]')
        ->assertPresent('[data-test="integration-panel-webhook"] [data-slot="webhook-events"]')
        ->click('[data-slot="webhook-deliveries"] button[aria-expanded="false"]')
        ->assertCount('table[aria-label] tbody tr', 4);
}

it('renders a connected webhook, its events and its deliveries, without overflow', function () {
    $admin = settingsVisualWebhookAdmin();

    $this->captureVisuals(
        'team-integrations-webhook',
        settingsVisualIntegrationsPath(),
        fn (string $path, array $options) => settingsVisualWebhookDeliveries($admin, $path, $options),
    );
});

it('renders the request of a delivery without overflow', function () {
    $admin = settingsVisualWebhookAdmin();

    $this->captureVisuals(
        'team-integrations-webhook-delivery',
        settingsVisualIntegrationsPath(),
        fn (string $path, array $options) => settingsVisualWebhookDeliveries($admin, $path, $options)
            ->click('table[aria-label] tbody tr:nth-child(2) button:first-child')
            ->assertPresent('#delivery-tabpanel pre'),
    );
});

it('renders the signing secret of a webhook, shown once, without overflow', function () {
    $admin = settingsVisualWebhookAdmin();

    $this->captureVisuals(
        'team-integrations-webhook-secret',
        settingsVisualIntegrationsPath(),
        function (string $path, array $options) use ($admin) {
            $page = settingsVisualSettingsVisit(
                $admin,
                $path,
                $options,
                '[data-slot="team-settings-shell"] [data-test="integration-card-webhook"]',
            )->click('[data-test="integration-card-webhook"] [data-slot="provider-row-configure"]')
                ->click('@rotate-webhook-secret')
                ->click('[role="dialog"]:not([data-slot="sheet-content"]) button:last-child')
                ->assertPresent('[role="dialog"]:not([data-slot="sheet-content"]) input[readonly]');

            $page->script(<<<'JS'
                () => {
                    document.querySelector('[role="dialog"]:not([data-slot="sheet-content"]) input[readonly]').value = 'Qm7vZ2kL9pR4sT8wX1yB3nC6dF0gH5jK2mN8pQ4r';

                    return true;
                }
                JS);

            return $page;
        },
    );
});

/**
 * A workspace admin of a team of four, with fixed ids so that the avatars of
 * the people panel are the same picture on every run.
 *
 * @return array{0: User, 1: Team}
 */
function settingsVisualTrackerTeam(string $adminId): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);

    $admin = User::factory()->create([
        'id' => $adminId,
        'name' => 'Ada Admin',
        'email' => 'ada.admin@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $team->members()->attach($admin);

    $members = [
        ['0199a000-0000-7000-8000-000000000051', 'Bob Member', 'bob.member@example.com'],
        ['0199a000-0000-7000-8000-000000000052', 'Cleo Maximiliane von Hohenberg-Lindqvist', 'cleo.maximiliane.von.hohenberg@example.com'],
        ['0199a000-0000-7000-8000-000000000053', 'Dan Member', 'dan.member@example.com'],
    ];

    foreach ($members as [$id, $name, $email]) {
        $member = User::factory()->create(['id' => $id, 'name' => $name, 'email' => $email]);
        $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member);
    }

    return [$admin, $team];
}

/**
 * An action item of the team exported to the tracker: its project is what the
 * status mapping lists.
 *
 * @param  array<string, mixed>  $link
 */
function settingsVisualTrackedItem(Team $team, User $admin, array $link): void
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id, 'title' => 'Sprint 12']);
    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $admin->id]);
    $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $participant->id,
        'content' => 'Speed up CI',
    ]);

    ActionItemExternalLink::factory()->create(['action_item_id' => $item->id, ...$link]);
}

/**
 * Jira connected with write access and the status sync on (live updates), a
 * member matched by email and one never assigned; GitHub connected read only;
 * Linear not connected.
 */
function settingsVisualTrackersAdmin(): User
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::GitHub);
    config([
        'services.integrations.inbound_webhooks' => 'on',
        'services.integrations.poll_minutes' => 5,
    ]);
    Http::fake([
        jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => [
            ['id' => '1', 'name' => 'Highest'],
            ['id' => '2', 'name' => 'High'],
            ['id' => '3', 'name' => 'Medium'],
            ['id' => '4', 'name' => 'Low'],
        ]]),
        jiraApiUrl('rest/api/3/project/PROJ/statuses') => Http::response([
            ['id' => '1', 'name' => 'Task', 'statuses' => [
                ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
                ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']],
                ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
                ['id' => '10005', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']],
            ]],
        ]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a visual test.'], 404),
    ]);

    [$admin, $team] = settingsVisualTrackerTeam('0199a000-0000-7000-8000-000000000040');

    $jira = TeamIntegration::factory()->jira()->create([
        'team_id' => $team->id,
        'connected_by_user_id' => $admin->id,
        'last_checked_at' => '2026-09-28 16:20:00',
    ]);
    $jira->forceFill([
        'settings' => [
            ...$jira->settings,
            'statusSync' => true,
            'statusSyncSince' => '2026-09-20T08:00:00+00:00',
            'webhookIds' => ['7001'],
            'webhookProjects' => ['PROJ'],
            'numberFields' => [
                ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
                ['id' => 'customfield_10050', 'name' => 'Business value'],
            ],
        ],
        'inbound_mode' => IntegrationInboundMode::Webhook,
        'webhook_status' => IntegrationWebhookStatus::Active,
        'webhook_expires_at' => now()->addDays(20),
        'last_polled_at' => '2026-09-30 09:00:00',
        'last_inbound_at' => '2026-09-30 09:12:04',
        'poll_cursor' => now(),
    ])->save();

    IntegrationUserMapping::factory()->create([
        'team_integration_id' => $jira->id,
        'user_id' => '0199a000-0000-7000-8000-000000000051',
        'external_account_id' => 'acc-bob',
        'external_display_name' => 'Bob (Jira)',
    ]);
    IntegrationUserMapping::factory()->manual()->create([
        'team_integration_id' => $jira->id,
        'user_id' => '0199a000-0000-7000-8000-000000000052',
        'external_account_id' => 'acc-cleo',
        'external_display_name' => 'Cleo Maximiliane von Hohenberg',
    ]);
    IntegrationUserMapping::factory()->neverAssign()->create([
        'team_integration_id' => $jira->id,
        'user_id' => '0199a000-0000-7000-8000-000000000053',
    ]);

    settingsVisualTrackedItem($team, $admin, [
        'source' => IntegrationProvider::Jira,
        'external_site' => 'cloud-1',
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
    ]);

    TeamIntegration::factory()->gitHub(IntegrationAccess::Read)->create([
        'team_id' => $team->id,
        'connected_by_user_id' => $admin->id,
        'last_checked_at' => '2026-09-29 11:05:00',
    ]);

    return $admin;
}

/**
 * Jira Data Center connected with a personal access token, the status sync on
 * and the webhook left to a Jira administrator.
 */
function settingsVisualJiraDataCenterAdmin(bool $connected): User
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    config([
        'services.integrations.inbound_webhooks' => 'on',
        'services.integrations.poll_minutes' => 5,
    ]);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/priority') => Http::response([['id' => '2', 'name' => 'High'], ['id' => '3', 'name' => 'Medium']]),
        'jira.example.com/*' => Http::response(['message' => 'Unexpected request in a visual test.'], 404),
    ]);

    [$admin, $team] = settingsVisualTrackerTeam('0199a000-0000-7000-8000-000000000060');

    if (! $connected) {
        return $admin;
    }

    $integration = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create([
        'id' => '0199c000-0000-7000-8000-000000000001',
        'team_id' => $team->id,
        'connected_by_user_id' => $admin->id,
        'last_checked_at' => '2026-09-28 16:20:00',
    ]);
    $integration->forceFill([
        'settings' => [
            ...$integration->settings,
            'statusSync' => true,
            'statusSyncSince' => '2026-09-20T08:00:00+00:00',
            'webhookManual' => true,
        ],
        'credentials' => [
            ...(array) $integration->readableCredentials(),
            'webhookToken' => 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd',
            'webhookSecret' => 'dc-webhook-secret',
        ],
        'inbound_mode' => IntegrationInboundMode::Polling,
        'webhook_status' => null,
        'last_polled_at' => '2026-09-30 09:00:00',
        'poll_cursor' => now(),
    ])->save();

    settingsVisualTrackedItem($team, $admin, [
        'source' => IntegrationProvider::JiraDataCenter,
        'external_site' => JiraDataCenterServer::key(TeamIntegrationFactory::JiraDataCenterUrl),
        'external_id' => '10001',
        'external_key' => 'OPS-1',
        'external_url' => 'https://jira.example.com/browse/OPS-1',
    ]);

    return $admin;
}

it('renders the connected trackers, their people, priorities and status sync, without overflow', function () {
    $admin = settingsVisualTrackersAdmin();

    $this->captureVisuals(
        'team-integrations-trackers',
        settingsVisualIntegrationsPath(),
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $admin,
            $path,
            $options,
            '[data-slot="team-settings-shell"] [data-test="integration-card-jira"]',
        )->assertPresent('[data-test="integration-card-github"]')
            ->click('[data-test="integration-card-jira"] [data-slot="provider-row-configure"]')
            ->assertPresent('[data-test="integration-panel-jira"] [data-slot="status-sync"]')
            ->assertCount('[data-test="integration-panel-jira"] [data-slot="tracker-people"] li', 4)
            ->assertPresent('[data-test="integration-panel-jira"] [data-slot="tracker-priorities"] button[role="combobox"]')
            ->click('[data-test="integration-panel-jira"] [data-slot="status-mapping-container"] button')
            ->assertPresent('[data-test="integration-panel-jira"] [data-slot="status-mapping-container"] button[role="checkbox"]')
            ->assertCount('[data-test="integration-panel-jira"] [data-slot="status-mapping-container"] button[role="combobox"]', 3)
            ->assertAttribute('[data-test="integration-panel-jira"] label button[role="switch"]', 'aria-checked', 'true')
            ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0),
    );
});

it('renders the dialog that turns the status sync on without overflow', function () {
    $admin = settingsVisualTrackersAdmin();

    $this->captureVisuals(
        'team-integrations-status-sync-dialog',
        settingsVisualIntegrationsPath(),
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $admin,
            $path,
            $options,
            '[data-slot="team-settings-shell"] [data-test="integration-card-github"]',
        )->click('[data-test="integration-card-github"] [data-slot="provider-row-configure"]')
            ->click('[data-test="integration-panel-github"] label button[role="switch"]')
            ->assertPresent('[role="dialog"]:not([data-slot="sheet-content"]) button:last-child'),
    );
});

it('renders the personal access token dialog of Jira Data Center without overflow', function () {
    $admin = settingsVisualJiraDataCenterAdmin(connected: false);

    $this->captureVisuals(
        'team-integrations-jira-token-dialog',
        settingsVisualIntegrationsPath(),
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $admin,
            $path,
            $options,
            '[data-slot="team-settings-shell"] [data-test="integration-card-jira_dc"]',
        )->click('[data-test="integration-card-jira_dc"] [data-slot="provider-row-configure"]')
            ->click('[data-test="integration-panel-jira_dc"] [data-test="integration-connect"]')
            ->fill('[role="dialog"]:not([data-slot="sheet-content"]) input[type="password"]', 'pasted-jira-token-abcdefghijklmnop')
            ->click('[role="dialog"]:not([data-slot="sheet-content"]) label button[role="checkbox"]')
            ->assertPresent('[role="dialog"]:not([data-slot="sheet-content"]) button[type="submit"]:not([disabled])'),
    );
});

it('renders Jira Data Center connected with a token and its manual webhook without overflow', function () {
    $admin = settingsVisualJiraDataCenterAdmin(connected: true);

    $this->captureVisuals(
        'team-integrations-jira-data-center',
        settingsVisualIntegrationsPath(),
        function (string $path, array $options) use ($admin) {
            $page = settingsVisualSettingsVisit(
                $admin,
                $path,
                $options,
                '[data-slot="team-settings-shell"] [data-test="integration-card-jira_dc"]',
            )->click('[data-test="integration-card-jira_dc"] [data-slot="provider-row-configure"]')
                ->assertPresent('[data-test="integration-panel-jira_dc"] [data-slot="jira-token-owner"]')
                ->assertCount('[data-test="integration-panel-jira_dc"] [data-slot="tracker-people"] li', 4)
                ->click('[data-slot="tracker-webhook"] button:first-child')
                ->assertCount('[data-slot="tracker-webhook"] dd code', 4)
                ->assertPresent('[data-slot="status-mapping-container"]')
                ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

            $page->script(<<<'JS'
                () => {
                    const url = document.querySelector('[data-slot="tracker-webhook"] dd code');

                    url.textContent = url.textContent.replace(/^https?:\/\/[^/]+/, 'https://skrum.example.com');

                    return true;
                }
                JS);

            return $page;
        },
    );
});

it('renders the passkeys of a member, one named by its authenticator, without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();

    $this->captureVisuals(
        'settings-security-passkeys',
        '/settings/security',
        function (string $path, array $options) use ($member) {
            settingsVisualWithoutTwoFactor($member);
            $member->passkeys()->delete();

            $laptop = $member->passkeys()->create([
                'name' => 'MacBook Pro',
                'credential_id' => 'visual-laptop',
                'credential' => ['aaguid' => 'adce0002-35bc-c60a-648b-0b25f1f05503'],
            ]);
            $laptop->forceFill(['created_at' => now()->subDays(3), 'last_used_at' => now()->subHours(2)])->save();

            $phone = $member->passkeys()->create([
                'name' => 'The phone I carry everywhere, with a rather long name to shorten',
                'credential_id' => 'visual-phone',
                'credential' => [],
            ]);
            $phone->forceFill(['created_at' => now()->subMonths(2)])->save();

            return settingsVisualSecurityVisit($member, $options, '[data-slot="settings-shell"] [data-slot="password-card"]')
                ->assertCount('[data-slot="passkey-row"]', 2)
                ->assertPresent('[data-slot="passkey-row"] [data-slot="badge"]');
        },
    );
});

it('renders a tracker that waits for its site, the "Setup required" status, without overflow', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
    Http::fake(['*' => Http::response(['message' => 'Unexpected request in a visual test.'], 404)]);

    [$admin, $team] = settingsVisualTrackerTeam('0199a000-0000-7000-8000-000000000070');

    TeamIntegration::factory()->setupRequired()->create([
        'team_id' => $team->id,
        'connected_by_user_id' => $admin->id,
        'last_checked_at' => '2026-09-28 16:20:00',
    ]);

    $this->captureVisuals(
        'team-integrations-setup-required',
        settingsVisualIntegrationsPath(),
        fn (string $path, array $options) => settingsVisualSettingsVisit(
            $admin,
            $path,
            $options,
            '[data-slot="team-settings-shell"] [data-test="integration-card-jira"][data-status="setup"]',
        )->assertPresent('[data-test="integration-card-linear"][data-status="none"]')
            ->click('[data-test="integration-card-jira"] [data-slot="provider-row-configure"]')
            ->assertPresent('[data-test="integration-panel-jira"] button[role="combobox"]')
            ->assertNotPresent('[data-test="integration-panel-jira"] [data-slot="status-sync"]'),
    );
});

/**
 * A 512 px portrait, drawn here: the browser crop sends the same square JPEG or PNG.
 */
function settingsVisualProfilePhoto(): string
{
    $image = imagecreatetruecolor(512, 512);

    for ($y = 0; $y < 512; $y++) {
        imageline($image, 0, $y, 511, $y, (int) imagecolorallocate($image, 52 + intdiv($y, 6), 110 + intdiv($y, 8), 150 - intdiv($y, 8)));
    }

    imagefilledellipse($image, 256, 560, 420, 360, (int) imagecolorallocate($image, 38, 52, 74));
    imagefilledellipse($image, 256, 220, 210, 240, (int) imagecolorallocate($image, 226, 182, 150));
    imagefilledarc($image, 256, 170, 230, 170, 180, 360, (int) imagecolorallocate($image, 70, 44, 30), IMG_ARC_PIE);

    ob_start();
    imagepng($image);
    $png = (string) ob_get_clean();

    $path = 'avatars/'.str_pad('visualprofilephoto', 40, '0').'.png';

    Storage::disk('local')->put($path, $png);

    return $path;
}

/**
 * Waits for every image of the page, the photo among them, before the capture.
 */
function settingsVisualImagesLoaded(mixed $page): mixed
{
    $page->script(<<<'JS'
        () => Promise.all([...document.images].map((image) => image.complete
            ? true
            : new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
            })))
            .then(() => true)
        JS);

    return $page;
}

/**
 * The settings are one page: a visit to a section scrolls to it, and a
 * full-page capture of a scrolled page draws the sidebar and the top bar
 * halfway down. The capture starts from the top, with the address of the
 * test server pinned in the MCP section.
 */
function settingsVisualSettingsPicture(mixed $page): mixed
{
    $page->script(<<<'JS'
        () => {
            window.scrollTo(0, 0);

            return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))));
        }
        JS);

    if ($page->script("() => document.getElementById('mcp-url') !== null") !== true) {
        return $page;
    }

    return settingsVisualPinServerUrl($page);
}

function settingsVisualEnableGoogleAndGitHub(): void
{
    config([
        'services.google.client_id' => 'visual-google-client',
        'services.google.client_secret' => 'visual-google-secret',
        'services.github.client_id' => 'visual-github-client',
        'services.github.client_secret' => 'visual-github-secret',
    ]);
}

it('renders the profile with a chosen presence colour and a photo without overflow', function () {
    config(['skrum.mcp.enabled' => true]);
    Storage::fake('local');
    resolve(InstanceSettings::class)->set('profile_photos', true);

    $member = settingsVisualSettingsMember();
    $member->forceFill(['presence_color' => 5, 'avatar_photo_path' => settingsVisualProfilePhoto()])->save();

    $this->captureVisuals(
        'settings-profile-colours',
        '/settings/profile',
        fn (string $path, array $options) => settingsVisualSettingsPicture(settingsVisualImagesLoaded(settingsVisualSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="profile-photo"]',
        )->assertScript(
            '[...document.querySelectorAll(\'[data-slot="presence-colour-picker"] [role="radio"]\')].findIndex((radio) => radio.getAttribute("aria-checked") === "true")',
            4,
        )->assertPresent('[data-slot="settings-shell"] img[src*="/avatar-photos/"]'))),
    );
});

it('renders the appearance settings with animations reduced without overflow', function () {
    config(['skrum.mcp.enabled' => true]);

    $member = settingsVisualSettingsMember();
    $member->forceFill(['reduce_motion' => true])->save();

    $this->captureVisuals(
        'settings-appearance-motion',
        '/settings/appearance',
        fn (string $path, array $options) => settingsVisualSettingsPicture(settingsVisualSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="reduce-motion-field"] [role="switch"][aria-checked="true"]',
        )),
    );
});

/**
 * Two other devices besides the one of the capture: a Windows desktop on an
 * IPv4 address two hours ago, an iPhone on an IPv6 address three days ago.
 * The times are relative to the browser's clock: they are not travelled.
 */
function settingsVisualOtherBrowserSessions(User $member): void
{
    BrowserSession::query()->where('user_id', $member->id)->delete();

    $devices = [
        ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', '203.0.113.42', now()->subHours(2)],
        ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', '2001:db8:85a3::8a2e:370:7334', now()->subDays(3)],
    ];

    foreach ($devices as $index => [$userAgent, $ipAddress, $lastActivity]) {
        (new BrowserSession)->forceFill([
            'id' => "visual-other-device-{$index}-".str_repeat('x', 16),
            'user_id' => $member->id,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'payload' => base64_encode(serialize([])),
            'last_activity' => $lastActivity->getTimestamp(),
        ])->save();
    }
}

it('renders the security section with the breach line, three devices and the linked accounts without overflow', function () {
    config(['skrum.mcp.enabled' => true, 'session.driver' => 'database', 'session.lottery' => [0, 100]]);
    settingsVisualEnableGoogleAndGitHub();
    Password::defaults(fn (): Password => Password::min(12)->uncompromised());
    Http::fake(['api.pwnedpasswords.com/*' => Http::response("0018A45C4D1DEF81644B54AB7F969B88D65:10\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:3")]);

    $member = settingsVisualSettingsMember();
    SocialAccount::factory()->for($member)->create(['provider' => 'google', 'created_at' => '2026-03-12 09:14:00']);

    $this->captureVisuals(
        'settings-security-sessions',
        '/settings/security',
        function (string $path, array $options) use ($member) {
            settingsVisualOtherBrowserSessions($member);

            return settingsVisualSettingsPicture(settingsVisualSecurityVisit($member, $options, '[data-slot="settings-shell"] [data-slot="password-card"]')
                ->assertCount('[data-slot="active-sessions"] tbody tr', 3)
                ->assertPresent('[data-slot="linked-accounts"]')
                ->fill('#password', 'Marmot-glacier-2026')
                ->fill('#password_confirmation', 'Marmot-glacier-2026')
                ->assertPresent('[data-slot="password-breach-line"][data-state="clear"]'));
        },
    );
});

it('renders the security section of an account without a password, opened with no confirmation, without overflow', function () {
    config(['skrum.mcp.enabled' => true]);
    settingsVisualEnableGoogleAndGitHub();

    $member = settingsVisualSettingsMember();
    $member->forceFill(['password_set_at' => null])->save();
    SocialAccount::factory()->for($member)->create(['provider' => 'google', 'created_at' => '2026-03-12 09:14:00']);

    $this->captureVisuals(
        'settings-security-sso-only',
        '/settings/security',
        fn (string $path, array $options) => settingsVisualSettingsPicture(settingsVisualSettingsVisit($member, $path, $options, '[data-slot="settings-shell"] [data-slot="password-card"]')
            ->assertPathIs('/settings')
            ->assertNotPresent('[data-test="confirm-password-button"]')
            ->assertNotPresent('[data-slot="password-card"] #current_password')
            ->assertPresent('[data-slot="linked-accounts-note"]')),
    );
});
