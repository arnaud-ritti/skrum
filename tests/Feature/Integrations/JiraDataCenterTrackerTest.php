<?php

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Poker\RenderTaskMarkdown;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Exceptions\Integrations\EstimateRejected;
use App\Jobs\SyncTaskEstimate;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use App\Support\Integrations\JiraDataCenter\WikiMarkupToMarkdown;
use App\Support\Integrations\Trackers\JiraDataCenterTracker;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

/**
 * An issue as `POST /rest/api/2/search` returns it: the description is wiki markup.
 *
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function jiraDataCenterIssue(string $id, string $key, array $fields = []): array
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
            ...$fields,
        ],
    ];
}

/**
 * @param  array<int, array<string, mixed>>|null  $issues
 */
function fakeJiraDataCenterTrackerApi(?array $issues = null, ?int $total = null): void
{
    $issues ??= [jiraDataCenterIssue('10001', 'PROJ-1'), jiraDataCenterIssue('10002', 'PROJ-2')];

    Http::fake([
        jiraDataCenterUrl('rest/agile/1.0/board/*/sprint*') => Http::response(['values' => [
            ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active', 'startDate' => '2026-10-01T09:00:00.000+02:00', 'endDate' => '2026-10-14T17:00:00.000+02:00'],
        ]]),
        jiraDataCenterUrl('rest/agile/1.0/board*') => Http::response(['values' => [['id' => 7, 'name' => 'Team board']], 'isLast' => true]),
        jiraDataCenterUrl('rest/api/2/search') => Http::response(['issues' => $issues, 'total' => $total ?? count($issues), 'startAt' => 0, 'maxResults' => 100]),
        jiraDataCenterUrl('rest/api/2/issue/*/editmeta') => Http::response(['fields' => ['customfield_10002' => ['name' => 'Story Points']]]),
        jiraDataCenterUrl('rest/api/2/issue/*') => Http::response(null, 204),
        jiraDataCenterUrl('rest/api/2/field') => Http::response([
            ['id' => 'customfield_10002', 'name' => 'Story Points', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ]),
    ]);
}

it('lists boards, sprints and issues of the Data Center server', function () {
    $table = trackerTable(IntegrationProvider::JiraDataCenter);
    fakeJiraDataCenterTrackerApi();

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.containers.index', [$table['game'], 'jira_dc', 'q' => 'Team']))
        ->assertOk()
        ->assertExactJson(['containers' => [['id' => '7', 'name' => 'Team board']], 'hasMore' => false]);

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.iterations.index', [$table['game'], 'jira_dc', 'container' => '7']))
        ->assertOk()
        ->assertExactJson([['id' => '31', 'name' => 'Sprint 31', 'state' => 'active', 'startsOn' => '2026-10-01', 'endsOn' => '2026-10-14']]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'jira_dc']), ['mode' => 'iteration', 'iteration_id' => '31'])
        ->assertOk()
        ->assertJsonPath('truncated', false)
        ->assertJsonPath('issues.0.key', 'PROJ-1')
        ->assertJsonPath('issues.0.estimate', '5')
        ->assertJsonPath('issues.0.assignee', 'Jane Doe');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/api/2/search'
        && $request['jql'] === 'sprint = 31 ORDER BY Rank ASC'
        && $request['startAt'] === 0
        && in_array('customfield_10002', $request['fields'], true)
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access'));
});

it('imports Data Center issues with wiki descriptions as Markdown', function () {
    $table = trackerTable(IntegrationProvider::JiraDataCenter);
    fakeJiraDataCenterTrackerApi([jiraDataCenterIssue('10001', 'PROJ-1')]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira_dc']), ['external_ids' => ['10001']])
        ->assertCreated()
        ->assertExactJson(['imported' => 1, 'skipped' => 0]);

    $task = PokerTask::query()->where('poker_game_id', $table['game']->id)->sole();

    expect($task->description)->toBe("**Bold** intro\n- first\n- second")
        ->and($task->external_source)->toBe('jira_dc')
        ->and($task->external_site)->toBe(JiraDataCenterServer::key())
        ->and($task->external_url)->toBe('https://jira.example.com/browse/PROJ-1')
        ->and($task->external_estimate)->toBe('5');

    Http::assertSent(fn (Request $request) => ($request['jql'] ?? null) === 'id in (10001)');
});

it('reports truncated searches from the total', function () {
    $table = trackerTable(IntegrationProvider::JiraDataCenter);
    fakeJiraDataCenterTrackerApi([jiraDataCenterIssue('10001', 'PROJ-1')], total: 150);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'jira_dc']), ['mode' => 'query', 'query' => 'project = PROJ'])
        ->assertOk()
        ->assertJsonPath('truncated', true);
});

it('writes story points back to the Data Center issue', function () {
    $table = trackerTable(IntegrationProvider::JiraDataCenter);
    fakeJiraDataCenterTrackerApi();
    $task = importedPokerTask($table['game'], [
        'external_id' => '10001',
        'estimate' => '8',
        'estimate_numeric' => 8,
        'estimated_at' => now(),
        'needs_sync' => true,
    ], IntegrationProvider::JiraDataCenter);

    app()->call([new SyncTaskEstimate($task->id), 'handle']);

    expect($task->fresh()?->needs_sync)->toBeFalse()
        ->and($task->fresh()?->synced_at)->not->toBeNull();
    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && $request->url() === 'https://jira.example.com/rest/api/2/issue/10001'
        && $request['fields']['customfield_10002'] == 8);
});

it('refuses unsafe ids before calling the server', function () {
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $tracker = resolve(JiraDataCenterTracker::class);

    expect($tracker->iterations($integration, '../7'))->toBeEmpty()
        ->and(fn () => $tracker->writeEstimate($integration, '../10001', '3'))->toThrow(EstimateRejected::class, 'This issue was not found in Jira Data Center.');

    Http::assertNothingSent();
});

it('explains why T-shirt games and servers without story points cannot sync', function () {
    $tshirt = trackerTable(IntegrationProvider::JiraDataCenter, IntegrationAccess::Write, PokerDeck::Tshirt);
    $task = importedPokerTask($tshirt['game'], [], IntegrationProvider::JiraDataCenter);

    expect(PokerTaskSync::for($tshirt['game'])->unsupportedReason($task))->toBe("T-shirt estimates can't be written to Jira Data Center.");

    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'storyPointFields' => []]])->save();

    expect(PokerTaskSync::writeBackUnavailableReason(IntegrationProvider::JiraDataCenter, $integration))->toBe('No story points field found.');
});

it('detects story points on Data Center connections', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    fakeJiraDataCenterTrackerApi();
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.detection.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonPath('settings.storyPointFields', [['id' => 'customfield_10002', 'name' => 'Story Points']]);
});

it('renders converted wiki descriptions without raw HTML or script links', function () {
    $markdown = (new WikiMarkupToMarkdown)->convert("*bold* [x](javascript:alert(1))\n\n<script>alert(2)</script>\n\n<img src=x onerror=alert(3)>\n\n[label|javascript:alert(4)] [label|https://example.com/\"onclick=\"alert(5)] !javascript:alert(6)!");
    $html = resolve(RenderTaskMarkdown::class)->handle($markdown);

    expect($html)->toContain('<strong>bold</strong>')
        ->and($html)->toContain('&lt;script&gt;')
        ->and($html)->not->toContain('<script')
        ->and($html)->not->toContain('<img')
        ->and($html)->not->toContain('href="javascript')
        ->and($html)->not->toContain('onclick="');
});

it('encodes the issue key of browse links', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();

    expect(resolve(JiraDataCenterClient::class)->browseUrl($integration, 'PROJ 1/../x'))->toBe('https://jira.example.com/browse/PROJ%201%2F..%2Fx')
        ->and(resolve(JiraDataCenterClient::class)->browseUrl($integration, 'PROJ-1'))->toBe('https://jira.example.com/browse/PROJ-1');
});

it('refuses board and issue ids longer than 20 digits before calling the server', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $tracker = resolve(JiraDataCenterTracker::class);
    $tooLong = str_repeat('1', 21);

    expect($tracker->iterations($integration, $tooLong))->toBeEmpty()
        ->and($tracker->issues($integration, [$tooLong]))->toBeEmpty();

    Http::assertNothingSent();
});
