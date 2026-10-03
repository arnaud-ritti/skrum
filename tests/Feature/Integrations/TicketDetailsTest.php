<?php

use App\Actions\Integrations\ImportPokerTasks;
use App\Actions\Integrations\PreviewPokerImport;
use App\Enums\IntegrationProvider;
use App\Models\PokerTask;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
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

    resolve(ImportPokerTasks::class)->fromSource($table['game'], $table['memberPlayer'], $table['integration'], PreviewPokerImport::ModeIteration, '9001/2', null);

    $task = PokerTask::query()->where('poker_game_id', $table['game']->id)->sole();

    expect($task->external_labels)->toBe(['ui'])
        ->and($task->external_type)->toBe('Feature');
});

it('follows the source on refresh', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['external_id' => '10001', 'external_key' => 'PROJ-1', 'external_labels' => ['old'], 'external_type' => 'Bug']);
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', ['issuetype' => ['name' => 'Story'], 'labels' => ['new']])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.refresh.store', $table['game']))
        ->assertOk();

    expect($task->fresh()->external_labels)->toBe(['new'])
        ->and($task->fresh()->external_type)->toBe('Story');
});

it('shows ticket details and the criteria section to a guest, and the assignee to the team only', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game'], [
        'external_type' => 'Story',
        'external_labels' => ['csv'],
        'external_assignee' => 'Jane Doe',
        'description' => "Export invoices.\n\n## Acceptance criteria\n\n- UTF-8\n- semicolon",
    ]);
    $guest = pokerGuest($table['game']);

    $payload = $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->json('tasks.0');

    expect($payload['external']['type'])->toBe('Story')
        ->and($payload['external']['labels'])->toBe(['csv'])
        ->and($payload['external'])->not->toHaveKey('assignee')
        ->and($payload['acceptanceCriteriaHtml'])->toContain('<li>UTF-8</li>')
        ->and($payload['descriptionHtml'])->toContain('Export invoices.')
        ->and($payload['descriptionHtml'])->not->toContain('UTF-8')
        ->and($payload['description'])->toBe($task->description);

    $memberPayload = $this->actingAs($table['member'])
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->json('tasks.0.external');

    expect($memberPayload['assignee'])->toBe('Jane Doe')
        ->and($memberPayload['type'])->toBe('Story')
        ->and($memberPayload['labels'])->toBe(['csv']);
});

it('splits the criteria of a task typed by hand and leaves its stored description whole', function () {
    $table = trackerTable();
    $task = PokerTask::factory()->create([
        'poker_game_id' => $table['game']->id,
        'description' => "**Acceptance criteria:**\n- one",
    ]);

    $this->actingAs($table['member'])
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.descriptionHtml', '')
        ->assertJsonPath('tasks.0.acceptanceCriteriaHtml', fn (string $html) => str_contains($html, '<li>one</li>'))
        ->assertJsonPath('tasks.0.description', "**Acceptance criteria:**\n- one")
        ->assertJsonPath('tasks.0.external', null);

    expect($task->fresh()->description)->toBe("**Acceptance criteria:**\n- one");
});

it('never serves the html cached for the whole description', function () {
    $table = trackerTable();
    $description = "Intro\n\n## Acceptance criteria\n\n- one";
    $task = PokerTask::factory()->create(['poker_game_id' => $table['game']->id, 'description' => $description]);
    Cache::forever("poker-task-description:{$task->id}:".hash('xxh128', $description), '<p>stale</p>');

    $this->actingAs($table['member'])
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.descriptionHtml', fn (string $html) => ! str_contains($html, 'stale') && str_contains($html, 'Intro'));
});
