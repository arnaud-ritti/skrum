<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\InteractsWithIntegrations;

pest()->use(InteractsWithIntegrations::class);

beforeEach(function () {
    disableIntegrations();
});

function integrationsFoundationFakeTelegramBot(): void
{
    Http::fake([
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']]),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => true]),
    ]);
}

it('leads a workspace admin to the integrations from the Settings entry of the sidebar and shows only the configured providers', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    integrationsFoundationFakeTelegramBot();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    $slack = $this->integrationRow('slack');
    $settings = '[data-sidebar="content"] a[data-sidebar="menu-button"][aria-label="Settings"]';
    $integrationsEntry = 'nav[aria-label="Team settings"] a:has-text("Integrations")';

    $page = $this->signIn($admin, route('teams.show', [$team->workspace, $team], false));

    $page->assertDontSeeIn('[data-slot="team-header"]', 'Integrations')
        ->click($settings)
        ->assertPathIs(route('teams.settings.show', [$team->workspace, $team], false))
        ->click($integrationsEntry)
        ->assertPathIs(teamPath('teams.integrations.index', $team))
        ->assertAttribute($integrationsEntry, 'aria-current', 'page')
        ->assertSee('Connect Platform to the tools it already uses.')
        ->assertCount('[data-test^="integration-card-"]', 2)
        ->assertSeeIn("{$slack} h3", 'Slack')
        ->assertSeeIn($this->integrationRow('telegram').' h3', 'Telegram');

    $this->assertIntegrationStatus($page, 'slack', 'Not connected');
    $this->assertIntegrationStatus($page, 'telegram', 'Not connected');

    $this->openIntegration($page, 'slack')
        ->assertAttributeContains($this->integrationPanel('slack').' a:text-is("Connect")', 'href', '/integrations/slack/connect')
        ->assertNotPresent($this->integrationRow('jira'))
        ->assertNotPresent($this->integrationRow('linear'))
        ->assertNotPresent($this->integrationRow('msteams'))
        ->assertNotPresent($this->integrationRow('mattermost'))
        ->assertNotPresent($this->integrationRow('webhook'));
});

it('hides the Integrations link from a team member and refuses the page with 403', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create(['name' => 'Platform']);
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $member = teamMember($team);
    $member->forceFill(['name' => 'Bob Member', 'locale' => 'en'])->save();

    $page = $this->signIn($member, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Insights')
        ->assertNotPresent('a[href$="/integrations"]')
        ->assertNotPresent('[data-sidebar="content"] a[data-sidebar="menu-button"][aria-label="Settings"]');

    $page->navigate(teamPath('teams.integrations.index', $team))
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-test^="integration-card-"]');
});

it('has no Integrations link and no integrations page while no provider is configured', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');

    $page = $this->signIn($admin, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Insights')
        ->assertNotPresent('main a[href$="/integrations"]');

    $page->navigate(teamPath('teams.integrations.index', $team))
        ->assertPresent('[data-slot="error-page"][data-status="404"]')
        ->assertNotPresent('[data-test^="integration-card-"]');
});

it('sends "skrum is connected." to the connected Slack channel', function () {
    enableIntegrations(IntegrationProvider::Slack);
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    $integration = TeamIntegration::factory()->slack()->create([
        'team_id' => $team->id,
        'connected_by_user_id' => $admin->id,
    ]);
    $slack = $this->integrationPanel('slack');

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->assertIntegrationStatus($page, 'slack', 'Connected')
        ->assertSeeIn($this->integrationRow('slack'), 'Acme · #retros');

    $this->openIntegration($page, 'slack')
        ->assertSeeIn("{$slack} [data-slot=\"provider-details\"]", 'Acme')
        ->assertSeeIn("{$slack} [data-slot=\"provider-details\"]", '#retros')
        ->assertSeeIn($slack, 'Ada Admin')
        ->assertSeeIn($slack, 'Never')
        ->click("{$slack} button:has-text(\"Send a test message\")")
        ->assertSee('Test message sent.')
        ->assertDontSeeIn($slack, 'Never');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://hooks.slack.com/services/T000/B000/XXXX'
        && $request['text'] === 'skrum is connected.');
    Http::assertSentCount(1);

    expect($integration->fresh()->last_checked_at)->not->toBeNull();
});

it('shows the /connect command, switches to Connected once the bot receives it, and sends a test message', function () {
    enableIntegrations(IntegrationProvider::Telegram);
    $updates = [];
    Http::fake([
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']]),
        'api.telegram.org/*/getUpdates' => function () use (&$updates) {
            return Http::response(['ok' => true, 'result' => $updates]);
        },
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => true]),
    ]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    $telegram = $this->integrationPanel('telegram');

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->assertIntegrationStatus($page, 'telegram', 'Not connected');

    $this->openIntegration($page, 'telegram')
        ->click("{$telegram} button:has-text(\"Connect\")")
        ->assertVisible("{$telegram} code")
        ->assertSee('Open @skrum_test_bot in Telegram')
        ->assertSee('Waiting for the command…');

    $command = (string) $page->text("{$telegram} code");

    expect($command)->toMatch('/^\/connect@skrum_test_bot [A-HJ-NP-Z2-9]{8}$/');

    $updates = [[
        'update_id' => 1,
        'message' => [
            'message_id' => 1,
            'date' => 1_700_000_000,
            'chat' => ['id' => -100123, 'title' => 'Team chat', 'type' => 'supergroup'],
            'text' => $command,
        ],
    ]];

    $this->artisan('skrum:telegram-poll', ['--timeout' => 0])->assertSuccessful();

    $this->assertIntegrationStatus($page, 'telegram', 'Connected')
        ->assertSee('Telegram connected.')
        ->assertSeeIn("{$telegram} [data-slot=\"provider-details\"]", 'Team chat')
        ->assertSeeIn($telegram, 'Ada Admin')
        ->assertDontSee('Waiting for the command…')
        ->assertDontSeeIn($telegram, 'Never');

    $integration = TeamIntegration::query()->sole();
    $checkedWhenConnected = $integration->last_checked_at;

    $this->travel(5)->minutes();

    $page->click("{$telegram} button:has-text(\"Send a test message\")")
        ->assertSee('Test message sent.');

    expect($integration->provider)->toBe(IntegrationProvider::Telegram)
        ->and($integration->team_id)->toBe($team->id)
        ->and($integration->setting('chatId'))->toBe('-100123')
        ->and($checkedWhenConnected)->not->toBeNull()
        ->and($integration->fresh()->last_checked_at->gt($checkedWhenConnected))->toBeTrue();

    Http::assertSent(fn (Request $request): bool => str_ends_with($request->url(), '/sendMessage')
        && $request['chat_id'] === '-100123'
        && $request['text'] === 'skrum is connected.');
});

it('shows the Jira site and story points field, offers the upgrade, saves another field and detects again', function () {
    enableIntegrations(IntegrationProvider::Jira);
    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/field' => Http::response([
            ['id' => 'customfield_10028', 'name' => 'Story Points', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
            ['id' => 'customfield_10016', 'name' => 'Story point estimate', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.pyxis.greenhopper.jira:jsw-story-points']],
            ['id' => 'customfield_10050', 'name' => 'Business value', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ]),
    ]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    $integration = TeamIntegration::factory()->jira(IntegrationAccess::Read)->create([
        'team_id' => $team->id,
        'settings' => [
            'cloudId' => 'cloud-1',
            'siteUrl' => 'https://acme.atlassian.net',
            'siteName' => 'Acme',
            'storyPointFields' => [['id' => 'customfield_10016', 'name' => 'Story point estimate']],
            'numberFields' => [
                ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
                ['id' => 'customfield_10050', 'name' => 'Business value'],
            ],
        ],
    ]);
    $jira = $this->integrationPanel('jira');
    $field = "{$jira} [aria-label=\"Story points field\"]";

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->assertIntegrationStatus($page, 'jira', 'Connected');

    $this->openIntegration($page, 'jira')
        ->assertSeeIn("{$jira} [data-slot=\"provider-details\"]", 'Acme')
        ->assertSeeIn($jira, 'Read only')
        ->assertSeeIn($field, 'Story point estimate')
        ->assertAttributeContains("{$jira} a:has-text(\"Upgrade to read and write\")", 'href', '/integrations/jira/connect')
        ->assertAttributeContains("{$jira} a:has-text(\"Upgrade to read and write\")", 'href', 'access=write')
        ->click($field)
        ->click('[role="option"]:has-text("Business value")')
        ->assertSee('Story points field saved.')
        ->assertSeeIn($field, 'Business value');

    expect($integration->fresh()->setting('storyPointFields.0.id'))->toBe('customfield_10050');

    $page->click("{$jira} button:has-text(\"Detect again\")")
        ->assertSee('Fields detected again.')
        ->assertSeeIn($field, 'Business value')
        ->click($field)
        ->assertPresent('[role="option"]:has-text("Story Points")');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/field'
        && $request->hasHeader('Authorization', 'Bearer jira-access'));

    expect($integration->fresh()->setting('numberFields'))->toHaveCount(3)
        ->and($integration->fresh()->setting('storyPointFields.0.id'))->toBe('customfield_10050');
});

it('tests the Linear connection from its card', function () {
    enableIntegrations(IntegrationProvider::Linear);
    Http::fake(['api.linear.app/graphql' => Http::response(['data' => ['viewer' => ['id' => 'u1']]])]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    $integration = TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $team->id]);
    $linear = $this->integrationPanel('linear');

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->assertIntegrationStatus($page, 'linear', 'Connected');

    $this->openIntegration($page, 'linear')
        ->assertSeeIn("{$linear} [data-slot=\"provider-details\"]", 'Acme')
        ->assertSeeIn($linear, 'Read only')
        ->assertSeeIn($linear, 'Never')
        ->assertAttributeContains("{$linear} a:has-text(\"Upgrade to read and write\")", 'href', 'access=write')
        ->click("{$linear} button:has-text(\"Test the connection\")")
        ->assertSee('The connection works.')
        ->assertDontSeeIn($linear, 'Never');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.linear.app/graphql'
        && str_contains((string) $request['query'], 'viewer'));

    expect($integration->fresh()->last_checked_at)->not->toBeNull();
});

it('shows "Reconnect required" with the error after the daily check finds the Slack token revoked', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    Http::fake(['slack.com/api/auth.test' => Http::response(['ok' => false, 'error' => 'token_revoked'])]);
    integrationsFoundationFakeTelegramBot();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    $slackIntegration = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $telegramIntegration = TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);
    $slack = $this->integrationPanel('slack');

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->assertIntegrationStatus($page, 'slack', 'Connected');
    $this->assertIntegrationStatus($page, 'telegram', 'Connected');
    $this->openIntegration($page, 'slack')
        ->assertPresent("{$slack} button:has-text(\"Send a test message\")");

    $this->artisan('skrum:check-integrations')->assertSuccessful();

    $page->navigate(teamPath('teams.integrations.index', $team));

    $this->assertIntegrationStatus($page, 'slack', 'Reconnect required')
        ->assertSeeIn($this->integrationRow('slack').' [data-slot="provider-row-configure"]', 'Reconnect');
    $this->assertIntegrationStatus($page, 'telegram', 'Connected');

    $this->openIntegration($page, 'slack')
        ->assertSeeIn($slack, 'token_revoked')
        ->assertAttributeContains("{$slack} a:text-is(\"Reconnect\")", 'href', '/integrations/slack/connect')
        ->assertNotPresent("{$slack} button:has-text(\"Send a test message\")");

    expect($slackIntegration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($slackIntegration->fresh()->last_error)->toBe('token_revoked')
        ->and($telegramIntegration->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($telegramIntegration->fresh()->last_checked_at)->not->toBeNull();

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://slack.com/api/auth.test'
        && $request->hasHeader('Authorization', 'Bearer xoxp-test-token'));
});

it('disconnects every provider, revokes the Slack and Linear access and makes the bot leave the Telegram chat', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram, IntegrationProvider::Jira, IntegrationProvider::Linear);
    Http::fake([
        'slack.com/api/auth.revoke' => Http::response(['ok' => true]),
        'api.linear.app/oauth/revoke' => Http::response('', 200),
    ]);
    integrationsFoundationFakeTelegramBot();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->jira(IntegrationAccess::Read)->create(['team_id' => $team->id]);
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $team->id]);

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $page->assertCount('[data-test^="integration-card-"]', 4);

    foreach (['slack' => 'Slack', 'telegram' => 'Telegram', 'jira' => 'Jira', 'linear' => 'Linear'] as $provider => $label) {
        $this->assertIntegrationStatus($page, $provider, 'Connected');
        $this->disconnectIntegration($page, $provider, $label);
        $this->assertIntegrationStatus($page, $provider, 'Not connected');
    }

    expect(TeamIntegration::query()->count())->toBe(0);

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://slack.com/api/auth.revoke');
    Http::assertSent(fn (Request $request): bool => str_ends_with($request->url(), '/leaveChat') && $request['chat_id'] === '-100123');
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.linear.app/oauth/revoke');
});

/**
 * @return array{0: Team, 1: User}
 */
function integrationsFoundationConnectedTeam(): array
{
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Jira, IntegrationProvider::Linear);
    $team = Team::factory()->create(['name' => 'Atlas']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id, 'connected_by_user_id' => $admin->id]);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id, 'connected_by_user_id' => $admin->id]);

    return [$team, $admin];
}

it('lists the integrations at phone width without overflow and opens a provider in its sheet', function () {
    [$team, $admin] = integrationsFoundationConnectedTeam();

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team))->resize(390, 844);

    $page->assertSee('Connect Atlas to the tools it already uses.')
        ->assertCount('[data-test^="integration-card-"]', 3)
        ->assertVisible($this->integrationRow('linear').' [data-slot="provider-row-configure"]')
        ->assertVisible($this->integrationRow('linear').' [role="switch"]');

    $this->assertIntegrationStatus($page, 'slack', 'Connected');
    $this->assertIntegrationStatus($page, 'linear', 'Not connected');

    expect($this->overflowingElements($page))->toBe([]);

    $this->openIntegration($page, 'slack')
        ->assertSeeIn($this->integrationPanel('slack').' [data-slot="provider-details"]', '#retros')
        ->script('() => Promise.allSettled(document.getAnimations().map((animation) => animation.finished))');

    expect($this->overflowingElements($page))->toBe([]);

    $page->assertNoJavaScriptErrors();
});

it('draws the integrations in the dark theme without overflow, and light again in the light theme', function () {
    [$team, $admin] = integrationsFoundationConnectedTeam();
    $listLightness = '() => { const background = getComputedStyle(document.querySelector(\'[data-test="integration-list"]\')).backgroundColor; const oklch = background.match(/oklch\\(([\\d.]+)/); if (oklch) { return parseFloat(oklch[1]); } const [r, g, b] = background.match(/[\\d.]+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }';

    $page = $this->signIn($admin, '/settings/appearance');

    $page->click('[role="radio"]:has-text("Dark")')
        ->assertScript('document.documentElement.classList.contains("dark")', true)
        ->navigate(teamPath('teams.integrations.index', $team))
        ->resize(1440, 900)
        ->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertPresent('[data-test="integration-list"]');

    $darkLightness = (float) $page->script($listLightness);
    $darkOverflow = $this->overflowingElements($page);

    $page->navigate('/settings/appearance')
        ->click('[role="radio"]:has-text("Light")')
        ->assertScript('document.documentElement.classList.contains("dark")', false)
        ->navigate(teamPath('teams.integrations.index', $team))
        ->assertPresent('[data-test="integration-list"]');

    $lightLightness = (float) $page->script($listLightness);
    $lightOverflow = $this->overflowingElements($page);

    expect($darkLightness)->toBeLessThan(0.3)
        ->and($lightLightness)->toBeGreaterThan(0.7)
        ->and($darkOverflow)->toBe([])
        ->and($lightOverflow)->toBe([]);

    $page->assertNoJavaScriptErrors();
});

it('speaks the language of the admin on the integrations, English and informal French', function () {
    [$team, $admin] = integrationsFoundationConnectedTeam();
    $claire = integrationAdmin($team);
    $claire->forceFill(['name' => 'Claire Dupont', 'locale' => 'fr'])->save();
    $path = teamPath('teams.integrations.index', $team);

    $page = $this->signIn($admin, $path)->resize(1440, 900);

    $page->assertScript('document.documentElement.lang', 'en')
        ->assertSeeIn('[data-slot="team-integrations"] h2', 'Integrations')
        ->assertSee('Connect Atlas to the tools it already uses.')
        ->assertSeeIn($this->integrationRow('slack').' [data-slot="provider-row-configure"]', 'Configure')
        ->assertSeeIn($this->integrationRow('linear').' [data-slot="provider-row-configure"]', 'Connect');

    $this->assertIntegrationStatus($page, 'jira', 'Connected');
    $this->assertIntegrationStatus($page, 'linear', 'Not connected');

    $page = $this->signIn($claire, $path)->resize(1440, 900);

    $page->assertScript('document.documentElement.lang', 'fr')
        ->assertSeeIn('[data-slot="team-integrations"] h2', 'Intégrations')
        ->assertSee('Connecte Atlas aux outils qu\'elle utilise déjà.')
        ->assertSeeIn($this->integrationRow('slack').' [data-slot="provider-row-configure"]', 'Configurer')
        ->assertSeeIn($this->integrationRow('linear').' [data-slot="provider-row-configure"]', 'Connecter');

    $this->assertIntegrationStatus($page, 'jira', 'Connecté');
    $this->assertIntegrationStatus($page, 'linear', 'Non connecté');

    $page->assertNoJavaScriptErrors();
});
