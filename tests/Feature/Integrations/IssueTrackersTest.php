<?php

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Trackers\JiraDataCenterTracker;
use App\Support\Integrations\Trackers\JiraTracker;
use App\Support\Integrations\Trackers\LinearTracker;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
});

it('resolves the tracker of each provider', function () {
    expect(app(Trackers::class)->for(IntegrationProvider::Jira))->toBeInstanceOf(JiraTracker::class)
        ->and(app(Trackers::class)->for(IntegrationProvider::Linear))->toBeInstanceOf(LinearTracker::class)
        ->and(app(Trackers::class)->for(IntegrationProvider::JiraDataCenter))->toBeInstanceOf(JiraDataCenterTracker::class)
        ->and(fn () => app(Trackers::class)->for(IntegrationProvider::Slack))->toThrow(InvalidArgumentException::class);
});

it('lists Jira scrum boards by page and name', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board*' => Http::response([
        'values' => [['id' => 7, 'name' => 'Team board'], ['id' => 9, 'name' => 'Other board']],
        'isLast' => false,
    ])]);
    $integration = TeamIntegration::factory()->jira()->create();

    $result = app(JiraTracker::class)->containers($integration, 'board', 2);

    expect($result)->toBe([
        'containers' => [['id' => '7', 'name' => 'Team board'], ['id' => '9', 'name' => 'Other board']],
        'hasMore' => true,
    ]);
    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'type=scrum')
        && str_contains($request->url(), 'name=board')
        && str_contains($request->url(), 'startAt=50')
        && str_contains($request->url(), 'maxResults=50'));
});

it('lists active and future Jira sprints', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board/7/sprint*' => Http::response(['values' => [
        ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active', 'startDate' => '2026-09-28T08:00:00.000Z', 'endDate' => '2026-10-12T08:00:00.000Z'],
        ['id' => 32, 'name' => 'Sprint 32', 'state' => 'future'],
    ]])]);
    $integration = TeamIntegration::factory()->jira()->create();

    expect(app(JiraTracker::class)->iterations($integration, '7'))->toBe([
        ['id' => '31', 'name' => 'Sprint 31', 'state' => 'active', 'startsOn' => '2026-09-28', 'endsOn' => '2026-10-12'],
        ['id' => '32', 'name' => 'Sprint 32', 'state' => 'upcoming', 'startsOn' => null, 'endsOn' => null],
    ]);
    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'state=active%2Cfuture'));
});

it('maps the issues of a Jira sprint with the story point candidates', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::response([
        'issues' => [
            jiraTrackerIssue('10001', 'PROJ-1', ['customfield_10016' => 5.0]),
            jiraTrackerIssue('10002', 'PROJ-2', ['assignee' => null, 'customfield_10016' => null, 'summary' => '  ']),
        ],
        'nextPageToken' => 'next',
    ])]);
    $integration = TeamIntegration::factory()->jira()->create();

    $list = app(JiraTracker::class)->iterationIssues($integration, '31');

    expect($list->truncated)->toBeTrue()
        ->and($list->issues)->toHaveCount(2)
        ->and($list->issues[0]->preview(false))->toBe([
            'externalId' => '10001',
            'key' => 'PROJ-1',
            'title' => 'Story PROJ-1',
            'assignee' => 'Jane Doe',
            'estimate' => '5',
            'status' => 'To Do',
            'alreadyImported' => false,
        ])
        ->and($list->issues[0]->description)->toBe('About PROJ-1')
        ->and($list->issues[0]->url)->toBe('https://acme.atlassian.net/browse/PROJ-1')
        ->and($list->issues[1]->title)->toBe('PROJ-2')
        ->and($list->issues[1]->assignee)->toBeNull()
        ->and($list->issues[1]->estimate)->toBeNull();

    Http::assertSent(fn (Request $request) => $request['jql'] === 'sprint = 31 ORDER BY Rank ASC'
        && $request['maxResults'] === 100
        && $request['fields'] === ['summary', 'description', 'assignee', 'status', 'customfield_10016']);
});

it('surfaces Jira JQL errors', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::response([
        'errorMessages' => ["Field 'nope' does not exist."],
    ], 400)]);
    $integration = TeamIntegration::factory()->jira()->create();

    expect(fn () => app(JiraTracker::class)->search($integration, 'nope = 1'))
        ->toThrow(ProviderRejected::class, "Field 'nope' does not exist.");
});

it('fetches Jira issues by id in batches of 100', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::sequence()
        ->push(['issues' => array_map(fn (int $n) => jiraTrackerIssue((string) (10000 + $n), "PROJ-{$n}"), range(1, 100))])
        ->push(['issues' => [jiraTrackerIssue('10101', 'PROJ-101')]])]);
    $integration = TeamIntegration::factory()->jira()->create();
    $ids = array_map(fn (int $n) => (string) (10000 + $n), range(1, 102));

    $issues = app(JiraTracker::class)->issues($integration, [...$ids, 'not-a-jira-id']);

    expect($issues)->toHaveCount(101)
        ->and($issues['10101']->key)->toBe('PROJ-101')
        ->and($issues)->not->toHaveKey('10102');
    Http::assertSentCount(2);
    Http::assertSent(fn (Request $request) => str_starts_with((string) $request['jql'], 'id in (10001,10002,'));
});

it('lists Linear teams filtered by name and paged in memory', function () {
    fakeLinearGraphql(['teams(' => fn (array $variables) => [
        'teams' => ['nodes' => array_map(fn (int $n) => ['id' => "team-{$n}", 'name' => "Team {$n}"], range(1, 60))],
    ]]);
    $integration = TeamIntegration::factory()->linear()->create();

    $first = app(LinearTracker::class)->containers($integration, 'team', 1);
    $second = app(LinearTracker::class)->containers($integration, 'team', 2);

    expect($first['containers'])->toHaveCount(50)
        ->and($first['hasMore'])->toBeTrue()
        ->and($second['containers'])->toHaveCount(10)
        ->and($second['containers'][0])->toBe(['id' => 'team-51', 'name' => 'Team 51'])
        ->and($second['hasMore'])->toBeFalse();
    Http::assertSent(fn (Request $request) => data_get($request->data(), 'variables.filter.name.containsIgnoreCase') === 'team');
});

it('lists active and upcoming Linear cycles', function () {
    fakeLinearGraphql(['cycles(' => ['team' => ['cycles' => ['nodes' => [
        ['id' => 'cycle-2', 'name' => null, 'number' => 13, 'startsAt' => '2026-10-12T00:00:00.000Z', 'endsAt' => '2026-10-26T00:00:00.000Z', 'isActive' => false],
        ['id' => 'cycle-1', 'name' => 'Launch', 'number' => 12, 'startsAt' => '2026-09-28T00:00:00.000Z', 'endsAt' => '2026-10-12T00:00:00.000Z', 'isActive' => true],
    ]]]]]);
    $integration = TeamIntegration::factory()->linear()->create();

    expect(app(LinearTracker::class)->iterations($integration, 'team-1'))->toBe([
        ['id' => 'cycle-1', 'name' => 'Launch', 'state' => 'active', 'startsOn' => '2026-09-28', 'endsOn' => '2026-10-12'],
        ['id' => 'cycle-2', 'name' => 'Cycle 13', 'state' => 'upcoming', 'startsOn' => '2026-10-12', 'endsOn' => '2026-10-26'],
    ]);
});

it('maps Linear cycle issues and search results', function () {
    fakeLinearGraphql([
        'cycle(' => ['cycle' => ['issues' => [
            'nodes' => [linearTrackerIssue('uuid-1', 'ENG-1'), linearTrackerIssue('uuid-2', 'ENG-2', ['assignee' => null, 'estimate' => null])],
            'pageInfo' => ['hasNextPage' => true],
        ]]],
        'searchIssues(' => ['searchIssues' => [
            'nodes' => [linearTrackerIssue('uuid-3', 'ENG-3', ['estimate' => 0.5])],
            'pageInfo' => ['hasNextPage' => false],
        ]],
    ]);
    $integration = TeamIntegration::factory()->linear()->create();

    $cycle = app(LinearTracker::class)->iterationIssues($integration, 'cycle-1');
    $search = app(LinearTracker::class)->search($integration, 'login');

    expect($cycle->truncated)->toBeTrue()
        ->and($cycle->issues[0]->preview(true))->toBe([
            'externalId' => 'uuid-1',
            'key' => 'ENG-1',
            'title' => 'Issue ENG-1',
            'assignee' => 'Sam Lee',
            'estimate' => '2',
            'status' => 'Todo',
            'alreadyImported' => true,
        ])
        ->and($cycle->issues[0]->description)->toBe('About **ENG-1**')
        ->and($cycle->issues[0]->url)->toBe('https://linear.app/acme/issue/ENG-1')
        ->and($cycle->issues[1]->assignee)->toBeNull()
        ->and($search->truncated)->toBeFalse()
        ->and($search->issues[0]->estimate)->toBe('0.5');
    Http::assertSent(fn (Request $request) => data_get($request->data(), 'variables.term') === 'login');
});

it('fetches Linear issues by id', function () {
    fakeLinearGraphql(['issues(' => fn (array $variables) => ['issues' => ['nodes' => array_map(
        fn (string $id) => linearTrackerIssue($id, 'ENG-'.substr($id, -1)),
        array_values(array_diff($variables['ids'], ['uuid-gone'])),
    )]]]);
    $integration = TeamIntegration::factory()->linear()->create();

    $issues = app(LinearTracker::class)->issues($integration, ['uuid-1', 'uuid-gone']);

    expect(array_keys($issues))->toBe(['uuid-1']);
});

it('never lets a Jira board id change the requested path', function () {
    Http::fake();
    $integration = TeamIntegration::factory()->jira()->create();

    expect(app(JiraTracker::class)->iterations($integration, '../../api/3/myself'))->toBe([]);
    Http::assertNothingSent();
});
