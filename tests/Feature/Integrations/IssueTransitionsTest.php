<?php

use App\Enums\ExternalIssueState;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\StatusPushRejected;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->jiraOpen = ['status' => ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']], 'project' => ['key' => 'PROJ']];
    $this->jiraDone = ['status' => ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']], 'project' => ['key' => 'PROJ']];
});

function jiraTransitionRequest(): ?Request
{
    return collect(Http::recorded())
        ->map(fn (array $pair): Request => $pair[0])
        ->first(fn (Request $request): bool => $request->method() === 'POST' && str_ends_with($request->url(), '/transitions'));
}

function jiraSyncIntegration(array $settings = []): TeamIntegration
{
    enableIntegrations(IntegrationProvider::Jira);
    $integration = TeamIntegration::factory()->jira()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true, ...$settings]])->save();

    return $integration;
}

it('moves a Jira issue through the preferred done transition', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [
        jiraTransition('11', '3', 'In Progress', 'indeterminate'),
        jiraTransition('21', '10005', 'Closed', 'done'),
        jiraTransition('31', '10002', 'Done', 'done'),
    ]);

    $issue = app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => '31']])
        ->and($issue?->issueStatus?->kind)->toBe('done');
    Http::assertSent(fn (Request $request) => $request->method() === 'GET'
        && str_contains($request->url(), '/rest/api/3/issue/10001/transitions?expand=transitions.fields'));
});

it('uses the configured complete status, else only the listed done statuses', function (array $mapping, string $expected) {
    $integration = jiraSyncIntegration(['statusMapping' => ['projects' => ['PROJ' => $mapping]]]);
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [
        jiraTransition('21', '10005', 'Closed', 'done'),
        jiraTransition('31', '10002', 'Done', 'done'),
    ]);

    app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => $expected]]);
})->with([
    'configured target' => [['completeStatusId' => '10005'], '21'],
    'listed done statuses' => [['doneStatusIds' => ['10005']], '21'],
]);

it('reopens to the configured status, else the first new then in-progress one', function (array $mapping, array $transitions, string $expected) {
    $integration = jiraSyncIntegration(['statusMapping' => ['projects' => ['PROJ' => $mapping]]]);
    fakeJiraTransitions($this->jiraDone, $this->jiraOpen, $transitions);

    app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Open);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => $expected]]);
})->with([
    'first new' => [[], [jiraTransition('41', '3', 'In Progress', 'indeterminate'), jiraTransition('51', '10000', 'To Do', 'new')], '51'],
    'in progress when no new' => [[], [jiraTransition('41', '3', 'In Progress', 'indeterminate')], '41'],
    'configured' => [['reopenStatusId' => '3'], [jiraTransition('41', '3', 'In Progress', 'indeterminate'), jiraTransition('51', '10000', 'To Do', 'new')], '41'],
]);

it('fills a required resolution', function (array $allowed, string $expected) {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [jiraTransition('31', '10002', 'Done', 'done', [
        'resolution' => ['required' => true, 'hasDefaultValue' => false, 'allowedValues' => $allowed],
    ])]);

    app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => '31'], 'fields' => ['resolution' => ['name' => $expected]]]);
})->with([
    'done first' => [[['name' => "Won't Do"], ['name' => 'Fixed'], ['name' => 'Done']], 'Done'],
    'fixed next' => [[['name' => "Won't Do"], ['name' => 'Fixed']], 'Fixed'],
    'first otherwise' => [[['name' => 'Duplicate'], ['name' => "Won't Do"]], 'Duplicate'],
]);

it('refuses a transition that needs other fields', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [jiraTransition('31', '10002', 'Done', 'done', [
        'customfield_10050' => ['required' => true, 'hasDefaultValue' => false],
    ])]);

    expect(fn () => app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done))
        ->toThrow(StatusPushRejected::class, 'Jira requires more fields to close PROJ-1. Close it in Jira.');
    expect(jiraTransitionRequest())->toBeNull();
});

it('explains when no transition reaches the target', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [jiraTransition('11', '3', 'In Progress', 'indeterminate')]);

    expect(fn () => app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done))
        ->toThrow(StatusPushRejected::class, 'No transition to a done status is available for PROJ-1.');
});

it('skips the transition when the issue is already there', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraDone, $this->jiraDone, []);

    $issue = app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect($issue?->key)->toBe('PROJ-1');
    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/transitions'));
});

it('transitions Jira Data Center issues through REST v2', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $posted = false;
    Http::fake([
        jiraDataCenterUrl('rest/api/2/search') => function () use (&$posted) {
            return Http::response(['total' => 1, 'issues' => [jiraTrackerIssue('10001', 'OPS-1', [
                'description' => null,
                'project' => ['key' => 'OPS'],
                'status' => $posted
                    ? ['id' => '6', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']]
                    : ['id' => '1', 'name' => 'Open', 'statusCategory' => ['key' => 'new']],
            ])]]);
        },
        jiraDataCenterUrl('rest/api/2/issue/10001/transitions*') => function (Request $request) use (&$posted) {
            $posted = $posted || $request->method() === 'POST';

            return $request->method() === 'POST'
                ? Http::response(null, 204)
                : Http::response(['transitions' => [jiraTransition('2', '6', 'Closed', 'done')]]);
        },
    ]);

    $issue = app(Trackers::class)->syncing(IntegrationProvider::JiraDataCenter)->transition($integration, '10001', ExternalIssueState::Done);

    expect($issue?->status)->toBe('Closed');
    Http::assertSent(fn (Request $request) => $request->method() === 'POST' && $request->url() === 'https://jira.example.com/rest/api/2/issue/10001/transitions');
});

it('moves Linear issues to the first completed or unstarted state', function (array $settings, ExternalIssueState $target, string $expected) {
    enableIntegrations(IntegrationProvider::Linear);
    $integration = TeamIntegration::factory()->linear()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true, ...$settings]])->save();
    $current = $target === ExternalIssueState::Done ? 'unstarted' : 'completed';
    $mutations = [];
    fakeLinearGraphql([
        'issueUpdate' => function (array $variables) use (&$mutations, &$current, $target) {
            $mutations[] = $variables;
            $current = $target === ExternalIssueState::Done ? 'completed' : 'unstarted';

            return ['issueUpdate' => ['success' => true]];
        },
        'states(first' => ['issue' => ['team' => ['states' => ['nodes' => [
            ['id' => 'st-done-late', 'name' => 'Shipped', 'type' => 'completed', 'position' => 5],
            ['id' => 'st-done', 'name' => 'Done', 'type' => 'completed', 'position' => 2],
            ['id' => 'st-todo', 'name' => 'Todo', 'type' => 'unstarted', 'position' => 1],
            ['id' => 'st-backlog', 'name' => 'Backlog', 'type' => 'backlog', 'position' => 0],
        ]]]]],
        'issues(' => function () use (&$current) {
            return ['issues' => ['nodes' => [linearTrackerIssue('lin-1', 'ENG-1', [
                'state' => ['id' => "st-{$current}", 'name' => $current, 'type' => $current],
                'team' => ['key' => 'ENG'],
            ])]]];
        },
    ]);

    app(Trackers::class)->syncing(IntegrationProvider::Linear)->transition($integration, 'lin-1', $target);

    expect($mutations)->toBe([['id' => 'lin-1', 'stateId' => $expected]]);
})->with([
    'complete' => [[], ExternalIssueState::Done, 'st-done'],
    'complete configured' => [['statusMapping' => ['teams' => ['ENG' => ['completeStateId' => 'st-done-late']]]], ExternalIssueState::Done, 'st-done-late'],
    'reopen' => [[], ExternalIssueState::Open, 'st-todo'],
]);

it('closes GitHub issues as completed and reopens them', function (string $state, ExternalIssueState $target, array $expected) {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/3' => Http::response(gitHubIssue(3, ['state' => $state])),
        'api.github.com/repos/acme/api/issues/3' => fn (Request $request) => Http::response(gitHubIssue(3, [
            'state' => $request['state'],
            'state_reason' => $request['state_reason'] ?? null,
        ])),
    ]);

    $issue = app(Trackers::class)->syncing(IntegrationProvider::GitHub)->transition($integration, '9001/3', $target);

    expect($issue?->issueStatus?->id)->toBe($expected['state']);
    Http::assertSent(fn (Request $request) => $request->method() === 'PATCH'
        && $request->url() === 'https://api.github.com/repos/acme/api/issues/3'
        && $request->data() === $expected);
})->with([
    'close' => ['open', ExternalIssueState::Done, ['state' => 'closed', 'state_reason' => 'completed']],
    'reopen' => ['closed', ExternalIssueState::Open, ['state' => 'open']],
]);

it('answers null for issues the source no longer has', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi(['api.github.com/repositories/9001/issues/3' => Http::response(['message' => 'Not Found'], 404)]);

    expect(app(Trackers::class)->syncing(IntegrationProvider::GitHub)->transition($integration, '9001/3', ExternalIssueState::Done))->toBeNull();
    Http::assertNotSent(fn (Request $request) => $request->method() === 'PATCH');
});
