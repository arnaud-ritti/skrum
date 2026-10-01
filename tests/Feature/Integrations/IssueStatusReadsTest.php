<?php

use App\Enums\ExternalIssueState;
use App\Enums\ExternalStatusCategory;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\DoneMapping;
use App\Support\Integrations\Trackers\IssueStatus;
use App\Support\Integrations\Trackers\Trackers;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
});

it('reads the status, project and update time of Jira Cloud issues', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $integration = TeamIntegration::factory()->jira()->create();
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', [
        'status' => ['id' => '10003', 'name' => 'In Review', 'statusCategory' => ['key' => 'indeterminate']],
        'project' => ['id' => '10000', 'key' => 'PROJ'],
        'updated' => '2026-10-07T12:15:30.000+0200',
    ])]);

    $issue = app(Trackers::class)->for(IntegrationProvider::Jira)->issues($integration, ['10001'])['10001'];

    expect($issue->status)->toBe('In Review')
        ->and($issue->issueStatus?->id)->toBe('10003')
        ->and($issue->issueStatus?->kind)->toBe('indeterminate')
        ->and($issue->issueStatus?->container)->toBe('PROJ')
        ->and($issue->issueStatus?->updatedAt?->toIso8601String())->toBe('2026-10-07T10:15:30+00:00');

    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/rest/api/3/search/jql')
        && in_array('updated', $request['fields'], true)
        && in_array('project', $request['fields'], true));
});

it('reads the status of Jira Data Center issues through REST v2', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    Http::fake([jiraDataCenterUrl('rest/api/2/search') => Http::response(['issues' => [jiraTrackerIssue('10001', 'OPS-4', [
        'description' => 'Plain text',
        'status' => ['id' => '6', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']],
        'project' => ['key' => 'OPS'],
        'updated' => '2026-10-07T09:00:00.000+0000',
    ])], 'total' => 1])]);

    $issue = app(Trackers::class)->for(IntegrationProvider::JiraDataCenter)->issues($integration, ['10001'])['10001'];

    expect($issue->issueStatus?->kind)->toBe('done')
        ->and($issue->issueStatus?->container)->toBe('OPS')
        ->and(DoneMapping::state($integration, $issue->issueStatus))->toBe(ExternalIssueState::Done);
});

it('reads the state type, team and update time of Linear issues', function () {
    enableIntegrations(IntegrationProvider::Linear);
    $integration = TeamIntegration::factory()->linear()->create();
    fakeLinearGraphql(['issues(' => ['issues' => ['nodes' => [linearTrackerIssue('lin-1', 'ENG-7', [
        'state' => ['id' => 'state-canceled', 'name' => 'Canceled', 'type' => 'canceled'],
        'team' => ['key' => 'ENG'],
        'updatedAt' => '2026-10-07T08:00:00.000Z',
    ])]]]]);

    $issue = app(Trackers::class)->for(IntegrationProvider::Linear)->issues($integration, ['lin-1'])['lin-1'];

    expect($issue->status)->toBe('Canceled')
        ->and($issue->issueStatus?->kind)->toBe('canceled')
        ->and($issue->issueStatus?->container)->toBe('ENG')
        ->and($issue->issueStatus?->updatedAt?->toIso8601String())->toBe('2026-10-07T08:00:00+00:00');
});

it('reads open and closed GitHub issues with their state reason', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues([7 => gitHubIssue(7, [
            'state' => 'closed',
            'state_reason' => 'not_planned',
            'updated_at' => '2026-10-07T07:00:00Z',
        ])]),
    ]);

    $issue = app(Trackers::class)->for(IntegrationProvider::GitHub)->issues($integration, ['9001/7'])['9001/7'];

    expect($issue->issueStatus?->kind)->toBe(IssueStatus::GitHubNotPlanned)
        ->and($issue->issueStatus?->container)->toBe('9001')
        ->and($issue->issueStatus?->updatedAt?->toIso8601String())->toBe('2026-10-07T07:00:00+00:00');
});

it('maps source states to done or open', function (IntegrationProvider $provider, array $settings, string $kind, string $statusId, ExternalIssueState $expected) {
    $integration = TeamIntegration::factory()->make(['provider' => $provider, 'settings' => $settings]);

    expect(DoneMapping::state($integration, new IssueStatus($statusId, null, $kind, 'PROJ', null)))->toBe($expected);
})->with([
    'jira done' => [IntegrationProvider::Jira, [], 'done', '10002', ExternalIssueState::Done],
    'jira in progress' => [IntegrationProvider::Jira, [], 'indeterminate', '3', ExternalIssueState::Open],
    'jira done status listed' => [IntegrationProvider::Jira, ['statusMapping' => ['projects' => ['PROJ' => ['doneStatusIds' => ['10002']]]]], 'done', '10002', ExternalIssueState::Done],
    'jira done status not listed' => [IntegrationProvider::Jira, ['statusMapping' => ['projects' => ['PROJ' => ['doneStatusIds' => ['10002']]]]], 'done', '10005', ExternalIssueState::Open],
    'jira dc done' => [IntegrationProvider::JiraDataCenter, [], 'done', '6', ExternalIssueState::Done],
    'linear completed' => [IntegrationProvider::Linear, [], 'completed', 's1', ExternalIssueState::Done],
    'linear canceled by default' => [IntegrationProvider::Linear, [], 'canceled', 's2', ExternalIssueState::Done],
    'linear canceled not done' => [IntegrationProvider::Linear, ['treatCanceledAsDone' => false], 'canceled', 's2', ExternalIssueState::Open],
    'linear started' => [IntegrationProvider::Linear, [], 'started', 's3', ExternalIssueState::Open],
    'github completed' => [IntegrationProvider::GitHub, [], 'completed', 'closed', ExternalIssueState::Done],
    'github not planned by default' => [IntegrationProvider::GitHub, [], 'not_planned', 'closed', ExternalIssueState::Done],
    'github not planned not done' => [IntegrationProvider::GitHub, ['treatCanceledAsDone' => false], 'not_planned', 'closed', ExternalIssueState::Open],
    'github open' => [IntegrationProvider::GitHub, [], 'open', 'open', ExternalIssueState::Open],
]);

it('maps source states to poker status categories', function (IntegrationProvider $provider, string $kind, ExternalStatusCategory $expected) {
    expect(DoneMapping::category($provider, $kind))->toBe($expected);
})->with([
    [IntegrationProvider::Jira, 'new', ExternalStatusCategory::Todo],
    [IntegrationProvider::Jira, 'indeterminate', ExternalStatusCategory::InProgress],
    [IntegrationProvider::JiraDataCenter, 'done', ExternalStatusCategory::Done],
    [IntegrationProvider::Linear, 'triage', ExternalStatusCategory::Todo],
    [IntegrationProvider::Linear, 'backlog', ExternalStatusCategory::Todo],
    [IntegrationProvider::Linear, 'unstarted', ExternalStatusCategory::Todo],
    [IntegrationProvider::Linear, 'started', ExternalStatusCategory::InProgress],
    [IntegrationProvider::Linear, 'completed', ExternalStatusCategory::Done],
    [IntegrationProvider::Linear, 'canceled', ExternalStatusCategory::Done],
    [IntegrationProvider::GitHub, 'open', ExternalStatusCategory::Todo],
    [IntegrationProvider::GitHub, 'completed', ExternalStatusCategory::Done],
    [IntegrationProvider::GitHub, 'not_planned', ExternalStatusCategory::Done],
]);

it('asks Jira only for tracked issues updated since the cursor', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $integration = TeamIntegration::factory()->jira()->create();
    fakeJiraTrackerApi([jiraTrackerIssue('10002', 'PROJ-2', ['updated' => '2026-10-07T10:25:00.000+0000'])]);

    $changed = app(Trackers::class)->syncing(IntegrationProvider::Jira)
        ->changedIssues($integration, ['10001', '10002'], CarbonImmutable::parse('2026-10-07 10:13:00'));

    expect(array_map('strval', array_keys($changed)))->toBe(['10002']);
    Http::assertSent(fn (Request $request) => $request['jql'] === 'id in (10001,10002) AND updated >= "-17m"');
});

it('reads Jira issues one by one when a deleted id makes the batch fail', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $integration = TeamIntegration::factory()->jira()->create();
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['errorMessages' => ["An issue with key '10009' does not exist for field 'id'."]], 400),
        jiraApiUrl('rest/api/3/issue/10001*') => Http::response(jiraTrackerIssue('10001', 'PROJ-1')),
        jiraApiUrl('rest/api/3/issue/10009*') => Http::response(['errorMessages' => ['Issue does not exist']], 404),
    ]);

    $issues = app(Trackers::class)->for(IntegrationProvider::Jira)->issues($integration, ['10001', '10009']);

    expect(array_map('strval', array_keys($issues)))->toBe(['10001']);
    Http::assertSent(fn (Request $request) => str_contains($request->url(), '/rest/api/3/issue/10001?fields='));
});

it('filters Linear issues by id and update time', function () {
    enableIntegrations(IntegrationProvider::Linear);
    $integration = TeamIntegration::factory()->linear()->create();
    $variables = null;
    fakeLinearGraphql(['updatedAt: {gte' => function (array $given) use (&$variables) {
        $variables = $given;

        return ['issues' => ['nodes' => [linearTrackerIssue('lin-2', 'ENG-2', [
            'state' => ['id' => 'st-9', 'name' => 'Done', 'type' => 'completed'],
            'team' => ['key' => 'ENG'],
            'updatedAt' => '2026-10-07T10:20:00.000Z',
        ])]]];
    }]);

    $changed = app(Trackers::class)->syncing(IntegrationProvider::Linear)
        ->changedIssues($integration, ['lin-1', 'lin-2'], CarbonImmutable::parse('2026-10-07 10:13:00'));

    expect(array_keys($changed))->toBe(['lin-2'])
        ->and($variables)->toBe(['ids' => ['lin-1', 'lin-2'], 'since' => '2026-10-07T10:13:00Z']);
});

it('lists changed GitHub issues per repository and keeps the tracked ones', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi([
        'api.github.com/repos/acme/api/issues?*' => Http::response([
            gitHubIssue(1, ['state' => 'closed', 'state_reason' => 'completed', 'updated_at' => '2026-10-07T10:20:00Z']),
            gitHubIssue(2),
            gitHubIssue(5, ['pull_request' => ['url' => 'https://api.github.com/repos/acme/api/pulls/5']]),
        ]),
    ]);

    $changed = app(Trackers::class)->syncing(IntegrationProvider::GitHub)
        ->changedIssues($integration, ['9001/1', '9001/5'], CarbonImmutable::parse('2026-10-07 10:13:00'));

    expect(array_keys($changed))->toBe(['9001/1']);
    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/repos/acme/api/issues?')
        && $request['since'] === '2026-10-07T10:13:00Z'
        && $request['state'] === 'all');
});

it('drops changed GitHub items of another repository', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi([
        'api.github.com/repos/acme/api/issues?*' => Http::response([
            gitHubIssue(1, [
                'html_url' => 'https://github.com/evil/other/issues/1',
                'repository_url' => 'https://api.github.com/repos/evil/other',
            ]),
        ]),
    ]);

    $changed = app(Trackers::class)->syncing(IntegrationProvider::GitHub)
        ->changedIssues($integration, ['9001/1'], CarbonImmutable::parse('2026-10-07 10:13:00'));

    expect($changed)->toBe([]);
});

it('lists the statuses of a Jira project and the states of a Linear team', function () {
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
    $jira = TeamIntegration::factory()->jira()->create();
    $linear = TeamIntegration::factory()->linear()->create();
    Http::fake([jiraApiUrl('rest/api/3/project/PROJ/statuses') => Http::response([
        ['id' => '1', 'name' => 'Story', 'statuses' => [
            ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
            ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
        ]],
        ['id' => '2', 'name' => 'Bug', 'statuses' => [['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']]]],
    ])]);
    fakeLinearGraphql(['teams(first: 1' => ['teams' => ['nodes' => [['states' => ['nodes' => [
        ['id' => 'st-2', 'name' => 'Done', 'type' => 'completed', 'position' => 3],
        ['id' => 'st-1', 'name' => 'Todo', 'type' => 'unstarted', 'position' => 1],
    ]]]]]]]);
    $trackers = app(Trackers::class);

    expect($trackers->syncing(IntegrationProvider::Jira)->statuses($jira, 'PROJ'))->toBe([
        ['id' => '10000', 'name' => 'To Do', 'category' => 'todo'],
        ['id' => '10002', 'name' => 'Done', 'category' => 'done'],
    ])
        ->and($trackers->syncing(IntegrationProvider::Linear)->statuses($linear, 'ENG'))->toBe([
            ['id' => 'st-1', 'name' => 'Todo', 'category' => 'todo'],
            ['id' => 'st-2', 'name' => 'Done', 'category' => 'done'],
        ])
        ->and($trackers->syncing(IntegrationProvider::Jira)->statuses($jira, '../x'))->toBe([]);
});
