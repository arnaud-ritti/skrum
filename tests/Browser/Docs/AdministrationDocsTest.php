<?php

use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Enums\McpScope;
use App\Models\AuditEvent;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\InstanceSettings;
use Carbon\CarbonInterface;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Browser\Support\DocsWorld;

beforeEach(function () {
    RateLimiter::for('passwordConfirmations', fn (): Limit => Limit::none());

    config(['skrum.version' => '1.4.0', 'skrum.mcp.enabled' => true]);
});

function docsAdministrationAdmin(DocsWorld $world): User
{
    $admin = $world->person('Camille');

    $admin->forceFill(['is_instance_admin' => true])->save();

    return $admin;
}

function docsAdministrationSection(string $marker): string
{
    return "[data-slot=\"admin-shell\"] section:has({$marker})";
}

function docsAdministrationUnfocused(mixed $page): mixed
{
    $page->script('() => { document.activeElement?.blur(); return true; }');

    return $page;
}

/**
 * @param  array<int, McpScope>  $scopes
 */
function docsAdministrationKey(User $owner, string $name, array $scopes, string $hint, string $createdAt, ?Team $team = null, ?CarbonInterface $lastUsedAt = null, ?string $expiresAt = null): void
{
    $token = $owner->createToken($name, array_map(fn (McpScope $scope): string => $scope->value, $scopes))->accessToken;

    assert($token instanceof PersonalAccessToken);

    $token->forceFill([
        'team_id' => $team?->id,
        'token_hint' => $hint,
        'created_at' => $createdAt,
        'last_used_at' => $lastUsedAt,
        'expires_at' => $expiresAt,
    ])->save();
}

/**
 * @param  array<string, mixed>  $properties
 */
function docsAdministrationEvent(AuditAction $action, ?User $actor, CarbonInterface $at, string $ip, array $properties = [], ?string $subjectType = null, ?string $subjectId = null): void
{
    AuditEvent::factory()->create([
        'actor_user_id' => $actor?->id,
        'actor_name' => $actor->name ?? '',
        'action' => $action,
        'subject_type' => $subjectType,
        'subject_id' => $subjectId,
        'properties' => $properties === [] ? null : $properties,
        'ip_address' => $ip,
        'created_at' => $at,
    ]);
}

it('shows the general settings with sign-up limited to two domains and a newer version found', function () {
    $world = DocsWorld::create();
    $admin = docsAdministrationAdmin($world);

    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::SignupMode->value => 'domain',
        InstanceSettingKey::AllowedEmailDomains->value => ['nordlys.example', 'nordlys-labs.example'],
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => '1.5.0',
        InstanceSettingKey::UpdateCheckedAt->value => now()->toIso8601String(),
    ]);

    $path = route('admin.general.edit', [], false);

    $page = passwordConfirmedPage($this->docsVisit($admin, $path), $path)
        ->resize(1440, 1400)
        ->assertPresent('[data-slot="general-settings-form"] [data-slot="domain-chips"]')
        ->assertSeeIn('[data-slot="update-last-check"]', 'v1.5.0 is available');

    $this->docShot($page, 'administration/general', '[data-slot="general-settings-form"]');
    $this->docShot($page, 'administration/updates', '[data-slot="settings-card"]:has([data-slot="general-version"])');
});

it('shows the branding form with a name and a colour tried in the preview, and the settings of the GIF search', function () {
    $world = DocsWorld::create();
    $admin = docsAdministrationAdmin($world);

    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::GifProvider->value => 'giphy',
        InstanceSettingKey::GifKey->value => 'docs-gif-key',
    ]);

    $path = route('admin.branding.edit', [], false);
    $form = '[data-slot="branding-form"]';

    $page = passwordConfirmedPage($this->docsVisit($admin, $path), $path)
        ->resize(1440, 1900)
        ->assertPresent("{$form} [data-slot=\"color-field\"]")
        ->fill("{$form} input[placeholder=\"Skrum\"]", 'Nordlys')
        ->fill("{$form} input[placeholder=\"#bb4d2a\"]", '#2B63B0')
        ->assertSeeIn("{$form} [data-slot=\"color-applied-light\"]", '#2b63b0')
        ->assertPresent("{$form} [data-slot=\"gif-key-state\"]")
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot(docsAdministrationUnfocused($page), 'administration/branding', "{$form} section:has([data-slot=\"brand-preview\"])");
    $this->docShot($page, 'administration/gifs', "{$form} [data-slot=\"card\"]:has([data-slot=\"gif-settings\"])");
});

it('shows an OpenID Connect provider configured from the environment, and what still keeps single sign-on from being required', function () {
    $world = DocsWorld::create();
    $admin = docsAdministrationAdmin($world);

    withEnvironmentConfiguration([
        'oidc.connections.generic.base_url' => 'https://id.nordlys.example',
        'oidc.connections.generic.client_id' => 'skrum',
        'oidc.connections.generic.client_secret' => 'docs-oidc-secret',
    ]);
    config(['oidc.connections.generic.redirect' => 'https://skrum.nordlys.example/auth/oidc/callback']);
    storeConfiguration(InstanceSettingKey::SsoOidc, ['label' => 'Nordlys SSO']);

    $path = route('admin.signIn.edit', [], false);
    $card = '[data-slot="sso-provider-card"][data-provider="oidc"]';

    $page = passwordConfirmedPage($this->docsVisit($admin, $path), $path)
        ->assertSeeIn($card, 'Configured')
        ->assertSeeIn($card, 'Test the connection')
        ->assertPresent('[data-slot="sign-in-settings-form"] [data-slot="sign-in-blockers"]');

    $this->docShot($page, 'administration/sso-provider', $card);
    $this->docShot($page, 'administration/sign-in', '[data-slot="sign-in-settings-form"]');
});

it('shows an SMTP server saved in Administration, with the form that sends a test email', function () {
    $world = DocsWorld::create();
    $admin = docsAdministrationAdmin($world);

    Mail::fake();

    withEnvironmentConfiguration(['mail.mailers.smtp.port' => 587]);
    storeConfiguration(InstanceSettingKey::Smtp, [
        'mailer' => 'smtp',
        'host' => 'smtp.nordlys.example',
        'scheme' => 'smtp',
        'username' => 'skrum',
        'password' => 'docs-smtp-password',
        'from_address' => 'skrum@nordlys.example',
        'from_name' => 'Nordlys',
    ]);

    $path = route('admin.mail.show', [], false);
    $card = '[data-slot="mail-settings-card"]';

    $page = passwordConfirmedPage($this->docsVisit($admin, $path), $path)
        ->assertPresent("{$card} [data-slot=\"mail-operational\"]")
        ->assertPresent("{$card} input[name=\"host\"][value=\"smtp.nordlys.example\"]")
        ->assertPresent("{$card} [data-slot=\"mail-test-form\"]");

    $this->docShot($page, 'administration/mail', $card);
});

it('lists the integrations of the instance, one used by a team and one turned off, and opens the app of Linear', function () {
    $world = DocsWorld::create();
    $admin = docsAdministrationAdmin($world);

    withEnvironmentConfiguration([
        'services.slack.client_id' => 'nordlys-slack',
        'services.slack.client_secret' => 'docs-slack-secret',
        'services.mattermost.url' => 'https://chat.nordlys.example',
    ]);
    config(['services.linear.redirect' => 'https://skrum.nordlys.example/integrations/linear/callback']);
    storeConfiguration(InstanceSettingKey::IntegrationLinear, [
        'client_id' => 'a3f1c29d7b6e4c0f8d25',
        'client_secret' => 'docs-linear-secret',
        'webhook_secret' => 'docs-linear-webhook-secret',
    ]);
    resolve(InstanceSettings::class)->set(InstanceSettingKey::DisabledIntegrations->value, ['mattermost']);
    TeamIntegration::factory()->slack()->create(['team_id' => $world->team->id, 'connected_by_user_id' => $admin->id]);

    $path = route('admin.integrations.edit', [], false);
    $row = fn (string $name): string => "[data-slot=\"integration-row\"]:has(span:text-is(\"{$name}\"))";

    $page = passwordConfirmedPage($this->docsVisit($admin, $path), $path)
        ->assertSeeIn($row('Slack'), 'Available · 1 team connected')
        ->assertSeeIn($row('Linear'), 'Available · 0 teams connected')
        ->assertSeeIn($row('Mattermost'), 'Turned off');

    $this->docShot($page, 'administration/integration-apps', docsAdministrationSection('[data-slot="integration-row"]'));

    $page->click("{$row('Linear')} button:has-text(\"Configure\")")
        ->assertSeeIn('[role="dialog"]', 'Linear app')
        ->assertSeeIn('[role="dialog"]', 'Webhook URL');

    $page->script(<<<'JS'
        () => {
            for (const input of document.querySelectorAll('[role="dialog"] input[readonly]')) {
                input.value = input.value.replace(location.origin, 'https://skrum.nordlys.example');
            }

            return true;
        }
        JS);

    $this->docShot(docsAdministrationUnfocused($page), 'administration/integration-app-dialog', '[role="dialog"]');
});

it('lists the accounts of the instance with an admin, a second factor and a deactivated account', function () {
    $world = DocsWorld::create();
    $admin = docsAdministrationAdmin($world);

    $lastSignIns = [
        'Théo' => now()->subHours(3)->subMinutes(10),
        'Inès' => now()->subDays(1)->subHours(2),
        'Malik' => now()->subDays(2)->subHours(2),
        'Sofia' => now()->subDays(6)->subHours(2),
        'Noa' => now()->subDays(1)->subHours(4),
        'Lucas' => now()->subDays(40)->subHours(2),
        'Yuki' => null,
    ];

    foreach ($world->people->values() as $index => $person) {
        $firstName = str($person->name)->before(' ')->toString();

        $person->forceFill([
            'created_at' => sprintf('2026-%02d-12 09:00:00', $index + 1),
            'last_signed_in_at' => $lastSignIns[$firstName] ?? null,
        ])->save();
    }

    $world->person('Théo')->forceFill(['two_factor_email_enabled_at' => now()])->save();
    $world->person('Lucas')->forceFill(['deactivated_at' => now()])->save();

    $path = route('admin.users.index', [], false);
    $rows = '[data-slot="users-table"] [data-slot="user-row"]';

    $page = passwordConfirmedPage($this->docsVisit($admin, $path), $path)
        ->assertCount($rows, 8)
        ->assertSeeIn("{$rows}:has-text(\"Camille Roux\")", 'Admin')
        ->assertSeeIn("{$rows}:has-text(\"Théo Martin\")", '2FA on')
        ->assertSeeIn("{$rows}:has-text(\"Lucas Durand\")", 'Deactivated')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'administration/users', docsAdministrationSection('[data-slot="users-table"]'));
});

it('lists two instance admins under the form that adds one', function () {
    $world = DocsWorld::create();
    $admin = docsAdministrationAdmin($world);

    $world->person('Théo')->forceFill(['is_instance_admin' => true])->save();

    $path = route('admin.admins.index', [], false);

    $page = passwordConfirmedPage($this->docsVisit($admin, $path), $path)
        ->assertCount('[data-slot="admins-panel"] [data-slot="admin-row"]', 2)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'administration/admins', '[data-slot="admins-panel"]');
});

it('lists the keys of three people with their scopes, their team, their last use and their expiry', function () {
    $world = DocsWorld::create();
    $admin = docsAdministrationAdmin($world);

    docsAdministrationKey($admin, 'Claude Desktop', [McpScope::Read, McpScope::Write], 'x7Qd', '2026-09-21 10:00:00', lastUsedAt: now()->subHours(3)->subMinutes(10));
    docsAdministrationKey($world->person('Théo'), 'Sprint report script', [McpScope::Read], 'p2Lm', '2026-08-17 10:00:00', team: $world->team, expiresAt: '2027-03-31 12:00:00');
    docsAdministrationKey($world->person('Inès'), 'Cursor', [McpScope::Read, McpScope::Write, McpScope::Delete], 'h9Vt', '2026-07-06 10:00:00', lastUsedAt: now()->subDays(2)->subHours(2));

    $path = route('admin.mcpKeys.index', [], false);
    $rows = '[data-slot="mcp-keys-table"] tbody tr';

    $page = passwordConfirmedPage($this->docsVisit($admin, $path), $path)
        ->assertCount($rows, 3)
        ->assertSeeIn("{$rows}:has-text(\"Sprint report script\")", 'Atlas')
        ->assertSeeIn("{$rows}:has-text(\"Cursor\")", 'mcp:delete')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'administration/mcp-keys', docsAdministrationSection('[data-slot="mcp-keys-table"]'));
});

it('shows the licence of the project with the number of accounts in use', function () {
    $world = DocsWorld::create();
    $admin = docsAdministrationAdmin($world);

    $path = route('admin.licence.show', [], false);

    $page = passwordConfirmedPage($this->docsVisit($admin, $path), $path)
        ->assertSeeIn('[data-slot="licence-badge"]', 'AGPL-3.0-or-later')
        ->assertSeeIn('[data-slot="licence-accounts"]', '8');

    $this->docShot($page, 'administration/licence', '[data-slot="settings-card"]:has([data-slot="licence-badge"])');
});

it('lists a week of audit events: settings, accounts, sign-ins and keys', function () {
    $world = DocsWorld::create();
    $admin = docsAdministrationAdmin($world);
    $theo = $world->person('Théo');
    $lucas = $world->person('Lucas');

    docsAdministrationEvent(AuditAction::ConfigurationUpdated, $admin, now()->subMinutes(12)->subSeconds(10), '203.0.113.24', ['section' => 'smtp', 'changed' => ['host', 'password', 'port'], 'cleared' => [], 'alertSent' => true]);
    docsAdministrationEvent(AuditAction::MailTested, $admin, now()->subMinutes(9)->subSeconds(10), '203.0.113.24', ['ok' => true]);
    docsAdministrationEvent(AuditAction::SignInFailed, null, now()->subHours(3)->subMinutes(10), '198.51.100.61', ['email' => 'lucas@nordlys.example'], 'User', $lucas->id);
    docsAdministrationEvent(AuditAction::UserDeactivated, $admin, now()->subDays(1)->subHours(2), '203.0.113.24', [], 'User', $lucas->id);
    docsAdministrationEvent(AuditAction::TokenCreated, $theo, now()->subDays(2)->subHours(2), '203.0.113.87', ['name' => 'Sprint report script'], 'PersonalAccessToken', '0199d0c5-0000-7000-8000-00000000a001');
    docsAdministrationEvent(AuditAction::TwoFactorEnabled, $theo, now()->subDays(2)->subHours(3), '203.0.113.87', ['method' => 'email_code'], 'User', $theo->id);
    docsAdministrationEvent(AuditAction::AdminGranted, $admin, now()->subDays(5)->subHours(2), '203.0.113.24', [], 'User', $theo->id);
    docsAdministrationEvent(AuditAction::SettingsUpdated, $admin, now()->subDays(6)->subHours(2), '203.0.113.24', ['section' => 'general', 'keys' => ['signup_mode', 'allowed_email_domains']]);

    $path = route('admin.auditEvents.index', [], false);
    $rows = '[data-slot="audit-table"] [data-slot="audit-row"]';

    $confirmation = $this->docsVisit($admin, $path)->assertPathIs('/user/confirm-password');

    AuditEvent::query()->where('action', AuditAction::SignedIn)->update(['ip_address' => '203.0.113.24']);

    $page = $confirmation->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs($path)
        ->assertCount($rows, 9)
        ->assertSeeIn("{$rows}:has-text(\"SMTP\")", 'changed Host, Password, Port of SMTP (admins alerted)')
        ->assertSeeIn("{$rows}:has-text(\"System\")", 'failed sign-in as lucas@nordlys.example')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'administration/audit-log', docsAdministrationSection('[data-slot="audit-table"]'));
});
