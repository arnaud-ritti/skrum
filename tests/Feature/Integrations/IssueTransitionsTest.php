<?php

use App\Enums\ExternalIssueState;
use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\StatusPushRejected;
use App\Models\TeamIntegration;
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

    $issue = resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

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

    resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => $expected]]);
})->with([
    'configured target' => [['completeStatusId' => '10005'], '21'],
    'listed done statuses' => [['doneStatusIds' => ['10005']], '21'],
]);

it('reopens to the configured status, else the first new then in-progress one', function (array $mapping, array $transitions, string $expected) {
    $integration = jiraSyncIntegration(['statusMapping' => ['projects' => ['PROJ' => $mapping]]]);
    fakeJiraTransitions($this->jiraDone, $this->jiraOpen, $transitions);

    resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Open);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => $expected]]);
})->with([
    'first new' => [[], [jiraTransition('41', '3', 'In Progress', 'indeterminate'), jiraTransition('51', '10000', 'To Do', 'new')], '51'],
    'in progress when no new' => [[], [jiraTransition('41', '3', 'In Progress', 'indeterminate')], '41'],
    'configured' => [['reopenStatusId' => '3'], [jiraTransition('41', '3', 'In Progress', 'indeterminate'), jiraTransition('51', '10000', 'To Do', 'new')], '41'],
]);

it('stops an in-progress Jira issue only through a to-do transition', function () {
    $integration = jiraSyncIntegration();
    $started = ['status' => ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']], 'project' => ['key' => 'PROJ']];
    fakeJiraTransitions($started, $started, [jiraTransition('42', '4', 'In Review', 'indeterminate'), jiraTransition('31', '10002', 'Done', 'done')]);

    expect(fn () => resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Open))
        ->toThrow(StatusPushRejected::class)
        ->and(jiraTransitionRequest())->toBeNull();
});

it('fills a required resolution', function (array $allowed, string $expected) {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [jiraTransition('31', '10002', 'Done', 'done', [
        'resolution' => ['required' => true, 'hasDefaultValue' => false, 'allowedValues' => $allowed],
    ])]);

    resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

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

    expect(fn () => resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done))
        ->toThrow(StatusPushRejected::class, 'Jira requires more fields to close PROJ-1. Close it in Jira.')
        ->and(jiraTransitionRequest())->toBeNull();
});

it('explains when no transition reaches the target', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [jiraTransition('11', '3', 'In Progress', 'indeterminate')]);

    expect(fn () => resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done))
        ->toThrow(StatusPushRejected::class, 'No transition to a done status is available for PROJ-1.')
        ->and(jiraTransitionRequest())->toBeNull();
});

it('skips the transition when the issue is already there', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraDone, $this->jiraDone, []);

    $issue = resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

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
        jiraDataCenterUrl('rest/api/2/issue/10001?*') => function () use (&$posted) {
            return Http::response(jiraTrackerIssue('10001', 'OPS-1', [
                'description' => null,
                'project' => ['key' => 'OPS'],
                'status' => $posted
                    ? ['id' => '6', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']]
                    : ['id' => '1', 'name' => 'Open', 'statusCategory' => ['key' => 'new']],
            ]));
        },
        jiraDataCenterUrl('rest/api/2/issue/10001/transitions*') => function (Request $request) use (&$posted) {
            $posted = $posted || $request->method() === 'POST';

            return $request->method() === 'POST'
                ? Http::response(null, 204)
                : Http::response(['transitions' => [jiraTransition('2', '6', 'Closed', 'done')]]);
        },
    ]);

    $issue = resolve(Trackers::class)->syncing(IntegrationProvider::JiraDataCenter)->transition($integration, '10001', ExternalIssueState::Done);

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
        'issueUpdate' => function (array $variables) use (&$mutations, &$current, $target): array {
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
        'issues(' => function () use (&$current): array {
            return ['issues' => ['nodes' => [linearTrackerIssue('lin-1', 'ENG-1', [
                'state' => ['id' => "st-{$current}", 'name' => $current, 'type' => $current],
                'team' => ['key' => 'ENG'],
            ])]]];
        },
    ]);

    resolve(Trackers::class)->syncing(IntegrationProvider::Linear)->transition($integration, 'lin-1', $target);

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

    $issue = resolve(Trackers::class)->syncing(IntegrationProvider::GitHub)->transition($integration, '9001/3', $target);

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

    expect(resolve(Trackers::class)->syncing(IntegrationProvider::GitHub)->transition($integration, '9001/3', ExternalIssueState::Done))->toBeNull();
    Http::assertNotSent(fn (Request $request) => $request->method() === 'PATCH');
});

it('reads the moved Jira issue directly, not through the lagging search', function () {
    $integration = jiraSyncIntegration();
    $posted = false;
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [jiraTrackerIssue('10001', 'PROJ-1', $this->jiraOpen)], 'isLast' => true]),
        jiraApiUrl('rest/api/3/issue/10001?*') => function () use (&$posted) {
            return Http::response(jiraTrackerIssue('10001', 'PROJ-1', $posted ? $this->jiraDone : $this->jiraOpen));
        },
        jiraApiUrl('rest/api/3/issue/10001/transitions*') => function (Request $request) use (&$posted) {
            $posted = $posted || $request->method() === 'POST';

            return $request->method() === 'POST'
                ? Http::response(null, 204)
                : Http::response(['transitions' => [jiraTransition('31', '10002', 'Done', 'done')]]);
        },
    ]);

    $issue = resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect($issue?->issueStatus?->kind)->toBe('done')
        ->and($issue?->status)->toBe('Done');
});

it('answers the transition target when the moved Jira issue cannot be read back', function () {
    $integration = jiraSyncIntegration();
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [jiraTrackerIssue('10001', 'PROJ-1', $this->jiraOpen)], 'isLast' => true]),
        jiraApiUrl('rest/api/3/issue/10001?*') => Http::response(['errorMessages' => ['Issue does not exist']], 404),
        jiraApiUrl('rest/api/3/issue/10001/transitions*') => fn (Request $request) => $request->method() === 'POST'
            ? Http::response(null, 204)
            : Http::response(['transitions' => [jiraTransition('31', '10002', 'Done', 'done')]]),
    ]);

    $issue = resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect($issue?->key)->toBe('PROJ-1')
        ->and($issue?->status)->toBe('Done')
        ->and($issue?->issueStatus?->id)->toBe('10002')
        ->and($issue?->issueStatus?->kind)->toBe('done')
        ->and($issue?->issueStatus?->container)->toBe('PROJ');
});

it('refuses a reopen transition that requires a resolution', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraDone, $this->jiraOpen, [jiraTransition('51', '10000', 'To Do', 'new', [
        'resolution' => ['required' => true, 'hasDefaultValue' => false, 'allowedValues' => [['name' => 'Done']]],
    ])]);

    expect(fn () => resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Open))
        ->toThrow(StatusPushRejected::class, 'Jira requires more fields to reopen PROJ-1. Reopen it in Jira.')
        ->and(jiraTransitionRequest())->toBeNull();
});

function linearSyncIntegration(): TeamIntegration
{
    enableIntegrations(IntegrationProvider::Linear);
    $integration = TeamIntegration::factory()->linear()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true]])->save();

    return $integration;
}

/**
 * @param  array<int, array<string, mixed>>  $states
 * @param  array<int, array<string, mixed>>  $mutations
 */
function fakeLinearTransition(string $current, array $states, bool $accepted, array &$mutations): void
{
    fakeLinearGraphql([
        'issueUpdate' => function (array $variables) use (&$mutations, $accepted): array {
            $mutations[] = $variables;

            return ['issueUpdate' => ['success' => $accepted]];
        },
        'states(first' => ['issue' => ['team' => ['states' => ['nodes' => $states]]]],
        'issues(' => ['issues' => ['nodes' => [linearTrackerIssue('lin-1', 'ENG-1', [
            'state' => ['id' => "st-{$current}", 'name' => $current, 'type' => $current],
            'team' => ['key' => 'ENG'],
        ])]]],
    ]);
}

it('fails when Linear does not accept the state change', function () {
    $integration = linearSyncIntegration();
    $mutations = [];
    fakeLinearTransition('unstarted', [['id' => 'st-done', 'name' => 'Done', 'type' => 'completed', 'position' => 1]], false, $mutations);

    expect(fn () => resolve(Trackers::class)->syncing(IntegrationProvider::Linear)->transition($integration, 'lin-1', ExternalIssueState::Done))
        ->toThrow(StatusPushRejected::class, 'Linear did not accept this status change.');
});

it('explains when the Linear team has no completed state', function () {
    $integration = linearSyncIntegration();
    $mutations = [];
    fakeLinearTransition('unstarted', [['id' => 'st-todo', 'name' => 'Todo', 'type' => 'unstarted', 'position' => 1]], true, $mutations);

    expect(fn () => resolve(Trackers::class)->syncing(IntegrationProvider::Linear)->transition($integration, 'lin-1', ExternalIssueState::Done))
        ->toThrow(StatusPushRejected::class, 'No transition to a done status is available for ENG-1.')
        ->and($mutations)->toBeEmpty();
});

it('answers the chosen Linear state when the moved issue cannot be read back', function () {
    $integration = linearSyncIntegration();
    $updated = false;
    fakeLinearGraphql([
        'issueUpdate' => function () use (&$updated): array {
            $updated = true;

            return ['issueUpdate' => ['success' => true]];
        },
        'states(first' => ['issue' => ['team' => ['states' => ['nodes' => [['id' => 'st-done', 'name' => 'Done', 'type' => 'completed', 'position' => 1]]]]]],
        'issues(' => function () use (&$updated): array {
            return ['issues' => ['nodes' => $updated ? [] : [linearTrackerIssue('lin-1', 'ENG-1', [
                'state' => ['id' => 'st-todo', 'name' => 'Todo', 'type' => 'unstarted'],
                'team' => ['key' => 'ENG'],
            ])]]];
        },
    ]);

    $issue = resolve(Trackers::class)->syncing(IntegrationProvider::Linear)->transition($integration, 'lin-1', ExternalIssueState::Done);

    expect($issue?->status)->toBe('Done')
        ->and($issue?->issueStatus?->id)->toBe('st-done')
        ->and($issue?->issueStatus?->kind)->toBe('completed');
});

it('leaves a Linear issue that is already completed', function () {
    $integration = linearSyncIntegration();
    $mutations = [];
    fakeLinearTransition('completed', [], true, $mutations);

    $issue = resolve(Trackers::class)->syncing(IntegrationProvider::Linear)->transition($integration, 'lin-1', ExternalIssueState::Done);

    expect($issue?->key)->toBe('ENG-1')
        ->and($mutations)->toBeEmpty();
});

it('leaves a GitHub issue that is already closed as completed', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi(['api.github.com/repositories/9001/issues/3' => Http::response(gitHubIssue(3, ['state' => 'closed', 'state_reason' => 'completed']))]);

    $issue = resolve(Trackers::class)->syncing(IntegrationProvider::GitHub)->transition($integration, '9001/3', ExternalIssueState::Done);

    expect($issue?->key)->toBe('acme/api#3');
    Http::assertNotSent(fn (Request $request) => $request->method() === 'PATCH');
});

it('answers null when the GitHub issue moves away before the update', function (int $status) {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/3' => Http::response(gitHubIssue(3)),
        'api.github.com/repos/acme/api/issues/3' => Http::response(['message' => 'Moved'], $status),
    ]);

    expect(resolve(Trackers::class)->syncing(IntegrationProvider::GitHub)->transition($integration, '9001/3', ExternalIssueState::Done))->toBeNull();
})->with([301, 404, 410]);

it('answers the requested GitHub state when the update response cannot be read', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/3' => Http::response(gitHubIssue(3)),
        'api.github.com/repos/acme/api/issues/3' => Http::response([]),
    ]);

    $issue = resolve(Trackers::class)->syncing(IntegrationProvider::GitHub)->transition($integration, '9001/3', ExternalIssueState::Done);

    expect($issue?->status)->toBe('closed')
        ->and($issue?->issueStatus?->kind)->toBe('completed');
});

it('starts a Jira issue through the configured start status, else the first in-progress one', function (array $mapping, array $transitions, string $expected) {
    $integration = jiraSyncIntegration(['statusMapping' => ['projects' => ['PROJ' => $mapping]]]);
    $started = ['status' => ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']], 'project' => ['key' => 'PROJ']];
    fakeJiraTransitions($this->jiraOpen, $started, $transitions);

    resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Started);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => $expected]]);
})->with([
    'first in progress' => [[], [jiraTransition('31', '10002', 'Done', 'done'), jiraTransition('41', '3', 'In Progress', 'indeterminate'), jiraTransition('42', '4', 'In Review', 'indeterminate')], '41'],
    'configured' => [['startStatusId' => '4'], [jiraTransition('41', '3', 'In Progress', 'indeterminate'), jiraTransition('42', '4', 'In Review', 'indeterminate')], '42'],
    'configured but not reachable' => [['startStatusId' => '9'], [jiraTransition('41', '3', 'In Progress', 'indeterminate')], '41'],
]);

it('explains when no transition reaches an in-progress status', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraOpen, [jiraTransition('31', '10002', 'Done', 'done')]);

    expect(fn () => resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Started))
        ->toThrow(StatusPushRejected::class, 'No transition to an in-progress status is available for PROJ-1.');
});

it('refuses a start transition that needs other fields', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraOpen, [jiraTransition('41', '3', 'In Progress', 'indeterminate', [
        'customfield_10050' => ['required' => true, 'hasDefaultValue' => false],
    ])]);

    expect(fn () => resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Started))
        ->toThrow(StatusPushRejected::class, 'Jira requires more fields to start PROJ-1. Start it in Jira.')
        ->and(jiraTransitionRequest())->toBeNull();
});

it('skips the start when the Jira issue is already in progress', function () {
    $integration = jiraSyncIntegration();
    $started = ['status' => ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']], 'project' => ['key' => 'PROJ']];
    fakeJiraTransitions($started, $started, []);

    resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Started);

    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/transitions'));
});

it('moves Linear issues to the configured start state, else the first started one', function (array $settings, string $expected) {
    enableIntegrations(IntegrationProvider::Linear);
    $integration = TeamIntegration::factory()->linear()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true, ...$settings]])->save();
    $current = 'unstarted';
    $mutations = [];
    fakeLinearGraphql([
        'issueUpdate' => function (array $variables) use (&$mutations, &$current): array {
            $mutations[] = $variables;
            $current = 'started';

            return ['issueUpdate' => ['success' => true]];
        },
        'states(first' => ['issue' => ['team' => ['states' => ['nodes' => [
            ['id' => 'st-review', 'name' => 'In Review', 'type' => 'started', 'position' => 4],
            ['id' => 'st-done', 'name' => 'Done', 'type' => 'completed', 'position' => 5],
            ['id' => 'st-started', 'name' => 'In Progress', 'type' => 'started', 'position' => 3],
            ['id' => 'st-todo', 'name' => 'Todo', 'type' => 'unstarted', 'position' => 1],
        ]]]]],
        'issues(' => function () use (&$current): array {
            return ['issues' => ['nodes' => [linearTrackerIssue('lin-1', 'ENG-1', [
                'state' => ['id' => "st-{$current}", 'name' => $current, 'type' => $current],
                'team' => ['key' => 'ENG'],
            ])]]];
        },
    ]);

    resolve(Trackers::class)->syncing(IntegrationProvider::Linear)->transition($integration, 'lin-1', ExternalIssueState::Started);

    expect($mutations)->toBe([['id' => 'lin-1', 'stateId' => $expected]]);
})->with([
    'first started in workflow order' => [[], 'st-started'],
    'configured' => [['statusMapping' => ['teams' => ['ENG' => ['startStateId' => 'st-review']]]], 'st-review'],
]);
