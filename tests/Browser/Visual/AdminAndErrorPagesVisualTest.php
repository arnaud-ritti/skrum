<?php

use App\Actions\Admin\UpdateInstanceConfiguration;
use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Enums\McpScope;
use App\Enums\WorkspaceRole;
use App\Models\AuditEvent;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Workspace;
use App\Support\InstanceSettings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

const P29VisualPeople = [
    ['Camille Roux', 'camille@atlas-corp.fr'],
    ['Inès Benali', 'ines@atlas-corp.fr'],
    ['Théo Martin', 'theo@atlas-corp.fr'],
    ['Malik Kaci', 'malik@atlas-corp.fr'],
    ['Sofia Ortega', 'sofia@atlas-corp.fr'],
    ['Lucas Petit', 'lucas.p@atlas-corp.fr'],
    ['Nadia Haddad', 'nadia@atlas-corp.fr'],
    ['Hugo Lambert', 'hugo@atlas-corp.fr'],
    ['Léa Fontaine', 'lea@atlas-corp.fr'],
    ['Yann Roy', 'yann@atlas-corp.fr'],
];

/**
 * The instance of the mockup: the admin Arnaud Ritti and ten people of the Nordlys
 * workspace, one of them a second admin, one with two factors, one deactivated.
 */
function p29VisualInstance(): User
{
    config([
        'app.name' => 'Skrum',
        'app.key' => 'base64:'.base64_encode(str_repeat('v', 32)),
        'skrum.version' => '1.8.2',
        'skrum.mcp.enabled' => true,
    ]);
    RateLimiter::for('login', fn (): Limit => Limit::none());
    RateLimiter::for('passwordConfirmations', fn (): Limit => Limit::none());
    Mail::fake();

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);

    $admin = User::factory()->instanceAdmin()->create([
        'id' => '0199a000-0000-7000-8000-000000000101',
        'name' => 'Arnaud Ritti',
        'email' => 'arnaud@atlas-corp.fr',
        'created_at' => '2025-03-04 09:00:00',
        'last_signed_in_at' => now(),
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Owner->value]);
    $team->members()->attach($admin);

    foreach (P29VisualPeople as $index => [$name, $email]) {
        $factory = User::factory();

        $factory = match ($name) {
            'Camille Roux' => $factory->instanceAdmin(),
            'Inès Benali' => $factory->withTwoFactor(),
            'Yann Roy' => $factory->deactivated(),
            default => $factory,
        };

        $person = $factory->create([
            'id' => sprintf('0199a000-0000-7000-8000-%012d', 102 + $index),
            'name' => $name,
            'email' => $email,
            'created_at' => now()->subDays(200 - $index * 15),
            'last_signed_in_at' => $name === 'Lucas Petit' ? null : now()->subHours(3 + $index * 20),
        ]);
        $workspace->members()->attach($person, ['role' => $name === 'Camille Roux' ? WorkspaceRole::Admin->value : WorkspaceRole::Member->value]);

        if ($index < 6) {
            $team->members()->attach($person);
        }
    }

    resolve(InstanceSettings::class)->setMany([
        'display_name' => 'Atlas Rétros',
        'brand_color' => '#2b63b0',
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => '1.8.2',
        InstanceSettingKey::UpdateCheckedAt->value => now()->subHours(2)->toIso8601String(),
    ]);

    return $admin;
}

function p29VisualPerson(string $name): User
{
    return User::query()->where('name', $name)->sole();
}

/**
 * @param  array<string, string>  $options
 */
function p29VisualSignIn(User $user, array $options): mixed
{
    User::query()->whereKey($user->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

    $page = visit('/login', $options);

    $page->fill('#email', $user->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    return $page;
}

/**
 * @param  array<string, string>  $options
 */
function p29VisualAdminVisit(User $admin, string $path, array $options, string $marker): mixed
{
    $page = p29VisualSignIn($admin, $options);

    $page->navigate($path)
        ->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs($path);

    return $page->assertPresent($marker)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

/**
 * The OIDC provider of the mockup: the issuer and the secret from the environment,
 * the client id saved here, and a successful connection test an hour ago.
 */
function p29VisualSso(User $admin): void
{
    withEnvironmentConfiguration([
        'oidc.connections.generic.base_url' => 'https://auth.atlas-corp.fr/realms/atlas',
        'oidc.connections.generic.client_id' => 'skrum-staging',
        'oidc.connections.generic.client_secret' => 'environment-secret',
        'oidc.connections.generic.label' => 'Atlas SSO',
    ]);

    resolve(UpdateInstanceConfiguration::class)->handle($admin, InstanceSettingKey::SsoOidc, ['client_id' => 'skrum-prod'], [], '203.0.113.7');

    resolve(InstanceSettings::class)->set(InstanceSettingKey::SsoLastTest->value, [
        'provider' => 'oidc',
        'at' => now()->subHour()->toIso8601String(),
        'ok' => true,
        'ms' => 184,
        'issuer' => 'https://auth.atlas-corp.fr/realms/atlas',
    ]);
}

/**
 * Three keys of the mockup, of three people, with pinned hints and dates.
 */
function p29VisualKeys(): void
{
    $keys = [
        ['Arnaud Ritti', 'Claude Desktop — Arnaud', '9f2a', [McpScope::Read, McpScope::Write], '2026-09-12 09:00:00', now()->subMinutes(8)],
        ['Malik Kaci', 'CI — rapport hebdo', '41bc', [McpScope::Read], '2026-08-03 09:00:00', '2026-09-29 07:00:00'],
        ['Inès Benali', 'Agent de tri des actions', '07de', [McpScope::Read, McpScope::Write, McpScope::Delete], '2026-09-28 09:00:00', null],
    ];

    foreach ($keys as [$owner, $name, $hint, $scopes, $createdAt, $lastUsedAt]) {
        p29VisualPerson($owner)
            ->createToken($name, array_map(fn (McpScope $scope): string => $scope->value, $scopes))
            ->accessToken
            ->forceFill(['token_hint' => $hint, 'created_at' => $createdAt, 'last_used_at' => $lastUsedAt])
            ->save();
    }
}

/**
 * Events of the four groups (settings, accounts, sign-in, keys), newest first, beside the
 * configuration change and the sign-in the real actions record.
 */
function p29VisualAuditEvents(User $admin): void
{
    $camille = p29VisualPerson('Camille Roux');
    $malik = p29VisualPerson('Malik Kaci');
    $yann = p29VisualPerson('Yann Roy');
    $token = PersonalAccessToken::query()->where('name', 'CI — rapport hebdo')->sole();
    $revokedToken = $malik->createToken('Test Cursor', [McpScope::Read->value])->accessToken;

    $revokedToken->delete();

    $events = [
        [$admin, AuditAction::SsoTested, null, null, ['provider' => 'oidc', 'ok' => true], 45],
        [$camille, AuditAction::UserDeactivated, 'User', $yann->id, [], 180],
        [$admin, AuditAction::TokenRevokedByAdmin, 'PersonalAccessToken', (string) $revokedToken->id, ['owner' => $malik->id, 'name' => 'Test Cursor'], 320],
        [null, AuditAction::SignInFailed, null, null, ['email' => 'yann@atlas-corp.fr'], 600],
        [$malik, AuditAction::TokenCreated, 'PersonalAccessToken', (string) $token->id, ['owner' => $malik->id, 'name' => 'CI — rapport hebdo'], 1500],
        [$admin, AuditAction::AdminGranted, 'User', $camille->id, [], 2900],
        [$camille, AuditAction::SettingsUpdated, null, null, ['section' => 'branding', 'keys' => ['display_name', 'brand_color']], 4300],
        [$malik, AuditAction::TwoFactorEnabled, null, null, ['method' => 'totp'], 5800],
        [$camille, AuditAction::SignedIn, null, null, ['method' => 'password'], 7200],
    ];

    foreach ($events as [$actor, $action, $subjectType, $subjectId, $properties, $minutesAgo]) {
        AuditEvent::factory()->create([
            'actor_user_id' => $actor?->id,
            'actor_name' => $actor === null ? '' : $actor->name,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'properties' => $properties,
            'ip_address' => '203.0.113.7',
            'created_at' => now()->subMinutes($minutesAgo),
        ]);
    }
}

it('renders the admin sections without overflow', function (string $name, string $path, string $marker) {
    $admin = p29VisualInstance();

    p29VisualSso($admin);

    withEnvironmentConfiguration([
        'mail.default' => 'smtp',
        'mail.mailers.smtp.host' => 'smtp.atlas-corp.fr',
        'mail.mailers.smtp.port' => 587,
        'mail.mailers.smtp.scheme' => 'smtp',
        'mail.mailers.smtp.username' => 'skrum',
        'mail.mailers.smtp.password' => 'environment-password',
        'mail.from.address' => 'retro@atlas-corp.fr',
        'mail.from.name' => 'Atlas Rétros',
        'services.slack.client_id' => 'atlas-slack',
        'services.slack.client_secret' => 'environment-slack-secret',
        'services.jira.client_id' => 'atlas-jira',
        'services.jira.client_secret' => 'environment-jira-secret',
    ]);

    $settings = resolve(InstanceSettings::class);

    $settings->setMany([
        InstanceSettingKey::SignupMode->value => 'domain',
        InstanceSettingKey::AllowedEmailDomains->value => ['atlas-corp.fr', 'nordlys.io'],
        InstanceSettingKey::MaintenanceMessage->value => 'Mise à jour mensuelle : on revient vite.',
        InstanceSettingKey::MaintenanceMessageBy->value => $admin->id,
    ]);
    $settings->set(InstanceSettingKey::MailLastTest->value, [
        'at' => now()->subHour()->toIso8601String(),
        'ok' => true,
        'to' => $admin->email,
        'error' => null,
    ]);

    TeamIntegration::factory()->slack()->create([
        'team_id' => Team::query()->where('name', 'Atlas')->sole()->id,
        'connected_by_user_id' => $admin->id,
        'last_checked_at' => '2026-09-28 16:20:00',
    ]);

    p29VisualKeys();
    p29VisualAuditEvents($admin);

    $this->captureVisuals(
        $name,
        $path,
        fn (string $path, array $options) => p29VisualAdminVisit($admin, $path, $options, $marker),
    );
})->with([
    'general' => ['admin-general-page', '/admin/general', '[data-slot="general-settings-form"] [data-slot="maintenance-saved-by"]'],
    'branding' => ['admin-branding-section-page', '/admin/branding', '[data-slot="branding-form"] [data-slot="color-applied-light"]'],
    'sso' => ['admin-sso-page', '/admin/sign-in', '[data-slot="sso-provider-card"][data-provider="oidc"] [data-slot="secret-field"]'],
    'smtp' => ['admin-smtp-page', '/admin/mail', '[data-slot="mail-settings-card"] [data-slot="mail-transport-fields"]'],
    'integrations' => ['admin-integrations-page', '/admin/integrations', '[data-slot="integration-row"]'],
    'mcp keys' => ['admin-mcp-keys-page', '/admin/mcp-keys', '[data-slot="mcp-keys-table"]'],
    'licence' => ['admin-licence-page', '/admin/licence', '[data-slot="licence-badge"]'],
    'users' => ['admin-users-page', '/admin/users', '[data-slot="users-table"] [data-slot="user-row"]'],
    'audit log' => ['admin-audit-log-page', '/admin/audit-log', '[data-slot="audit-table"] [data-slot="audit-row"]'],
]);

it('renders the SSO section with a stale confirmation without overflow', function () {
    $admin = p29VisualInstance();

    p29VisualSso($admin);

    $signedInAt = now();

    $this->captureVisuals(
        'admin-sso-stale-confirmation',
        '/admin/sign-in',
        function (string $path, array $options) use ($admin, $signedInAt) {
            $this->travelTo($signedInAt);

            $page = p29VisualAdminVisit($admin, $path, $options, '[data-slot="sso-provider-card"]');

            $this->travel(6)->minutes();

            return $page->navigate($path)->assertPresent('[data-slot="confirmation-line"]');
        },
    );
});

it('renders the OIDC card with a stored secret without overflow', function () {
    $admin = p29VisualInstance();

    p29VisualSso($admin);

    resolve(UpdateInstanceConfiguration::class)->handle($admin, InstanceSettingKey::SsoOidc, ['client_secret' => 'stored-visual-secret'], [], '203.0.113.7');

    AuditEvent::query()->where('action', AuditAction::ConfigurationUpdated)->update(['created_at' => now()->subDays(12)]);

    $this->captureVisuals(
        'admin-sso-stored-secret',
        '/admin/sign-in',
        fn (string $path, array $options) => p29VisualAdminVisit(
            $admin,
            $path,
            $options,
            '[data-slot="sso-provider-card"][data-provider="oidc"] [data-slot="secret-field"][data-source="stored"]',
        ),
    );
});

it('renders the configure dialog of Slack without overflow', function () {
    $admin = p29VisualInstance();

    withEnvironmentConfiguration([
        'services.slack.client_id' => 'atlas-slack',
        'services.slack.client_secret' => 'environment-slack-secret',
        'services.jira.client_id' => 'atlas-jira',
        'services.jira.client_secret' => 'environment-jira-secret',
    ]);

    $this->captureVisuals(
        'admin-integrations-slack-dialog',
        '/admin/integrations',
        fn (string $path, array $options) => p29VisualAdminVisit($admin, $path, $options, '[data-slot="integration-row"]')
            ->click('[data-slot="integration-row"] >> nth=0 >> button:not([role="switch"])')
            ->assertPresent('[role="dialog"] [data-slot="configuration-field"]'),
    );
});

it('renders the 403 page with the access request without overflow', function (string $name, bool $pending, string $marker) {
    p29VisualInstance();

    $team = Team::query()->where('name', 'Atlas')->sole();
    $nadia = p29VisualPerson('Nadia Haddad');

    if ($pending) {
        TeamAccessRequest::factory()->for($team)->pending()->create([
            'user_id' => $nadia->id,
            'message' => 'Je rejoins l\'équipe pour le sprint 42.',
        ]);
    }

    $path = (string) parse_url(route('teams.show', [$team->workspace, $team]), PHP_URL_PATH);

    $this->captureVisuals(
        $name,
        $path,
        fn (string $path, array $options) => p29VisualSignIn($nadia, $options)
            ->navigate($path)
            ->assertPresent($marker),
    );
})->with([
    'form' => ['access-error-403-request-page', false, '[data-slot="error-page"][data-status="403"] [data-slot="access-request"] textarea'],
    'sent' => ['access-error-403-request-sent-page', true, '[data-slot="error-page"][data-status="403"] [data-slot="access-request-actions"] button[aria-disabled="true"]'],
]);

it('renders the maintenance page with its time of return and message without overflow', function () {
    $admin = p29VisualInstance();

    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::MaintenanceMessage->value => 'Mise à jour mensuelle : on revient vite.',
        InstanceSettingKey::MaintenanceMessageBy->value => $admin->id,
    ]);

    config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'array']);

    $this->artisan('down', ['--retry' => 1800])->assertSuccessful();

    try {
        $this->captureVisuals(
            'access-error-503-maintenance-page',
            '/',
            function (string $path, array $options) {
                $page = visit($path, $options)
                    ->assertPresent('[data-slot="maintenance-back-at"]')
                    ->assertPresent('[data-slot="maintenance-message"]');

                $page->script(<<<'JS'
                    () => {
                        document.querySelector('[data-slot="maintenance-back-at"] time').textContent = '12:30 UTC';

                        return true;
                    }
                    JS);

                return $page;
            },
            appShell: false,
        );
    } finally {
        $this->artisan('up');
    }
});

it('renders the status page without overflow', function () {
    p29VisualInstance();

    $this->artisan('skrum:heartbeat')->assertSuccessful();

    $this->captureVisuals(
        'status-page',
        '/status',
        fn (string $path, array $options) => visit($path, $options)->assertPresent('[data-slot="status-page"] [data-slot="status-component"]'),
        appShell: false,
    );
});
