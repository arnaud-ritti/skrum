<?php

use App\Enums\InstanceSettingKey;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\InstanceSettings;
use App\Support\Integrations\OAuthState;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\InteractsWithIntegrations;

pest()->use(InteractsWithIntegrations::class);

beforeEach(function () {
    disableIntegrations();
    Http::preventStrayRequests();
});

/**
 * The OAuth state the connect route stored in the browser's session, read from the session table.
 */
function cviStoredOAuthState(): string
{
    $states = DB::table('sessions')->pluck('payload')
        ->map(fn (string $payload): mixed => data_get(json_decode(base64_decode($payload), true), OAuthState::SessionKey.'.state'))
        ->filter();

    expect($states)->toHaveCount(1);

    return (string) $states->first();
}

function cviConnectInPage(mixed $page, Team $team): void
{
    $connectPath = json_encode(route('teams.integrations.connect', [$team->workspace, $team, 'slack'], false), JSON_THROW_ON_ERROR);

    $page->script("() => fetch({$connectPath}, { redirect: 'manual', credentials: 'same-origin' }).then(() => true)");
}

it('sends a visitor who is not signed in from the team integrations page to the login page', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create(['name' => 'Platform']);

    visit(teamPath('teams.integrations.index', $team))->assertPathIs('/login');
});

it('refuses the team integrations page with 403 to a team role that does not own the team and to an admin of another workspace', function (Closure $refused) {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create(['name' => 'Platform']);
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);

    $page = $this->signIn(renamedUser($refused($team), 'Rita Refused'), teamPath('teams.integrations.index', $team));

    $page->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-test^="integration-card-"]')
        ->assertNoJavaScriptErrors();
})->with([
    'facilitator' => [fn (Team $team): User => teamMember($team, TeamRole::Facilitator)],
    'observer' => [fn (Team $team): User => teamMember($team, TeamRole::Observer)],
    'admin of another workspace' => [fn (Team $team): User => integrationAdmin(Team::factory()->create(['name' => 'Elsewhere']))],
]);

it('lets a team owner who is not a workspace manager reach the integrations from the team settings', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create(['name' => 'Platform']);
    $owner = renamedUser(teamMember($team, TeamRole::Owner), 'Oscar Owner');
    $integrationsEntry = 'nav[aria-label="Team settings"] a:has-text("Integrations")';

    $page = $this->signIn($owner, route('teams.settings.show', [$team->workspace, $team], false));

    $page->click($integrationsEntry)
        ->assertPathIs(teamPath('teams.integrations.index', $team))
        ->assertAttribute($integrationsEntry, 'aria-current', 'page')
        ->assertSee('Connect Platform to the tools it already uses.')
        ->assertPresent($this->integrationRow('slack'))
        ->assertNoJavaScriptErrors();

    $this->assertIntegrationStatus($page, 'slack', 'Not connected');
});

it('hides a provider the instance admin turned off from the team integrations and shows it again with its connection once turned back on', function () {
    withEnvironmentConfiguration([
        'services.slack.client_id' => 'atlas-slack',
        'services.slack.client_secret' => 'environment-slack-secret',
        'services.telegram.bot_token' => '123456:telegram-token',
    ]);
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']])]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id, 'connected_by_user_id' => $admin->id]);
    $settings = resolve(InstanceSettings::class);

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->assertIntegrationStatus($page, 'slack', 'Connected');

    $settings->set(InstanceSettingKey::DisabledIntegrations->value, ['slack']);

    $page->navigate(teamPath('teams.integrations.index', $team))
        ->assertPresent($this->integrationRow('telegram'))
        ->assertNotPresent($this->integrationRow('slack'));

    expect(TeamIntegration::query()->where('team_id', $team->id)->where('provider', IntegrationProvider::Slack)->exists())->toBeTrue();

    $settings->set(InstanceSettingKey::DisabledIntegrations->value, []);

    $page->navigate(teamPath('teams.integrations.index', $team))
        ->assertPresent($this->integrationRow('slack'))
        ->assertNoJavaScriptErrors();

    $this->assertIntegrationStatus($page, 'slack', 'Connected');
});

it('connects Slack through its OAuth callback, back on the integrations page, and refuses a callback whose state does not match', function () {
    config(['session.driver' => 'database', 'session.lottery' => [0, 100]]);
    enableIntegrations(IntegrationProvider::Slack);
    Http::fake(['slack.com/api/oauth.v2.access' => Http::response([
        'ok' => true,
        'access_token' => 'xoxp-new-token',
        'scope' => 'incoming-webhook',
        'team' => ['id' => 'T111', 'name' => 'Acme'],
        'incoming_webhook' => [
            'channel' => '#retros',
            'channel_id' => 'C222',
            'configuration_url' => 'https://acme.slack.com/services/B222',
            'url' => 'https://hooks.slack.com/services/T111/B222/secret',
        ],
    ])]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    cviConnectInPage($page, $team);

    $page->navigate('/integrations/slack/callback?code=the-code&state=not-the-state-0123456789abcdefghijklmn')
        ->assertPathIs(teamPath('teams.integrations.index', $team))
        ->assertSee('Could not connect Slack. Try again.');

    $this->assertIntegrationStatus($page, 'slack', 'Not connected');

    cviConnectInPage($page, $team);
    $state = cviStoredOAuthState();

    $page->navigate("/integrations/slack/callback?code=the-code&state={$state}")
        ->assertPathIs(teamPath('teams.integrations.index', $team))
        ->assertSee('Slack connected.')
        ->assertNoJavaScriptErrors();

    $this->assertIntegrationStatus($page, 'slack', 'Connected');

    expect($team->integration(IntegrationProvider::Slack)?->status)->toBe(IntegrationStatus::Active);
});

it('saves a start status for a Jira project first in the status mapping, and resets it to Automatic', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 12']);
    $admin = renamedUser(integrationAdmin($retro->team), 'Ada Admin');
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $integration->forceFill([
        'settings' => [...$integration->settings, 'statusSync' => true, 'statusSyncSince' => now()->toIso8601String()],
        'inbound_mode' => IntegrationInboundMode::Polling,
        'last_polled_at' => now(),
        'poll_cursor' => now(),
    ])->save();
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'content' => 'Speed up CI']);
    ActionItemExternalLink::factory()->create([
        'action_item_id' => $item->id,
        'source' => IntegrationProvider::Jira,
        'external_site' => 'cloud-1',
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
    ]);
    Http::fake([
        jiraApiUrl('rest/api/3/project/PROJ/statuses') => Http::response([
            ['id' => '1', 'name' => 'Task', 'statuses' => [
                ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
                ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']],
                ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
            ]],
        ]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $selects = '[data-slot="status-mapping-container"] button[role="combobox"]';

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $retro->team));

    $this->openIntegration($page, 'jira')
        ->assertSee('Status mapping')
        ->click('Edit mapping')
        ->assertVisible('[aria-label="Start to"]')
        ->assertAttribute("{$selects} >> nth=0", 'aria-label', 'Start to')
        ->click('[aria-label="Start to"]')
        ->click('[role="option"]:has-text("In Progress")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('[aria-label="Start to"]', 'In Progress');

    expect($integration->fresh()->setting('statusMapping.projects.PROJ.startStatusId'))->toBe('3');

    $page->click('[aria-label="Start to"]')
        ->click('[role="option"]:has-text("Automatic")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('[aria-label="Start to"]', 'Automatic')
        ->assertNoJavaScriptErrors();

    expect($integration->fresh()->setting('statusMapping.projects.PROJ.startStatusId'))->toBeNull();
});
