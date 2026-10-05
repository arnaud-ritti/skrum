<?php

use App\Enums\ActionItemPriority;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationUserMatch;
use App\Enums\PokerDeck;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationUserMapping;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\SocialAccount;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\InteractsWithIntegrations;

pest()->use(InteractsWithIntegrations::class);

function trackersEnable(IntegrationProvider $provider): void
{
    disableIntegrations();
    enableIntegrations($provider);

    config(['queue.default' => 'database']);

    Http::preventStrayRequests();
}

/**
 * @return array<string, mixed>
 */
function trackersJiraDataCenterIssue(string $id, string $key): array
{
    return [
        'id' => $id,
        'key' => $key,
        'fields' => [
            'summary' => "Story {$key}",
            'description' => "*Bold* intro\n* first\n* second",
            'assignee' => ['name' => 'jdoe', 'displayName' => 'Jane Doe'],
            'status' => ['name' => 'To Do'],
            'customfield_10002' => 5,
        ],
    ];
}

/**
 * @param  array<string, mixed>  $routes
 */
function trackersFakeJiraDataCenter(array $routes = []): void
{
    $defaults = [
        jiraDataCenterUrl('rest/agile/1.0/board/*/sprint*') => Http::response(['values' => [
            ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active', 'startDate' => '2026-10-01T09:00:00.000+02:00', 'endDate' => '2026-10-14T17:00:00.000+02:00'],
        ]]),
        jiraDataCenterUrl('rest/agile/1.0/board*') => Http::response(['values' => [['id' => 7, 'name' => 'Team board']], 'isLast' => true]),
        jiraDataCenterUrl('rest/api/2/search') => Http::response([
            'issues' => [trackersJiraDataCenterIssue('10001', 'PROJ-1'), trackersJiraDataCenterIssue('10002', 'PROJ-2')],
            'total' => 2,
            'startAt' => 0,
            'maxResults' => 100,
        ]),
        jiraDataCenterUrl('rest/api/2/issue/*/editmeta') => Http::response(['fields' => ['customfield_10002' => ['name' => 'Story Points']]]),
        jiraDataCenterUrl('rest/api/2/project') => Http::response([['id' => '10000', 'key' => 'API', 'name' => 'API platform']]),
        jiraDataCenterUrl('rest/api/2/issue/createmeta/10000/issuetypes') => Http::response(['values' => [
            ['id' => '10', 'name' => 'Story', 'subtask' => false],
            ['id' => '11', 'name' => 'Task', 'subtask' => false],
        ]]),
        jiraDataCenterUrl('rest/api/2/issue/createmeta/*') => Http::response(['values' => jiraCreateMeta()['fields']]),
        jiraDataCenterUrl('rest/api/2/issue') => Http::response(['id' => '10042', 'key' => 'PROJ-42'], 201),
        jiraDataCenterUrl('rest/api/2/issue/*') => Http::response(null, 204),
        'jira.example.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ];

    Http::fake([...$routes, ...array_diff_key($defaults, $routes)]);
}

/**
 * @return array{
 *     game: PokerGame,
 *     integration: TeamIntegration,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer
 * }
 */
function trackersTable(IntegrationProvider $source, PokerDeck $deck = PokerDeck::Fibonacci): array
{
    trackersEnable($source);

    $table = trackerTable($source, IntegrationAccess::Write, $deck);

    $table['game']->forceFill(['title' => 'Sprint 12 estimates'])->save();
    $table['facilitator']->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();

    return $table;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: ActionItem
 * }
 */
function trackersBoardItem(array $attributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 12']);
    [$ada, $participant] = retroFacilitator($retro);

    $ada->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();

    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $participant->id,
        'content' => 'Speed up CI',
        ...$attributes,
    ]);

    return [$retro, $ada, $item];
}

/**
 * @return array<int, Request>
 */
function trackersGitHubPatches(): array
{
    return Http::recorded(fn (Request $request): bool => $request->method() === 'PATCH')
        ->map(fn (array $pair): Request => $pair[0])
        ->values()
        ->all();
}

it('offers OAuth first on the Jira Data Center card and shows an OAuth connection with its access', function () {
    trackersEnable(IntegrationProvider::JiraDataCenter);
    Http::fake(['jira.example.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $team = Team::factory()->create();
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    $path = teamPath('teams.integrations.index', $team);

    $page = $this->signIn($admin, $path);

    $page->assertSee('Jira Data Center');

    $this->assertIntegrationStatus($page, 'jira_dc', 'Not connected');

    $this->openIntegration($page, 'jira_dc')
        ->assertAttributeContains('a:has-text("Connect (read only)")', 'href', '/connect?access=read')
        ->assertAttributeContains('a:has-text("Connect (read and write)")', 'href', '/connect?access=write')
        ->assertVisible('button:has-text("Older Jira server")');

    TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Read)->create(['team_id' => $team->id]);

    $page->navigate($path);

    $this->assertIntegrationStatus($page, 'jira_dc', 'Connected')
        ->assertSeeIn($this->integrationRow('jira_dc'), 'Acme Jira');

    $this->openIntegration($page, 'jira_dc')
        ->assertSee('Acme Jira')
        ->assertSee('9.12.2')
        ->assertSee('Read only')
        ->assertSee('OAuth')
        ->assertVisible('a:has-text("Reconnect")')
        ->assertAttributeContains('a:has-text("Upgrade to read and write")', 'href', '/connect?access=write')
        ->assertDontSee('Not connected')
        ->assertDontSee('Acting as')
        ->assertDontSee('Replace token');
});

it('connects Jira Data Center with a personal access token and shows whom the token acts as', function () {
    trackersEnable(IntegrationProvider::JiraDataCenter);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/myself') => Http::response(['name' => 'jdoe', 'displayName' => 'Jane Doe', 'emailAddress' => 'jane@example.com']),
        jiraDataCenterUrl('rest/api/2/serverInfo') => Http::response(['serverTitle' => 'Acme Jira', 'version' => '8.20.1', 'versionNumbers' => [8, 20, 1]]),
        jiraDataCenterUrl('rest/api/2/field') => Http::response([
            ['id' => 'customfield_10002', 'name' => 'Story Points', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ]),
        jiraDataCenterUrl('rest/api/2/priority') => Http::response([['id' => '1', 'name' => 'Blocker'], ['id' => '2', 'name' => 'High']]),
        'jira.example.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $token = 'pasted-jira-token-abcdefghijklmnop';
    $team = Team::factory()->create();
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');

    $path = teamPath('teams.integrations.index', $team);

    $page = $this->signIn($admin, $path);

    $this->assertIntegrationStatus($page, 'jira_dc', 'Not connected');

    $this->openIntegration($page, 'jira_dc')
        ->assertVisible('button:has-text("Older Jira server")')
        ->click('button:has-text("Older Jira server")')
        ->assertSee('Create a token in Jira under Profile → Personal Access Tokens, then paste it here.')
        ->assertSee('This token acts as its owner in Jira.')
        ->assertButtonDisabled('Save token')
        ->fill($this->dialogOverPanel('input[type="password"]'), $token)
        ->click($this->dialogOverPanel('button:has-text("Read and write")'))
        ->click($this->dialogOverPanel('label:has-text("I understand") button[role="checkbox"]'))
        ->assertButtonEnabled('Save token')
        ->click($this->dialogOverPanel('button[type="submit"]'))
        ->assertSee('Token saved.')
        ->assertNotPresent($this->dialogOverPanel())
        ->assertSee('Acting as Jane Doe in Jira')
        ->assertSee('This token acts as Jane Doe in Jira.')
        ->assertSee('Token saved on')
        ->assertSee('Acme Jira')
        ->assertSee('8.20.1')
        ->assertSee('Read and write')
        ->assertSee('Personal access token')
        ->assertSee('Replace token')
        ->assertSee('Remove token')
        ->assertScript('document.documentElement.innerHTML.includes("'.$token.'")', false);

    $this->assertIntegrationStatus($page, 'jira_dc', 'Connected');

    $page->navigate($path);

    $this->openIntegration($page, 'jira_dc')
        ->assertSee('Acting as Jane Doe in Jira')
        ->assertScript('document.documentElement.innerHTML.includes("'.$token.'")', false);

    $integration = TeamIntegration::query()->sole();

    expect($integration->credential('personalAccessToken'))->toBe($token)
        ->and((string) DB::table('team_integrations')->value('credentials'))->not->toContain($token)
        ->and($integration->setting('authMethod'))->toBe('pat')
        ->and($integration->setting('tokenOwner'))->toBe(['name' => 'jdoe', 'displayName' => 'Jane Doe'])
        ->and($integration->access)->toBe(IntegrationAccess::Write);

    foreach (['rest/api/2/myself', 'rest/api/2/serverInfo'] as $endpoint) {
        Http::assertSent(fn (Request $request) => $request->url() === "https://jira.example.com/{$endpoint}"
            && $request->hasHeader('Authorization', "Bearer {$token}"));
    }
});

it('refuses a token Jira rejects and a server older than Jira 8.14', function () {
    trackersEnable(IntegrationProvider::JiraDataCenter);
    $myselfStatus = 401;
    $versionNumbers = [8, 20, 1];
    Http::fake([
        jiraDataCenterUrl('rest/api/2/myself') => function () use (&$myselfStatus) {
            return Http::response(['name' => 'jdoe', 'displayName' => 'Jane Doe'], $myselfStatus);
        },
        jiraDataCenterUrl('rest/api/2/serverInfo') => function () use (&$versionNumbers) {
            return Http::response(['serverTitle' => 'Acme Jira', 'version' => implode('.', $versionNumbers), 'versionNumbers' => $versionNumbers]);
        },
        'jira.example.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $team = Team::factory()->create();
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'jira_dc')
        ->click('button:has-text("Older Jira server")')
        ->fill($this->dialogOverPanel('input[type="password"]'), 'pasted-jira-token-abcdefghijklmnop')
        ->click($this->dialogOverPanel('label:has-text("I understand") button[role="checkbox"]'))
        ->click($this->dialogOverPanel('button[type="submit"]'))
        ->assertSee("Jira didn't accept this token.");

    $myselfStatus = 200;
    $versionNumbers = [8, 13, 5];

    $page->click($this->dialogOverPanel('button[type="submit"]'))
        ->assertSee('Personal access tokens need Jira 8.14 or later.')
        ->click($this->dialogOverPanel('button:has-text("Cancel")'))
        ->assertNotPresent($this->dialogOverPanel());

    $this->assertIntegrationStatus($page, 'jira_dc', 'Not connected');

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('asks for a new token once Jira answers that the token was revoked', function () {
    trackersEnable(IntegrationProvider::JiraDataCenter);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/myself') => Http::response(['message' => 'Unauthorized'], 401),
        jiraDataCenterUrl('rest/api/2/priority') => Http::response([['id' => '1', 'name' => 'Blocker'], ['id' => '2', 'name' => 'High']]),
        'jira.example.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $team = Team::factory()->create();
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    $integration = TeamIntegration::factory()
        ->jiraDataCenter(IntegrationAccess::Write, 'pat')
        ->create(['team_id' => $team->id]);

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'jira_dc')
        ->assertSee('Acting as Jane Doe in Jira')
        ->click('Test the connection')
        ->assertSeeIn($this->integrationPanel('jira_dc'), 'Reconnect required')
        ->assertSee('The Jira personal access token was revoked or has expired. Paste a new one.')
        ->assertSee('Replace token')
        ->assertDontSee('Test the connection');

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('imports the issues of a Jira Data Center sprint into a poker game', function () {
    $table = trackersTable(IntegrationProvider::JiraDataCenter);
    trackersFakeJiraDataCenter();

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertVisible('button:has-text("Import")')
        ->click('button:has-text("Import")')
        ->assertVisible('[role="group"][aria-label="Import from Jira Data Center"]')
        ->click('[aria-label="Choose a board"]')
        ->click('[role="option"]:has-text("Team board")')
        ->assertNotPresent('[role="listbox"]')
        ->assertEnabled('[aria-label="Choose a sprint"]')
        ->click('[aria-label="Choose a sprint"]')
        ->click('[role="option"]:has-text("Sprint 31")')
        ->assertNotPresent('[role="listbox"]')
        ->click('Show issues')
        ->assertSee('Story PROJ-1')
        ->assertSee('Story PROJ-2')
        ->assertSee('Jane Doe')
        ->click('button:has-text("Import 2 tasks")')
        ->assertSee('2 imported, 0 skipped.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 2)
        ->assertPresent('[data-test="poker-task-row"]:has-text("Story PROJ-1") [data-slot="badge"]:text-is("PROJ-1")')
        ->assertPresent('[data-test="poker-task-row"]:has-text("Story PROJ-2") [data-slot="badge"]:text-is("PROJ-2")');

    $tasks = PokerTask::query()->where('poker_game_id', $table['game']->id)->orderBy('position')->get();

    expect($tasks->pluck('external_key')->all())->toBe(['PROJ-1', 'PROJ-2'])
        ->and($tasks->pluck('external_source')->unique()->all())->toBe(['jira_dc'])
        ->and($tasks->first()->description)->toBe("**Bold** intro\n- first\n- second")
        ->and($tasks->first()->external_estimate)->toBe('5');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/api/2/search'
        && $request['jql'] === 'sprint = 31 ORDER BY Rank ASC'
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access'));
});

it('writes the saved estimate to the story points field of the Jira Data Center issue', function () {
    $table = trackersTable(IntegrationProvider::JiraDataCenter);
    trackersFakeJiraDataCenter();
    $task = importedPokerTask($table['game'], [
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'external_url' => 'https://jira.example.com/browse/PROJ-1',
        'title' => 'Story PROJ-1',
    ], IntegrationProvider::JiraDataCenter);
    openPokerRound($table['game'], $task);

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]')
        ->assertButtonEnabled('Reveal cards')
        ->click('Reveal cards')
        ->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '5')
        ->assertSee('Validate 5')
        ->click('@poker-validate')
        ->assertSee('Estimate: 5')
        ->assertSee('Sync pending');

    $this->workDueJobs();

    $page->assertSee('Synced to Jira Data Center')
        ->assertDontSee('Sync pending');

    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && $request->url() === 'https://jira.example.com/rest/api/2/issue/10001'
        && $request['fields']['customfield_10002'] == 5
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access'));

    expect($task->fresh()->synced_at)->not->toBeNull()
        ->and($task->fresh()->needs_sync)->toBeFalse();
});

it('exports an action item to Jira Data Center with the mapped assignee and the priority', function () {
    trackersEnable(IntegrationProvider::JiraDataCenter);
    trackersFakeJiraDataCenter();
    [$retro, $ada, $item] = trackersBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create(['team_id' => $retro->team_id]);
    $bob = teamMember($retro->team);
    $bob->forceFill(['name' => 'Bob Dev', 'locale' => 'en'])->save();
    IntegrationUserMapping::factory()->manual()->create([
        'team_integration_id' => $integration->id,
        'user_id' => $bob->id,
        'external_account_id' => 'jdoe',
        'external_display_name' => 'Jane Doe',
    ]);
    $item->update(['assignee_user_id' => $bob->id]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertVisible("{$card} [aria-label=\"Export to Jira Data Center\"]")
        ->click("{$card} [aria-label=\"Export to Jira Data Center\"]")
        ->assertSeeIn('[role="dialog"] [aria-label="Project"]', 'API platform')
        ->assertSeeIn('[role="dialog"] [aria-label="Issue type"]', 'Task')
        ->assertSee('Assignee: Jane Doe (Jira Data Center)')
        ->assertSee('Priority: High')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as PROJ-42.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($card, 'PROJ-42')
        ->assertAttribute("{$card} a[href=\"https://jira.example.com/browse/PROJ-42\"]", 'target', '_blank')
        ->assertNotPresent("{$card} [aria-label=\"Export to Jira Data Center\"]");

    Http::assertSent(function (Request $request): bool {
        if ($request->method() !== 'POST' || $request->url() !== 'https://jira.example.com/rest/api/2/issue') {
            return false;
        }

        $fields = $request['fields'];

        return $fields['project'] === ['id' => '10000']
            && $fields['summary'] === 'Speed up CI'
            && $fields['priority'] === ['id' => '2']
            && $fields['assignee'] === ['name' => 'jdoe'];
    });
    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://jira.example.com/rest/api/2/issue/createmeta/10000/issuetypes/11'));

    $link = ActionItemExternalLink::query()->sole();

    expect($link->external_key)->toBe('PROJ-42')
        ->and($link->source)->toBe(IntegrationProvider::JiraDataCenter)
        ->and($link->action_item_id)->toBe($item->id);
});

it('creates the exported issue with the personal access token, so Jira records its owner as the author', function () {
    trackersEnable(IntegrationProvider::JiraDataCenter);
    trackersFakeJiraDataCenter();
    [$retro, $ada, $item] = trackersBoardItem();
    TeamIntegration::factory()
        ->jiraDataCenter(IntegrationAccess::Write, 'pat')
        ->create(['team_id' => $retro->team_id]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertVisible("{$card} [aria-label=\"Export to Jira Data Center\"]")
        ->click("{$card} [aria-label=\"Export to Jira Data Center\"]")
        ->assertSeeIn('[role="dialog"] [aria-label="Issue type"]', 'Task')
        ->assertSee('Unassigned')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as PROJ-42.')
        ->assertSeeIn($card, 'PROJ-42');

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && $request->url() === 'https://jira.example.com/rest/api/2/issue'
        && $request->hasHeader('Authorization', 'Bearer '.TeamIntegrationFactory::JiraDataCenterToken));
    Http::assertNotSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer jira-dc-access'));
});

it('links the GitHub card to the App installation and shows the connected account', function () {
    trackersEnable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();
    Http::fake(['api.github.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $team = Team::factory()->create();
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    $path = teamPath('teams.integrations.index', $team);

    $page = $this->signIn($admin, $path);

    $this->assertIntegrationStatus($page, 'github', 'Not connected');

    $this->openIntegration($page, 'github')
        ->assertAttributeContains('a:has-text("Install the GitHub App")', 'href', '/integrations/github/connect');

    TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);

    $page->navigate($path);

    $this->assertIntegrationStatus($page, 'github', 'Connected');

    $this->openIntegration($page, 'github')
        ->assertSee('GitHub account')
        ->assertAttribute('a:has-text("acme")', 'href', 'https://github.com/organizations/acme/settings/installations/4242')
        ->assertSee('Read and write')
        ->assertAttributeContains('a:has-text("Manage the installation")', 'href', '/integrations/github/connect')
        ->assertSee('Test the connection');
});

it('imports the open issues of a GitHub milestone into a poker game', function () {
    $table = trackersTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repos/acme/api/milestones*' => Http::response([
            ['number' => 2, 'title' => 'Sprint 2', 'due_on' => now()->addDays(5)->toIso8601ZuluString()],
        ]),
    ]);
    Http::fake(['api.github.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertVisible('button:has-text("Import")')
        ->click('button:has-text("Import")')
        ->assertVisible('[role="group"][aria-label="Import from GitHub"]')
        ->click('[aria-label="Choose a repository"]')
        ->click('[role="option"]:has-text("acme/api")')
        ->assertNotPresent('[role="listbox"]')
        ->assertEnabled('[aria-label="Choose a milestone"]')
        ->click('[aria-label="Choose a milestone"]')
        ->click('[role="option"]:has-text("Sprint 2")')
        ->assertNotPresent('[role="listbox"]')
        ->click('Show issues')
        ->assertSee('acme/api#1')
        ->assertSee('acme/api#2')
        ->assertDontSee('acme/api#5')
        ->click('button:has-text("Import 2 tasks")')
        ->assertSee('2 imported, 0 skipped.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 2)
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Issue 1")', 'acme/api#1')
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Issue 2")', 'acme/api#2');

    expect(PokerTask::query()->where('poker_game_id', $table['game']->id)->orderBy('position')->pluck('external_id')->all())
        ->toBe(['9001/1', '9001/2']);

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/repos/acme/api/issues?')
        && $request['milestone'] === '2'
        && $request['state'] === 'open');
});

it('writes the estimate of a Fibonacci game as one block at the end of the GitHub issue body', function () {
    $table = trackersTable(IntegrationProvider::GitHub);
    $body = "Steps to reproduce\n\n1. Open the cart";
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => $body])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);
    $task = importedPokerTask($table['game'], [
        'external_id' => '9001/7',
        'external_key' => 'acme/api#7',
        'external_url' => 'https://github.com/acme/api/issues/7',
        'title' => 'Checkout bug',
    ], IntegrationProvider::GitHub);
    openPokerRound($table['game'], $task);

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]')
        ->assertButtonEnabled('Reveal cards')
        ->click('Reveal cards')
        ->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '5')
        ->assertSee('Validate 5')
        ->click('@poker-validate')
        ->assertSee('Estimate: 5')
        ->assertSee('Sync pending');

    $this->workDueJobs();

    $page->assertSee('Synced to GitHub')
        ->assertAttribute('[data-slot="badge"]:has-text("Synced to GitHub")', 'title', 'Written to the issue description.');

    $patches = trackersGitHubPatches();

    expect($patches)->toHaveCount(1)
        ->and($patches[0]->url())->toBe('https://api.github.com/repos/acme/api/issues/7')
        ->and($patches[0]['body'])->toBe("{$body}\n\n".renderedEstimateBlock('5'))
        ->and(substr_count($patches[0]['body'], '<!-- skrum:estimate -->'))->toBe(1);
});

it('writes the estimate of a T-shirt game as text into the GitHub issue body', function () {
    $table = trackersTable(IntegrationProvider::GitHub, PokerDeck::Tshirt);
    $body = 'Size this before the sprint';
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => $body])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);
    $task = importedPokerTask($table['game'], [
        'external_id' => '9001/7',
        'external_key' => 'acme/api#7',
        'external_url' => 'https://github.com/acme/api/issues/7',
        'title' => 'Checkout bug',
    ], IntegrationProvider::GitHub);
    openPokerRound($table['game'], $task);

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertEnabled('[aria-label="Play XL"]')
        ->click('[aria-label="Play XL"]')
        ->assertButtonEnabled('Reveal cards')
        ->click('Reveal cards')
        ->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', 'XL')
        ->assertSee('Validate XL')
        ->click('@poker-validate')
        ->assertSee('Estimate: XL')
        ->assertSee('Sync pending');

    $this->workDueJobs();

    $page->assertSee('Synced to GitHub');

    $patches = trackersGitHubPatches();

    expect($patches)->toHaveCount(1)
        ->and($patches[0]['body'])->toBe("{$body}\n\n".renderedEstimateBlock('XL'))
        ->and(substr_count($patches[0]['body'], '<!-- skrum:estimate -->'))->toBe(1);
});

it('updates the block in place and keeps the text written around it on GitHub', function () {
    $table = trackersTable(IntegrationProvider::GitHub);
    $body = "Intro edited on GitHub\n\n".renderedEstimateBlock('3')."\n\nNotes added below the block";
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => $body])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);
    $task = importedPokerTask($table['game'], [
        'external_id' => '9001/7',
        'external_key' => 'acme/api#7',
        'external_url' => 'https://github.com/acme/api/issues/7',
        'title' => 'Checkout bug',
        'estimate' => '3',
        'estimate_numeric' => 3,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
        'external_estimate' => '3',
    ], IntegrationProvider::GitHub);
    $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($round, $table['facilitatorPlayer'], '13');
    $table['game']->forceFill(['current_task_id' => $task->id])->save();

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertSee('Estimate: 3')
        ->assertVisible('[aria-label="Final estimate"]')
        ->click('[aria-label="Final estimate"] [aria-label="13"]')
        ->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '13')
        ->assertSee('Validate 13')
        ->click('@poker-validate')
        ->assertSee('Estimate: 13')
        ->assertSee('Sync pending');

    $this->workDueJobs();

    $page->assertSee('Synced to GitHub')
        ->assertDontSee('Sync pending');

    $patches = trackersGitHubPatches();

    expect($patches)->toHaveCount(1)
        ->and($patches[0]['body'])->toBe("Intro edited on GitHub\n\n".renderedEstimateBlock('13')."\n\nNotes added below the block")
        ->and(substr_count($patches[0]['body'], '<!-- skrum:estimate -->'))->toBe(1);
});

it('removes the block from the GitHub issue body when the facilitator clears the estimate', function () {
    $table = trackersTable(IntegrationProvider::GitHub);
    $body = "Intro edited on GitHub\n\n".renderedEstimateBlock('3');
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => $body])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);
    $task = importedPokerTask($table['game'], [
        'external_id' => '9001/7',
        'external_key' => 'acme/api#7',
        'external_url' => 'https://github.com/acme/api/issues/7',
        'title' => 'Checkout bug',
        'estimate' => '3',
        'estimate_numeric' => 3,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
        'external_estimate' => '3',
    ], IntegrationProvider::GitHub);
    $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($round, $table['facilitatorPlayer'], '3');
    $table['game']->forceFill(['current_task_id' => $task->id])->save();
    $estimateUrl = route('poker.tasks.estimate.update', [$table['game'], $task], false);
    $estimateBadge = '[data-slot="badge"]:text-is("Estimate: 3")';

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertPresent($estimateBadge)
        ->assertSee('Synced to GitHub');

    $status = $this->sendFromPage($page, 'PUT', $estimateUrl, ['value' => null])['status'];

    expect($status)->toBe(200);

    $page->assertNotPresent($estimateBadge)
        ->assertSee('Sync pending');

    $this->workDueJobs();

    $patches = trackersGitHubPatches();

    expect($patches)->toHaveCount(1)
        ->and($patches[0]->url())->toBe('https://api.github.com/repos/acme/api/issues/7')
        ->and($patches[0]['body'])->toBe('Intro edited on GitHub')
        ->and($task->fresh()->estimate)->toBeNull();

    $page->assertSee('Synced to GitHub')
        ->assertDontSee('Sync pending')
        ->assertNotPresent($estimateBadge);
});

it('exports an action item to GitHub for a member linked by GitHub sign-in, with the priority label', function () {
    trackersEnable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/user/583231' => Http::response(['id' => 583231, 'login' => 'octocat', 'type' => 'User']),
        'api.github.com/repos/acme/api/labels/*' => Http::response(['name' => 'priority: high']),
        'api.github.com/repos/acme/api/issues' => Http::response([
            'number' => 12,
            'html_url' => 'https://github.com/acme/api/issues/12',
            'assignees' => [['login' => 'octocat']],
        ], 201),
    ]);
    Http::fake(['api.github.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    [$retro, $ada, $item] = trackersBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => ['high' => 'priority: high']]])->save();
    $bob = teamMember($retro->team);
    $bob->forceFill(['name' => 'Bob Dev', 'locale' => 'en'])->save();
    SocialAccount::factory()->create(['user_id' => $bob->id, 'provider' => 'github', 'provider_user_id' => '583231']);
    $item->update(['assignee_user_id' => $bob->id]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertVisible("{$card} [aria-label=\"Export to GitHub\"]")
        ->click("{$card} [aria-label=\"Export to GitHub\"]")
        ->assertSeeIn('[role="dialog"] [aria-label="Repository"]', 'acme/api')
        ->assertSee("Assignee: not mapped yet — skrum will use Bob Dev's GitHub sign-in")
        ->assertSee('Priority label: priority: high')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as acme/api#12.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($card, 'acme/api#12')
        ->assertAttribute("{$card} a[href=\"https://github.com/acme/api/issues/12\"]", 'target', '_blank');

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && $request->url() === 'https://api.github.com/repos/acme/api/issues'
        && $request['title'] === 'Speed up CI'
        && $request['assignees'] === ['octocat']
        && $request['labels'] === ['priority: high']);

    $mapping = $integration->userMappings()->sole();

    expect($mapping->user_id)->toBe($bob->id)
        ->and($mapping->matched_by)->toBe(IntegrationUserMatch::Sso)
        ->and($mapping->external_account_id)->toBe('583231')
        ->and(ActionItemExternalLink::query()->sole()->external_id)->toBe('9001/12');
});

it('asks to reconnect once GitHub answers that the App was uninstalled', function () {
    trackersEnable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/app/installations/4242' => Http::response(['message' => 'Not Found'], 404),
    ]);
    Http::fake(['api.github.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $team = Team::factory()->create();
    $admin = renamedUser(integrationAdmin($team), 'Ada Admin');
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'github')
        ->assertSee('GitHub account')
        ->click('Test the connection')
        ->assertSeeIn($this->integrationPanel('github'), 'Reconnect required')
        ->assertSee('The GitHub App was uninstalled from acme.')
        ->assertVisible('a:has-text("Manage the installation")')
        ->assertDontSee('Test the connection');

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});
