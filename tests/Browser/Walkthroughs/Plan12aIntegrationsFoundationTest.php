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

uses(InteractsWithIntegrations::class);

beforeEach(function () {
    disableIntegrations();
});

function p12aAdmin(Team $team, string $name = 'Ada Admin'): User
{
    $admin = integrationAdmin($team);

    $admin->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $admin;
}

function p12aIntegrationsPath(Team $team): string
{
    return route('teams.integrations.index', [$team->workspace, $team], false);
}

function p12aCard(string $provider): string
{
    return "[data-test=\"integration-card-{$provider}\"]";
}

function p12aPanel(string $provider): string
{
    return "[data-test=\"integration-panel-{$provider}\"]";
}

function p12aFakeTelegramBot(): void
{
    Http::fake([
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']]),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => true]),
    ]);
}

it('[P12a-01a] leads a workspace admin to the integrations from the gear of the team header and shows only the configured providers', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    p12aFakeTelegramBot();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    $slack = p12aCard('slack');
    $gear = '[data-slot="team-header"] a[aria-label="Team settings"]';
    $integrationsEntry = 'nav[aria-label="Team settings"] a:has-text("Integrations")';

    $page = $this->signIn($admin, route('teams.show', [$team->workspace, $team], false));

    $page->assertDontSeeIn('[data-slot="team-header"]', 'Integrations')
        ->click($gear)
        ->assertPathIs(route('teams.settings.show', [$team->workspace, $team], false))
        ->click($integrationsEntry)
        ->assertPathIs(p12aIntegrationsPath($team))
        ->assertAttribute($integrationsEntry, 'aria-current', 'page')
        ->assertSee('Connect Platform to the tools it already uses.')
        ->assertCount('[data-test^="integration-card-"]', 2)
        ->assertSeeIn("{$slack} h3", 'Slack')
        ->assertSeeIn(p12aCard('telegram').' h3', 'Telegram');

    $this->assertIntegrationStatus($page, 'slack', 'Not connected');
    $this->assertIntegrationStatus($page, 'telegram', 'Not connected');

    $this->openIntegration($page, 'slack')
        ->assertAttributeContains(p12aPanel('slack').' a:text-is("Connect")', 'href', '/integrations/slack/connect')
        ->assertNotPresent(p12aCard('jira'))
        ->assertNotPresent(p12aCard('linear'))
        ->assertNotPresent(p12aCard('msteams'))
        ->assertNotPresent(p12aCard('mattermost'))
        ->assertNotPresent(p12aCard('webhook'));
});

it('[P12a-01b] hides the Integrations link from a team member and refuses the page with 403', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create(['name' => 'Platform']);
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $member = teamMember($team);
    $member->forceFill(['name' => 'Bob Member', 'locale' => 'en'])->save();

    $page = $this->signIn($member, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Games')
        ->assertNotPresent('main a[href$="/integrations"]');

    $page->navigate(p12aIntegrationsPath($team))
        ->assertSee('403')
        ->assertNotPresent('[data-test^="integration-card-"]');
});

it('[P12a-01c] has no Integrations link and no integrations page while no provider is configured', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);

    $page = $this->signIn($admin, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Games')
        ->assertNotPresent('main a[href$="/integrations"]');

    $page->navigate(p12aIntegrationsPath($team))
        ->assertSee('404')
        ->assertNotPresent('[data-test^="integration-card-"]');
});

it('[P12a-02a] sends "skrum is connected." to the connected Slack channel', function () {
    enableIntegrations(IntegrationProvider::Slack);
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    $integration = TeamIntegration::factory()->slack()->create([
        'team_id' => $team->id,
        'connected_by_user_id' => $admin->id,
    ]);
    $slack = p12aPanel('slack');

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

    $this->assertIntegrationStatus($page, 'slack', 'Connected')
        ->assertSeeIn(p12aCard('slack'), 'Acme · #retros');

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

it('[P12a-03a] shows the /connect command, switches to Connected once the bot receives it, and sends a test message', function () {
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
    $admin = p12aAdmin($team);
    $telegram = p12aPanel('telegram');

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

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

it('[P12a-04a] shows the Jira site and story points field, offers the upgrade, saves another field and detects again', function () {
    enableIntegrations(IntegrationProvider::Jira);
    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/field' => Http::response([
            ['id' => 'customfield_10028', 'name' => 'Story Points', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
            ['id' => 'customfield_10016', 'name' => 'Story point estimate', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.pyxis.greenhopper.jira:jsw-story-points']],
            ['id' => 'customfield_10050', 'name' => 'Business value', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ]),
    ]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
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
    $jira = p12aPanel('jira');
    $field = "{$jira} [aria-label=\"Story points field\"]";

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

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

it('[P12a-05a] tests the Linear connection from its card', function () {
    enableIntegrations(IntegrationProvider::Linear);
    Http::fake(['api.linear.app/graphql' => Http::response(['data' => ['viewer' => ['id' => 'u1']]])]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    $integration = TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $team->id]);
    $linear = p12aPanel('linear');

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

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

it('[P12a-06a] shows "Reconnect required" with the error after the daily check finds the Slack token revoked', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    Http::fake(['slack.com/api/auth.test' => Http::response(['ok' => false, 'error' => 'token_revoked'])]);
    p12aFakeTelegramBot();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    $slackIntegration = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $telegramIntegration = TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);
    $slack = p12aPanel('slack');

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

    $this->assertIntegrationStatus($page, 'slack', 'Connected');
    $this->assertIntegrationStatus($page, 'telegram', 'Connected');
    $this->openIntegration($page, 'slack')
        ->assertPresent("{$slack} button:has-text(\"Send a test message\")");

    $this->artisan('skrum:check-integrations')->assertSuccessful();

    $page->navigate(p12aIntegrationsPath($team));

    $this->assertIntegrationStatus($page, 'slack', 'Reconnect required')
        ->assertSeeIn(p12aCard('slack').' [data-slot="provider-row-configure"]', 'Reconnect');
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

it('[P12a-07a] disconnects every provider, revokes the Slack and Linear access and makes the bot leave the Telegram chat', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram, IntegrationProvider::Jira, IntegrationProvider::Linear);
    Http::fake([
        'slack.com/api/auth.revoke' => Http::response(['ok' => true]),
        'api.linear.app/oauth/revoke' => Http::response('', 200),
    ]);
    p12aFakeTelegramBot();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->jira(IntegrationAccess::Read)->create(['team_id' => $team->id]);
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $team->id]);

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

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
