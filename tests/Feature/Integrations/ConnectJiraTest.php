<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Integrations\IntegrationActivated;
use App\Jobs\MatchIntegrationUsers;
use App\Models\IntegrationUserMapping;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Jira);
});

/**
 * @return array<int, array<string, mixed>>
 */
function jiraFieldsFixture(): array
{
    return [
        ['id' => 'summary', 'name' => 'Summary', 'custom' => false, 'schema' => ['type' => 'string']],
        ['id' => 'customfield_10028', 'name' => 'Story Points', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ['id' => 'customfield_10016', 'name' => 'Story point estimate', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.pyxis.greenhopper.jira:jsw-story-points']],
        ['id' => 'customfield_10050', 'name' => 'Business value', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ['id' => 'customfield_10060', 'name' => 'Story points', 'custom' => true, 'schema' => ['type' => 'string']],
    ];
}

/**
 * @param  array<int, array<string, mixed>>  $sites
 * @param  array<int, array<string, mixed>>|null  $fields
 */
function fakeJiraOAuth(array $sites = [['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme', 'scopes' => ['read:jira-work']]], ?array $fields = null): void
{
    Http::fake([
        'auth.atlassian.com/oauth/token' => Http::response([
            'access_token' => 'jira-access-new',
            'refresh_token' => 'jira-refresh-new',
            'expires_in' => 3600,
            'scope' => 'offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software write:jira-work read:jira-user',
        ]),
        'api.atlassian.com/oauth/token/accessible-resources' => Http::response($sites),
        'api.atlassian.com/ex/jira/*/rest/api/3/field' => Http::response($fields ?? jiraFieldsFixture()),
    ]);
}

function jiraCallback(User $user, Team $team, IntegrationAccess $access = IntegrationAccess::Write): TestResponse
{
    return test()->actingAs($user)
        ->withSession(integrationOAuthSession($team, IntegrationProvider::Jira, $access))
        ->get(route('integrations.callback', ['provider' => 'jira', 'code' => 'jira-code', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu']));
}

/**
 * @param  array<string, mixed>  $body
 */
function patchIntegration(User $user, TeamIntegration $integration, array $body): TestResponse
{
    return test()->actingAs($user)->patchJson(
        route('teams.integrations.update', [$integration->team->workspace, $integration->team, $integration]),
        $body,
    );
}

it('asks for read or read-and-write access', function (string $access, string $scope) {
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'jira', 'access' => $access]));

    parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect($query['scope'])->toBe($scope)
        ->and(session('integrations.oauth.access'))->toBe($access);
})->with([
    'read' => ['read', 'offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software manage:jira-webhook'],
    'write' => ['write', 'offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software manage:jira-webhook write:jira-work read:jira-user'],
]);

it('connects a single Jira site and detects its story points fields', function () {
    Event::fake([IntegrationActivated::class]);
    fakeJiraOAuth();
    $team = Team::factory()->create();

    jiraCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Jira connected.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->hasScope('read:jira-user'))->toBeTrue()
        ->and($integration->credential('access_token'))->toBe('jira-access-new')
        ->and($integration->credential('refresh_token'))->toBe('jira-refresh-new')
        ->and($integration->setting('cloudId'))->toBe('cloud-1')
        ->and($integration->setting('siteUrl'))->toBe('https://acme.atlassian.net')
        ->and($integration->setting('siteName'))->toBe('Acme')
        ->and($integration->setting('storyPointFields'))->toBe([
            ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
            ['id' => 'customfield_10028', 'name' => 'Story Points'],
        ])
        ->and($integration->setting('numberFields'))->toBe([
            ['id' => 'customfield_10028', 'name' => 'Story Points'],
            ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
            ['id' => 'customfield_10050', 'name' => 'Business value'],
        ]);

    Http::assertSent(fn (Request $request) => $request->url() === 'https://auth.atlassian.com/oauth/token'
        && $request['grant_type'] === 'authorization_code'
        && $request['code'] === 'jira-code');
    Event::assertDispatched(IntegrationActivated::class, fn (IntegrationActivated $event) => $event->integration->is($integration) && ! $event->siteChanged);
});

it('does not announce read-only connections', function () {
    Event::fake([IntegrationActivated::class]);
    fakeJiraOAuth();
    $team = Team::factory()->create();

    jiraCallback(integrationAdmin($team), $team, IntegrationAccess::Read);

    expect(TeamIntegration::query()->sole()->access)->toBe(IntegrationAccess::Read);
    Event::assertNotDispatched(IntegrationActivated::class);
});

it('asks the admin to choose among several sites', function () {
    Event::fake([IntegrationActivated::class]);
    fakeJiraOAuth([
        ['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme'],
        ['id' => 'cloud-2', 'url' => 'https://beta.atlassian.net', 'name' => 'Beta'],
    ]);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);

    jiraCallback($admin, $team)
        ->assertInertiaFlash('toast', ['type' => 'info', 'message' => 'Choose a Jira site to finish connecting.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->status)->toBe(IntegrationStatus::SetupRequired)
        ->and($integration->setting('sites'))->toHaveCount(2);
    Event::assertNotDispatched(IntegrationActivated::class);

    patchIntegration($admin, $integration, ['cloud_id' => 'cloud-2'])
        ->assertOk()
        ->assertJsonPath('status', 'active')
        ->assertJsonPath('settings.siteName', 'Beta')
        ->assertJsonMissingPath('settings.sites');

    expect($integration->fresh()->setting('storyPointFields.0.id'))->toBe('customfield_10016');
    Event::assertDispatched(IntegrationActivated::class);
});

it('keeps the current site when it is among several sites', function () {
    fakeJiraOAuth([
        ['id' => 'cloud-2', 'url' => 'https://beta.atlassian.net', 'name' => 'Beta'],
        ['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme'],
    ]);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->reconnectRequired()->create(['team_id' => $team->id]);

    jiraCallback(integrationAdmin($team), $team);

    $integration = TeamIntegration::query()->sole();

    expect($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->site())->toBe('cloud-1');
    Queue::assertPushed(MatchIntegrationUsers::class);
});

it('refuses an Atlassian account without a Jira site', function () {
    fakeJiraOAuth([]);
    $team = Team::factory()->create();

    jiraCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'This Atlassian account has no Jira site.']);

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('upgrades read access without losing the site or imported references', function () {
    Event::fake([IntegrationActivated::class]);
    fakeJiraOAuth();
    $team = Team::factory()->create();
    $existing = TeamIntegration::factory()->jira(IntegrationAccess::Read)->create([
        'team_id' => $team->id,
        'settings' => [
            'cloudId' => 'cloud-1', 'siteUrl' => 'https://acme.atlassian.net', 'siteName' => 'Acme',
            'storyPointFields' => [], 'numberFields' => [], 'exportProjectId' => '10000',
        ],
    ]);
    $task = PokerTask::factory()->imported()->create([
        'poker_game_id' => PokerGame::factory()->create(['team_id' => $team->id])->id,
    ]);

    jiraCallback(integrationAdmin($team), $team);

    $integration = TeamIntegration::query()->sole();

    expect($integration->id)->toBe($existing->id)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->setting('exportProjectId'))->toBe('10000')
        ->and($task->fresh()->game->team_id)->toBe($team->id)
        ->and($task->fresh()->external_site)->toBe($integration->site());
    Event::assertDispatched(IntegrationActivated::class, fn (IntegrationActivated $event) => ! $event->siteChanged);
});

it('deletes account mappings when reconnecting to another site only', function () {
    Event::fake([IntegrationActivated::class]);
    Http::fake([
        'auth.atlassian.com/oauth/token' => Http::response(['access_token' => 'jira-access-new', 'refresh_token' => 'jira-refresh-new', 'expires_in' => 3600, 'scope' => 'offline_access read:jira-work write:jira-work read:jira-user']),
        'api.atlassian.com/oauth/token/accessible-resources' => Http::sequence()
            ->push([['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme']])
            ->push([['id' => 'cloud-9', 'url' => 'https://other.atlassian.net', 'name' => 'Other']]),
        'api.atlassian.com/ex/jira/*/rest/api/3/field' => Http::response(jiraFieldsFixture()),
    ]);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $team->id, 'settings' => [
        'cloudId' => 'cloud-1', 'siteUrl' => 'https://acme.atlassian.net', 'siteName' => 'Acme', 'exportProjectId' => '10000',
    ]]);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id]);

    jiraCallback($admin, $team);

    expect($integration->userMappings()->count())->toBe(1)
        ->and($integration->fresh()->setting('exportProjectId'))->toBe('10000');
    Event::assertNotDispatched(IntegrationActivated::class);

    jiraCallback($admin, $team);

    $fresh = $integration->fresh();

    expect($fresh->site())->toBe('cloud-9')
        ->and($fresh->setting('exportProjectId'))->toBeNull()
        ->and($fresh->userMappings()->count())->toBe(0);
    Event::assertDispatched(IntegrationActivated::class, fn (IntegrationActivated $event) => $event->siteChanged);
});

it('lets the admin choose the story points field and detect again', function () {
    fakeJiraOAuth();
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.detection.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonPath('settings.storyPointFields.0.id', 'customfield_10016');

    patchIntegration($admin, $integration->fresh(), ['story_point_field_id' => 'customfield_10050'])
        ->assertOk()
        ->assertJsonPath('settings.storyPointFields', [
            ['id' => 'customfield_10050', 'name' => 'Business value'],
            ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
            ['id' => 'customfield_10028', 'name' => 'Story Points'],
        ]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.detection.store', [$team->workspace, $team, $integration]))
        ->assertJsonPath('settings.storyPointFields.0.id', 'customfield_10050');
});

it('reports a site without story points fields', function () {
    fakeJiraOAuth(fields: [['id' => 'summary', 'name' => 'Summary', 'custom' => false, 'schema' => ['type' => 'string']]]);
    $team = Team::factory()->create();

    jiraCallback(integrationAdmin($team), $team);

    expect(TeamIntegration::query()->sole()->setting('storyPointFields'))->toBe([]);
});

it('validates Jira settings changes', function () {
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $active = TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    patchIntegration($admin, $active, ['cloud_id' => 'cloud-1'])->assertJsonValidationErrors('cloud_id');
    patchIntegration($admin, $active, ['story_point_field_id' => 'customfield_99999'])->assertJsonValidationErrors('story_point_field_id');
    patchIntegration(teamMember($team), $active, ['story_point_field_id' => 'customfield_10016'])->assertForbidden();
});

it('detects story points on Jira connections only', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create();
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.detection.store', [$team->workspace, $team, $slack]))
        ->assertNotFound();
});
