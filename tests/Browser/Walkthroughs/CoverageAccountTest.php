<?php

use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\AuditEvent;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use App\Models\Workspace;
use App\Support\InstanceSettings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Browser\Support\InteractsWithIntegrations;

pest()->use(InteractsWithIntegrations::class);

const CaccAdminPages = [
    '/admin',
    '/admin/general',
    '/admin/branding',
    '/admin/sign-in',
    '/admin/mail',
    '/admin/integrations',
    '/admin/mcp-keys',
    '/admin/licence',
    '/admin/users',
    '/admin/admins',
    '/admin/audit-log',
];

const CaccSettingsPages = [
    '/settings',
    '/settings/profile',
    '/settings/appearance',
    '/settings/notifications',
    '/settings/security',
    '/settings/api-tokens',
];

beforeEach(function () {
    RateLimiter::for('login', fn (): Limit => Limit::none());
    RateLimiter::for('passwordConfirmations', fn (): Limit => Limit::none());
    config(['skrum.version' => '1.8.2', 'skrum.mcp.enabled' => true]);
    Mail::fake();
});

/**
 * The Nordlys workspace and its team Atlas: Arnaud is the instance admin and owns the workspace and the team,
 * Théo is a member of Atlas, Nadia a member of the workspace outside Atlas.
 *
 * @return array{
 *     workspace: Workspace,
 *     team: Team,
 *     admin: User,
 *     theo: User,
 *     nadia: User
 * }
 */
function caccInstance(): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);

    $admin = User::factory()->instanceAdmin()->create(['name' => 'Arnaud Ritti', 'email' => 'arnaud@nordlys.example', 'locale' => 'en']);
    $theo = User::factory()->create(['name' => 'Théo Martin', 'email' => 'theo@nordlys.example', 'locale' => 'en']);
    $nadia = User::factory()->create(['name' => 'Nadia Haddad', 'email' => 'nadia@nordlys.example', 'locale' => 'en']);

    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Owner->value]);
    $workspace->members()->attach($theo, ['role' => WorkspaceRole::Member->value]);
    $workspace->members()->attach($nadia, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($admin, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($theo, ['role' => TeamRole::Member->value]);

    return ['workspace' => $workspace, 'team' => $team, 'admin' => $admin, 'theo' => $theo, 'nadia' => $nadia];
}

function caccConfirm(mixed $page, string $path): mixed
{
    return $page->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs($path);
}

function caccSave(mixed $page): mixed
{
    return $page->click('[data-slot="unsaved-bar"] button[type="submit"]:has-text("Save")');
}

it('[CAcc-01] sends a visitor who opens the settings or any administration section to the log in page', function () {
    $page = visit('/settings')->assertPathIs('/login');

    foreach ([...CaccSettingsPages, ...CaccAdminPages] as $path) {
        $page->navigate($path)
            ->assertPathIs('/login')
            ->assertNotPresent('[data-slot="settings-shell"]')
            ->assertNotPresent('[data-slot="admin-shell"]');
    }

    $page->assertNoJavaScriptErrors();
});

it('[CAcc-02] answers 403 on every administration section to a workspace owner who is not an instance admin', function () {
    ['workspace' => $workspace] = caccInstance();
    $owner = User::factory()->create(['name' => 'Olivia Owner', 'locale' => 'en']);
    $workspace->members()->attach($owner, ['role' => WorkspaceRole::Owner->value]);

    $page = $this->signIn($owner, '/dashboard');

    foreach (CaccAdminPages as $path) {
        $page->navigate($path)
            ->assertPathIs($path)
            ->assertPresent('[data-slot="error-page"][data-status="403"]')
            ->assertNotPresent('[data-slot="admin-shell"]');
    }

    $page->assertNoJavaScriptErrors();
});

it('[CAcc-03] sends a guest of a retro who opens the settings or the administration to the log in page', function () {
    ['team' => $team] = caccInstance();
    $retro = Retro::factory()->for($team)->withGuestAccess()->create(['title' => 'Sprint 42']);

    $page = $this->joinAsGuest(route('retros.join.show', $retro->guest_token), 'Gaspard');

    $page->assertPathIs(route('retros.show', $retro, false));

    foreach (['/settings', '/settings/security', '/admin/general'] as $path) {
        $page->navigate($path)
            ->assertPathIs('/login')
            ->assertNotPresent('[data-slot="settings-shell"]');
    }

    $page->assertNoJavaScriptErrors();
});

it('[CAcc-04] opens the SSO section without a script error for an admin who belongs to a workspace, with the e-mail fallback locked on', function () {
    ['admin' => $admin] = caccInstance();

    caccConfirm($this->signIn($admin, '/admin/sign-in'), '/admin/sign-in')
        ->assertPresent('[data-slot="admin-shell"]')
        ->assertCount('[data-slot="sso-provider-card"]', 4)
        ->assertSeeIn('[data-slot="sso-provider-card"][data-provider="oidc"] [data-slot="email-fallback-row"]', 'Keep sign-in by e-mail as fallback')
        ->assertAttribute('[data-slot="sso-provider-card"][data-provider="oidc"] [data-slot="email-fallback-row"] [role="switch"]', 'aria-checked', 'true')
        ->assertDisabled('[data-slot="sso-provider-card"][data-provider="oidc"] [data-slot="email-fallback-row"] [role="switch"]')
        ->assertSeeIn('[data-slot="sidebar"]', 'Atlas')
        ->assertNoJavaScriptErrors();
});

it('[CAcc-05] saves an OpenID Connect provider from the SSO section, whose button then shows on the log in page', function () {
    ['admin' => $admin] = caccInstance();
    $card = '[data-slot="sso-provider-card"][data-provider="oidc"]';

    $page = caccConfirm($this->signIn($admin, '/admin/sign-in'), '/admin/sign-in');

    $page->assertSeeIn($card, 'Not configured')
        ->fill("{$card} input[name=\"base_url\"]", 'https://login.nordlys.example/realms/atlas')
        ->fill("{$card} input[name=\"client_id\"]", 'skrum-nordlys')
        ->fill("{$card} [data-slot=\"secret-field\"] input", 'nordlys-oidc-secret')
        ->fill("{$card} input[name=\"label\"]", 'Nordlys SSO');

    caccSave($page)
        ->assertSeeIn($card, 'Configured')
        ->assertValue("{$card} [data-slot=\"secret-field\"] input", '')
        ->assertScript("document.documentElement.innerHTML.includes('nordlys-oidc-secret')", false)
        ->assertNoJavaScriptErrors();

    expect(AuditEvent::query()->where('action', AuditAction::ConfigurationUpdated)->sole()->properties['section'])->toBe('sso_oidc');

    visit('/login')
        ->assertSeeIn('[data-slot="sso-buttons"]', 'Continue with Nordlys SSO')
        ->assertAttributeContains('[data-slot="sso-buttons"] a:has-text("Nordlys SSO")', 'href', '/auth/oidc/redirect');
});

it('[CAcc-06] says "up to date" in the admin footer when the latest release is the running one, and the version alone with the check off', function () {
    ['admin' => $admin] = caccInstance();
    $settings = resolve(InstanceSettings::class);
    $settings->setMany([
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => '1.8.2',
        InstanceSettingKey::UpdateCheckedAt->value => now()->subHour()->toIso8601String(),
    ]);

    $page = caccConfirm($this->signIn($admin, '/admin/general'), '/admin/general');

    $page->assertSeeIn('[data-slot="admin-version"]', 'v1.8.2')
        ->assertSeeIn('[data-slot="admin-version-state"]', 'up to date');

    $settings->set(InstanceSettingKey::UpdateCheckEnabled->value, false);

    $page->navigate('/admin/licence')
        ->assertSeeIn('[data-slot="admin-version"]', 'v1.8.2')
        ->assertNotPresent('[data-slot="admin-version-state"]')
        ->assertNoJavaScriptErrors();
});

it('[CAcc-07] filters the audit log by group of events and by actor, and says when nothing matches', function () {
    ['admin' => $admin, 'theo' => $theo] = caccInstance();
    $rows = '[data-slot="audit-table"] [data-slot="audit-row"]';

    AuditEvent::factory()->create(['actor_user_id' => $admin->id, 'actor_name' => $admin->name, 'action' => AuditAction::SettingsUpdated, 'properties' => ['section' => 'branding', 'keys' => ['brand_color']], 'created_at' => now()->subHours(3)]);
    AuditEvent::factory()->create(['actor_user_id' => $theo->id, 'actor_name' => $theo->name, 'action' => AuditAction::TwoFactorEnabled, 'properties' => ['method' => 'totp'], 'created_at' => now()->subHours(2)]);
    AuditEvent::factory()->create(['actor_user_id' => $admin->id, 'actor_name' => $admin->name, 'action' => AuditAction::UserDeactivated, 'subject_type' => 'User', 'subject_id' => $theo->id, 'properties' => [], 'created_at' => now()->subHour()]);

    $page = caccConfirm($this->signIn($admin, '/admin/audit-log'), '/admin/audit-log');
    $initialCount = $page->script("() => document.querySelectorAll('{$rows}').length");

    expect($initialCount)->toBeGreaterThanOrEqual(3);

    $page->click('[data-slot="audit-group-filter"]')
        ->click('[role="option"]:has-text("Accounts")')
        ->assertQueryStringHas('group', 'accounts')
        ->assertCount($rows, 1)
        ->assertSeeIn($rows, 'deactivated Théo Martin');

    $page->click('[data-slot="audit-group-filter"]')
        ->click('[role="option"]:has-text("All")')
        ->assertQueryStringMissing('group')
        ->click('[data-slot="audit-actor-filter"]')
        ->click('[role="option"]:has-text("Théo Martin")')
        ->assertQueryStringHas('actor', $theo->id)
        ->assertSeeIn('[data-slot="audit-actor-filter"]', 'Théo Martin')
        ->assertCount($rows, 1);

    $page->click('[data-slot="audit-group-filter"]')
        ->click('[role="option"]:has-text("Tokens")')
        ->assertNotPresent($rows)
        ->assertSeeIn('[data-slot="audit-empty"]', 'No event matches these filters.')
        ->assertNoJavaScriptErrors();
});

it('[CAcc-08] hides an integration that no team uses, once the admin turns it off, from the integrations of a team, and shows it again once turned back on', function () {
    disableIntegrations();
    withEnvironmentConfiguration([
        'services.slack.client_id' => 'atlas-slack',
        'services.slack.client_secret' => 'environment-slack-secret',
        'services.telegram.bot_token' => '123456:telegram-token',
    ]);
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']])]);
    ['admin' => $admin, 'team' => $team] = caccInstance();
    $integrationsPath = route('teams.integrations.index', [$team->workspace, $team], false);
    $slack = '[data-slot="integration-row"]:has-text("Slack")';

    $page = caccConfirm($this->signIn($admin, '/admin/integrations'), '/admin/integrations');

    $page->click("{$slack} [role=\"switch\"]")
        ->assertSee('Integration settings saved.')
        ->assertSeeIn($slack, 'Turned off');

    $page->navigate($integrationsPath)
        ->assertPresent($this->integrationRow('telegram'))
        ->assertNotPresent($this->integrationRow('slack'));

    $page->navigate('/admin/integrations')
        ->click("{$slack} [role=\"switch\"]")
        ->assertSee('Integration settings saved.')
        ->navigate($integrationsPath)
        ->assertPresent($this->integrationRow('slack'))
        ->assertPresent($this->integrationRow('telegram'))
        ->assertNoJavaScriptErrors();
});

it('[CAcc-09] turns profile photos on in Branding, after which a member finds the photo controls in the profile', function () {
    ['admin' => $admin, 'theo' => $theo] = caccInstance();
    $switch = '[data-slot="avatar-style-profile-photos"] [role="switch"]';

    $page = caccConfirm($this->signIn($admin, '/admin/branding'), '/admin/branding');

    $page->assertAttribute($switch, 'aria-checked', 'false')
        ->click($switch)
        ->assertAttribute($switch, 'aria-checked', 'true');

    caccSave($page)
        ->assertSee('Branding saved.')
        ->assertNoJavaScriptErrors();

    $settings = resolve(InstanceSettings::class);
    $settings->refresh();

    expect($settings->profilePhotos())->toBeTrue();

    $this->signIn($theo, '/settings/profile')
        ->assertSeeIn('[data-slot="profile-photo"]', 'Upload photo')
        ->assertNoJavaScriptErrors();
});

it('[CAcc-10] a manager declines an access request from the bell: the team is unchanged and the requester is told, live', function () {
    ['team' => $team, 'admin' => $arnaud, 'nadia' => $nadia] = caccInstance();

    $ownerPage = $this->signIn($arnaud, '/dashboard')
        ->assertPresent('[data-notifications-channel="subscribed"]');
    $nadiaPage = $this->signIn($nadia, '/dashboard')
        ->assertPresent('[data-notifications-channel="subscribed"]');

    $this->signIn($nadia, route('teams.show', [$team->workspace, $team], false))
        ->fill('[data-slot="access-request"] textarea', 'I pair with Théo on the checkout.')
        ->click('[data-slot="access-request"] button[type="submit"]')
        ->assertSeeIn('[data-slot="access-request-actions"]', 'Request sent');

    expect(TeamAccessRequest::query()->where('user_id', $nadia->id)->count())->toBe(1);

    $ownerPage->click('[aria-label="Notifications, 1 unread"]')
        ->assertSeeIn('[data-slot="notifications-panel"]', 'Nadia Haddad asks to join Atlas')
        ->click('[data-slot="notifications-panel"] button:has-text("Decline")')
        ->assertSeeIn('[data-slot="notifications-panel"]', 'Declined by you');

    expect($team->members()->whereKey($nadia->id)->exists())->toBeFalse();

    $nadiaPage->assertPresent('[aria-label="Notifications, 1 unread"]')
        ->click('[aria-label="Notifications, 1 unread"]')
        ->assertSeeIn('[data-slot="notifications-panel"]', 'Your request to join Atlas was declined')
        ->assertNoJavaScriptErrors();
});
