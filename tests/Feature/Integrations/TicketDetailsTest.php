<?php

use App\Actions\Integrations\ImportPokerTasks;
use App\Actions\Integrations\PreviewPokerImport;
use App\Enums\IntegrationProvider;
use App\Models\PokerTask;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('imports the type and labels of a Jira issue', function () {
    $table = trackerTable();
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', [
        'issuetype' => ['name' => 'Story'],
        'labels' => ['actions', 'csv'],
    ])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001']])
        ->assertCreated();

    $task = PokerTask::query()->where('external_id', '10001')->sole();

    expect($task->external_type)->toBe('Story')
        ->and($task->external_labels)->toBe(['actions', 'csv']);

    Http::assertSent(function (Request $request): bool {
        $fields = $request->data()['fields'] ?? [];
        $fields = is_array($fields) ? $fields : explode(',', (string) $fields);

        return str_contains($request->url(), 'search/jql')
            && in_array('issuetype', $fields, true)
            && in_array('labels', $fields, true);
    });
});

it('stores no labels as null, not as an empty list', function () {
    $table = trackerTable();
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', ['labels' => []])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001']])
        ->assertCreated();

    expect(PokerTask::query()->where('external_id', '10001')->sole()->external_labels)->toBeNull();
});

it('imports the labels of a Linear issue and no type', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    fakeLinearGraphql(['issues(' => ['issues' => ['nodes' => [
        linearTrackerIssue('uuid-1', 'ENG-1', ['labels' => ['nodes' => [['name' => 'backend'], ['name' => 'p1']]]]),
    ]]]]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'linear']), ['external_ids' => ['uuid-1']])
        ->assertCreated();

    $task = PokerTask::query()->where('external_id', 'uuid-1')->sole();

    expect($task->external_labels)->toBe(['backend', 'p1'])
        ->and($task->external_type)->toBeNull();

    Http::assertSent(fn (Request $request) => str_contains((string) ($request->data()['query'] ?? ''), 'labels(first: 10) { nodes { name } }'));
});

it('imports the type and labels of a GitHub issue', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues([7 => gitHubIssue(7, ['labels' => [['name' => 'bug']], 'type' => ['name' => 'Bug']])]),
    ]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'github']), ['external_ids' => ['9001/7']])
        ->assertCreated();

    $task = PokerTask::query()->where('external_id', '9001/7')->sole();

    expect($task->external_labels)->toBe(['bug'])
        ->and($task->external_type)->toBe('Bug');

    Http::assertSent(fn (Request $request) => str_contains((string) ($request->data()['query'] ?? ''), 'issueType { name }'));
});

it('reads the type and labels of a GitHub issue listed from a milestone', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repos/acme/api/issues?*' => Http::response([
            gitHubIssue(1, ['labels' => [['name' => 'ui'], ['name' => 'ui']], 'type' => ['name' => 'Feature']]),
        ]),
    ]);

    app(ImportPokerTasks::class)->fromSource($table['game'], $table['memberPlayer'], $table['integration'], PreviewPokerImport::ModeIteration, '9001/2', null);

    $task = PokerTask::query()->where('poker_game_id', $table['game']->id)->sole();

    expect($task->external_labels)->toBe(['ui'])
        ->and($task->external_type)->toBe('Feature');
});
