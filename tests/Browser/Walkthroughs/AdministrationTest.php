<?php

use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Enums\McpScope;
use App\Models\AuditEvent;
use App\Models\PersonalAccessToken;
use App\Models\TeamAccessRequest;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function () {
    RateLimiter::for('login', fn (): Limit => Limit::none());
    RateLimiter::for('passwordConfirmations', fn (): Limit => Limit::none());
    config(['skrum.version' => '1.8.2', 'skrum.mcp.enabled' => true]);
});

it('answers 403 to a member who is not an instance admin, and asks an admin to confirm the password first', function () {
    ['admin' => $admin, 'theo' => $theo] = adminInstance();

    $this->signIn($theo, '/admin/general')
        ->assertSeeIn('[data-slot="error-page"][data-status="403"]', 'Access denied')
        ->assertNotPresent('[data-slot="admin-shell"]');

    $this->signIn($admin, '/admin')
        ->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/admin/general')
        ->assertPresent('[data-slot="admin-shell"]')
        ->assertNoJavaScriptErrors();
});

it('lists the sections under Instance and Supervision in their order, opens each, and names the newer version in the footer', function () {
    ['admin' => $admin] = adminInstance();
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => '1.9.0',
        InstanceSettingKey::UpdateCheckedAt->value => now()->subHour()->toIso8601String(),
    ]);

    $page = passwordConfirmedPage($this->signIn($admin, '/admin/general'), '/admin/general');
    $nav = '[data-slot="admin-shell"] nav[aria-label="Administration"]';

    $page->assertScript(
        "[...document.querySelectorAll('{$nav} a')].map((link) => link.textContent.trim())",
        ['General', 'Branding', 'SSO authentication', 'SMTP', 'Integrations', 'MCP keys', 'Licence', 'Users', 'Admins', 'Audit log'],
    )
        ->assertScript("[...document.querySelectorAll('{$nav} [role=\"group\"] > p')].map((label) => label.textContent.trim())", ['Instance', 'Supervision'])
        ->assertSeeIn('[data-slot="admin-version"]', 'v1.8.2')
        ->assertSeeIn('[data-slot="admin-version-state"]', 'update available: v1.9.0');

    foreach (['Branding' => '/admin/branding', 'SSO authentication' => '/admin/sign-in', 'SMTP' => '/admin/mail', 'Integrations' => '/admin/integrations', 'MCP keys' => '/admin/mcp-keys', 'Licence' => '/admin/licence', 'Users' => '/admin/users', 'Admins' => '/admin/admins', 'Audit log' => '/admin/audit-log', 'General' => '/admin/general'] as $label => $path) {
        $page->click("{$nav} a:has-text(\"{$label}\")")
            ->assertPathIs($path)
            ->assertCount("{$nav} a[aria-current=\"page\"]", 1)
            ->assertSeeIn("{$nav} a[aria-current=\"page\"]", $label);
    }

    $page->assertNoJavaScriptErrors();
});

it('saves the sign-up mode with its domains, and the sign-up page then refuses another domain', function () {
    ['admin' => $admin] = adminInstance();

    $page = passwordConfirmedPage($this->signIn($admin, '/admin/general'), '/admin/general');

    $page->click('[role="radiogroup"][aria-label="Sign-up"] [data-slot="radio-option"]:has-text("Allowed domains") [role="radio"]')
        ->fill('[data-slot="general-settings-form"] input[placeholder="example.com"]', 'Nordlys.example')
        ->keys('[data-slot="general-settings-form"] input[placeholder="example.com"]', 'Enter')
        ->assertSeeIn('[data-slot="domain-chips"]', 'nordlys.example');

    saveUnsavedBar($page)->assertSee('General settings saved.');

    $settings = resolve(InstanceSettings::class);
    $settings->refresh();

    expect($settings->signupMode())->toBe('domain')
        ->and($settings->allowedEmailDomains())->toBe(['nordlys.example']);

    $page->navigate('/admin/general')
        ->assertAttribute('[role="radiogroup"][aria-label="Sign-up"] [data-slot="radio-option"]:has-text("Allowed domains") [role="radio"]', 'aria-checked', 'true')
        ->assertSeeIn('[data-slot="domain-chips"]', 'nordlys.example')
        ->assertNoJavaScriptErrors();
});

it('saves an SMTP server whose password stays masked, and says in a sentence why its test e-mail failed', function () {
    ['admin' => $admin] = adminInstance();
    $card = '[data-slot="mail-settings-card"]';

    $page = passwordConfirmedPage($this->signIn($admin, '/admin/mail'), '/admin/mail');

    $page->click("{$card} [data-slot=\"radio-option\"]:has-text(\"Send through SMTP\") [role=\"radio\"]")
        ->fill("{$card} input[name=\"host\"]", '127.0.0.1')
        ->fill("{$card} input[name=\"port\"]", '8209')
        ->fill("{$card} [data-slot=\"secret-field\"] input", 'smtp-secret-2026')
        ->assertAttribute("{$card} [data-slot=\"secret-field\"] input", 'type', 'password')
        ->click("{$card} [data-slot=\"secret-field\"] button[aria-label=\"Show what you typed\"]")
        ->assertAttribute("{$card} [data-slot=\"secret-field\"] input", 'type', 'text');

    saveUnsavedBar($page)
        ->assertPresent("{$card} input[name=\"host\"][value=\"127.0.0.1\"]")
        ->assertValue("{$card} [data-slot=\"secret-field\"] input", '')
        ->assertScript("document.documentElement.innerHTML.includes('smtp-secret-2026')", false);

    expect(AuditEvent::query()->where('action', AuditAction::ConfigurationUpdated)->count())->toBe(1);

    $page->fill('[data-slot="mail-test-form"] input', 'arnaud@nordlys.example')
        ->click('[data-slot="mail-test-form"] button:has-text("Send")')
        ->assertPresent('[data-slot="mail-test-result"]')
        ->assertSeeIn('[data-slot="mail-test-result"]', 'Last test failed')
        ->assertNoJavaScriptErrors();
});

it('turns a configured integration off for every team after a confirmation, keeps its connections, and turns it back on', function () {
    ['admin' => $admin, 'team' => $team] = adminInstance();
    $connection = TeamIntegration::factory()->slack()->create(['team_id' => $team->id, 'connected_by_user_id' => $admin->id]);
    withEnvironmentConfiguration([
        'services.slack.client_id' => 'atlas-slack',
        'services.slack.client_secret' => 'environment-slack-secret',
    ]);
    $slack = '[data-slot="integration-row"]:has-text("Slack")';

    $page = passwordConfirmedPage($this->signIn($admin, '/admin/integrations'), '/admin/integrations');

    $page->assertAttribute("{$slack} [role=\"switch\"]", 'aria-checked', 'true')
        ->assertSeeIn($slack, 'Available · 1 team connected')
        ->assertDisabled('[data-slot="integration-row"]:has(span:text-is("Jira")) [role="switch"]')
        ->click("{$slack} [role=\"switch\"]")
        ->assertSeeIn('[role="alertdialog"]', 'Turn Slack off?')
        ->click('[role="alertdialog"] button:has-text("Turn off")')
        ->assertSee('Integration settings saved.')
        ->assertAttribute("{$slack} [role=\"switch\"]", 'aria-checked', 'false')
        ->assertSeeIn($slack, 'Turned off');

    $settings = resolve(InstanceSettings::class);
    $settings->refresh();

    expect($settings->disabledIntegrations())->toContain('slack')
        ->and($connection->fresh())->not->toBeNull();

    $page->click("{$slack} [role=\"switch\"]")
        ->assertSee('Integration settings saved.')
        ->assertAttribute("{$slack} [role=\"switch\"]", 'aria-checked', 'true')
        ->assertNoJavaScriptErrors();
});

it('lists the MCP keys of every user and revokes one, which stops authenticating', function () {
    ['admin' => $admin, 'theo' => $theo] = adminInstance();
    $theoToken = issueTestMcpToken($theo, [McpScope::Read, McpScope::Write]);
    issueTestMcpToken($admin);
    PersonalAccessToken::query()->where('tokenable_id', $theo->id)->update(['name' => 'CI weekly report']);

    $page = passwordConfirmedPage($this->signIn($admin, '/admin/mcp-keys'), '/admin/mcp-keys');
    $rows = '[data-slot="mcp-keys-table"] tbody tr';

    $page->assertCount($rows, 2)
        ->assertSeeIn("{$rows}:has-text(\"CI weekly report\")", 'mcp:write')
        ->click("{$rows}:has-text(\"CI weekly report\") button[aria-label^=\"Revoke\"]")
        ->assertSeeIn('[role="alertdialog"]', 'Agents using it stop at once.')
        ->click('[role="alertdialog"] button:has-text("Revoke")')
        ->assertSee('Token revoked.')
        ->assertCount($rows, 1)
        ->assertNotPresent("{$rows}:has-text(\"CI weekly report\")")
        ->assertNoJavaScriptErrors();

    postMcp($theoToken)->assertUnauthorized();

    expect(AuditEvent::query()->where('action', AuditAction::TokenRevokedByAdmin)->sole()->properties['owner'])->toBe($theo->id);
});

it('deactivates an account, which is signed out at its next page and refused at the login, then reactivates it', function () {
    ['admin' => $admin, 'theo' => $theo] = adminInstance();
    $theoRow = '[data-slot="users-table"] [data-slot="user-row"]:has-text("Théo Martin")';

    $theoPage = $this->signIn($theo, '/dashboard');
    $page = passwordConfirmedPage($this->signIn($admin, '/admin/users'), '/admin/users');

    $page->assertCount('[data-slot="users-table"] [data-slot="user-row"]', 3)
        ->fill('input[type="search"]', 'theo@')
        ->assertCount('[data-slot="users-table"] [data-slot="user-row"]', 1)
        ->click("{$theoRow} [aria-label=\"Actions for Théo Martin\"]")
        ->click('[role="menuitem"]:has-text("Deactivate")')
        ->assertSeeIn('[role="alertdialog"]', 'Deactivate Théo Martin?')
        ->click('[role="alertdialog"] button:has-text("Deactivate")')
        ->assertSee('Account deactivated.')
        ->assertSeeIn("{$theoRow} [data-slot=\"user-badges\"]", 'Deactivated');

    $theoPage->navigate('/dashboard')
        ->assertPathIs('/login');

    visit('/login')
        ->fill('#email', $theo->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertSee('This account is deactivated. Ask an admin of the instance.')
        ->assertPathIs('/login');

    $page->click('[aria-label="Filter accounts"] :is(button, [role="radio"]):has-text("Deactivated")')
        ->assertCount('[data-slot="users-table"] [data-slot="user-row"]', 1)
        ->click("{$theoRow} [aria-label=\"Actions for Théo Martin\"]")
        ->click('[role="menuitem"]:has-text("Reactivate")')
        ->assertSee('Account reactivated.')
        ->navigate('/admin/audit-log')
        ->assertCount('[data-slot="audit-table"] [data-slot="audit-row"]:has-text("deactivated Théo Martin")', 1)
        ->assertCount('[data-slot="audit-table"] [data-slot="audit-row"]:has-text("reactivated Théo Martin")', 1)
        ->assertNoJavaScriptErrors();

    expect($theo->refresh()->deactivated_at)->toBeNull();

    $this->signIn($theo, '/dashboard')->assertPathIsNot('/login');
});

it('a member asks to join a team from its 403 page, the owner adds them from the bell and the member is told, live on both sides', function () {
    ['team' => $team, 'admin' => $arnaud, 'nadia' => $nadia] = adminInstance();

    $ownerPage = awaitBellSubscription($this->signIn($arnaud, '/dashboard'));
    $nadiaBell = awaitBellSubscription($this->signIn($nadia, '/dashboard'));
    $nadiaPage = $this->signIn($nadia, teamPath('teams.show', $team));

    $nadiaPage->assertPresent('[data-slot="error-page"][data-status="403"] [data-slot="access-request"]')
        ->assertSee("You don't have access to this team")
        ->assertSee('Team admins: Arnaud Ritti')
        ->fill('[data-slot="access-request"] input[name="message"]', 'I pair with Théo on the checkout.')
        ->click('[data-slot="access-request"] button[type="submit"]')
        ->assertSeeIn('[data-slot="access-request-actions"]', 'Request sent');

    expect(TeamAccessRequest::query()->where('user_id', $nadia->id)->count())->toBe(1);

    $ownerPage->assertPresent('[aria-label="Notifications, 1 unread"]')
        ->click('[aria-label="Notifications, 1 unread"]')
        ->assertSeeIn('[data-slot="notifications-panel"]', 'Nadia Haddad asks to join Atlas')
        ->assertSeeIn('[data-slot="notifications-panel"]', 'I pair with Théo on the checkout.')
        ->click('[data-slot="notifications-panel"] button:has-text("Add to the team")')
        ->assertSeeIn('[data-slot="notifications-panel"]', 'Added by you');

    expect($team->members()->whereKey($nadia->id)->exists())->toBeTrue();

    $nadiaBell->assertPresent('[aria-label="Notifications, 1 unread"]')
        ->click('[aria-label="Notifications, 1 unread"]')
        ->assertSeeIn('[data-slot="notifications-panel"]', 'You were added to Atlas');

    $nadiaPage->navigate(teamPath('teams.show', $team))
        ->assertNotPresent('[data-slot="error-page"]')
        ->assertSeeIn('[data-slot="sidebar"]', 'Atlas')
        ->assertNoJavaScriptErrors();
});

it('keeps the request sent after a reload, and shows a plain 403 without any team or person to someone outside the workspace', function () {
    ['team' => $team, 'nadia' => $nadia] = adminInstance();
    $outsider = User::factory()->create(['name' => 'Olga Outsider', 'locale' => 'en']);

    TeamAccessRequest::factory()->for($team)->pending()->create(['user_id' => $nadia->id]);

    $this->signIn($nadia, teamPath('teams.show', $team))
        ->assertSeeIn('[data-slot="access-request-actions"]', 'Request sent')
        ->assertNotPresent('[data-slot="access-request"] input[name="message"]');

    $this->signIn($outsider, teamPath('teams.show', $team))
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-slot="access-request"]')
        ->assertDontSee('Atlas')
        ->assertDontSee('Arnaud Ritti')
        ->assertNoJavaScriptErrors();
});

it('shows the version on an error page to a signed-in member only, and links every error page to the status page', function () {
    ['theo' => $theo] = adminInstance();

    visit('/no-such-page')
        ->assertPresent('[data-slot="error-page"][data-status="404"]')
        ->assertNotPresent('[data-slot="error-page-version"]')
        ->click('Instance status')
        ->assertPathIs('/status')
        ->assertPresent('[data-slot="status-page"] [data-slot="status-component"]');

    $this->signIn($theo, '/no-such-page')
        ->assertSeeIn('[data-slot="error-page-version"]', 'v1.8.2')
        ->assertPresent('a[href$="/status"]')
        ->assertNoJavaScriptErrors();
});

it('shows the time of return on the maintenance page, and the status page in maintenance', function () {
    adminInstance();
    config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'array']);

    $this->artisan('down', ['--retry' => 1800])->assertSuccessful();

    try {
        visit('/')
            ->assertPresent('[data-slot="maintenance-page"]')
            ->assertPresent('[data-slot="maintenance-back-at"] time')
            ->assertPresent('a[href$="/status"]');

        visit('/status')
            ->assertPresent('[data-slot="status-page"]')
            ->assertSeeIn('[data-slot="status-overall"]', 'Maintenance in progress');
    } finally {
        $this->artisan('up');
    }
});

it('names the AGPL-3.0-or-later licence with the accounts in use and links to its text and to the source', function () {
    ['admin' => $admin] = adminInstance();

    passwordConfirmedPage($this->signIn($admin, '/admin/licence'), '/admin/licence')
        ->assertSeeIn('[data-slot="licence-badge"]', 'AGPL-3.0-or-later')
        ->assertSeeIn('[data-slot="licence-accounts"]', '3')
        ->assertSee('No limit, no expiry.')
        ->assertPresent('a:has-text("Licence text")')
        ->assertPresent('a:has-text("Source code")')
        ->assertNoJavaScriptErrors();
});

it('fits the administration at phone width, a section picker in place of the side navigation', function () {
    ['admin' => $admin] = adminInstance();

    $page = $this->signIn($admin, '/admin/users');
    $page->resize(390, 844);

    passwordConfirmedPage($page, '/admin/users')
        ->assertScript('document.documentElement.scrollWidth > window.innerWidth', false)
        ->assertMissing('[data-slot="admin-shell"] nav[aria-label="Administration"]')
        ->assertVisible('[data-slot="admin-shell"] [role="combobox"]')
        ->assertVisible('[data-slot="users-cards"]')
        ->navigate('/admin/general')
        ->assertScript('document.documentElement.scrollWidth > window.innerWidth', false)
        ->assertNoJavaScriptErrors();
});

it('draws the administration on a dark background when the system asks for it', function () {
    ['admin' => $admin] = adminInstance();

    passwordConfirmedPage($this->signIn($admin, '/admin/general', ['colorScheme' => 'dark']), '/admin/general')
        ->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertScript('getComputedStyle(document.body).backgroundColor', 'oklch(0.165 0.008 55)')
        ->assertPresent('[data-slot="general-settings-form"]')
        ->assertNoJavaScriptErrors();
});

it('reads the administration in English for an English admin of a French instance', function () {
    config(['app.locale' => 'fr']);
    ['admin' => $admin] = adminInstance();

    passwordConfirmedPage($this->signIn($admin, '/admin/general'), '/admin/general')
        ->assertScript('document.documentElement.lang', 'en')
        ->assertSeeIn('[data-slot="admin-shell"] nav[aria-label="Administration"]', 'General')
        ->assertSeeIn('[data-slot="admin-shell"] nav[aria-label="Administration"]', 'Audit log')
        ->assertSee('Who can create an account on this instance.')
        ->assertDontSee('Journal')
        ->assertNoJavaScriptErrors();
});
