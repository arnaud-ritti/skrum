<?php

use App\Actions\Integrations\PokerTaskSync;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Jobs\SyncTaskEstimate;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Trackers\EstimateRejected;
use App\Support\Integrations\Trackers\GitHubTracker;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->travelTo(Date::parse('2026-10-07 12:00:00'));
});

/**
 * @param  array<string, mixed>  $table
 */
function gitHubSyncTask(array $table, ?string $estimate, int $number = 7): PokerTask
{
    return importedPokerTask($table['game'], [
        'external_id' => "9001/{$number}",
        'external_key' => "acme/api#{$number}",
        'estimate' => $estimate,
        'estimate_numeric' => $estimate === null ? null : PokerDeck::numericValue($estimate),
        'estimated_at' => $estimate === null ? null : now(),
        'needs_sync' => true,
    ], IntegrationProvider::GitHub);
}

function runGitHubSync(PokerTask $task): PokerTask
{
    app()->call([new SyncTaskEstimate($task->id), 'handle']);

    return $task->fresh() ?? $task;
}

/**
 * @return array<int, Request>
 */
function gitHubPatches(): array
{
    return collect(Http::recorded())
        ->map(fn (array $pair): Request => $pair[0])
        ->filter(fn (Request $request): bool => $request->method() === 'PATCH')
        ->values()
        ->all();
}

it('lists repositories and open milestones', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.containers.index', [$table['game'], 'github', 'q' => 'API']))
        ->assertOk()
        ->assertExactJson(['containers' => [['id' => '9001', 'name' => 'acme/api']], 'hasMore' => false]);

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.iterations.index', [$table['game'], 'github', 'container' => '9001']))
        ->assertOk()
        ->assertExactJson([
            ['id' => '9001/3', 'name' => 'Sprint 3', 'state' => 'upcoming', 'startsOn' => null, 'endsOn' => '2026-10-20'],
            ['id' => '9001/2', 'name' => 'Sprint 2', 'state' => 'active', 'startsOn' => null, 'endsOn' => '2026-10-10'],
            ['id' => '9001/4', 'name' => 'Someday', 'state' => 'upcoming', 'startsOn' => null, 'endsOn' => null],
            ['id' => '9001/1', 'name' => 'Late', 'state' => 'upcoming', 'startsOn' => null, 'endsOn' => '2026-09-01'],
        ]);
});

it('previews the open issues of a milestone without pull requests', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'github']), ['mode' => 'iteration', 'iteration_id' => '9001/2'])
        ->assertOk()
        ->assertJsonPath('truncated', false)
        ->assertJsonCount(2, 'issues')
        ->assertJsonPath('issues.0.externalId', '9001/1')
        ->assertJsonPath('issues.0.key', 'acme/api#1')
        ->assertJsonPath('issues.0.assignee', 'octocat')
        ->assertJsonPath('issues.1.key', 'acme/api#2');

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/repos/acme/api/issues?')
        && $request['milestone'] === '2'
        && $request['state'] === 'open');
});

it('searches one repository only', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();
    $url = route('poker.imports.preview.store', [$table['game'], 'github']);

    $this->actingAs($table['member'])->postJson($url, ['mode' => 'query', 'query' => 'login bug'])
        ->assertJsonValidationErrors(['container' => 'Choose a repository to search in.']);

    $this->actingAs($table['member'])
        ->postJson($url, ['mode' => 'query', 'query' => 'login bug repo:evil/secrets org:evil', 'container' => '9001'])
        ->assertOk()
        ->assertJsonPath('issues.0.key', 'acme/api#7');

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/search/issues')
        && $request['q'] === 'login bug repo:acme/api is:issue');
});

it('imports issues with the block removed from the description and read as the source estimate', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues([7 => gitHubIssue(7, ['body' => "Steps\n\n".renderedEstimateBlock('XL')])]),
    ]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.imports.store', [$table['game'], 'github']), ['external_ids' => ['9001/7']])
        ->assertCreated()
        ->assertExactJson(['imported' => 1, 'skipped' => 0]);

    $task = PokerTask::query()->where('poker_game_id', $table['game']->id)->sole();

    expect($task->description)->toBe('Steps')
        ->and($task->external_estimate)->toBe('XL')
        ->and($task->external_key)->toBe('acme/api#7')
        ->and($task->external_site)->toBe('4242')
        ->and($task->external_url)->toBe('https://github.com/acme/api/issues/7');
});

it('rewrites only the managed block, for any deck', function () {
    $table = trackerTable(IntegrationProvider::GitHub, IntegrationAccess::Write, PokerDeck::Tshirt);
    $body = "Keep *this*\r\n\r\nexactly.";
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => $body])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);
    $task = gitHubSyncTask($table, 'XL');

    expect(PokerTaskSync::for($table['game'])->unsupportedReason($task))->toBeNull()
        ->and(runGitHubSync($task)->synced_at)->not->toBeNull()
        ->and(gitHubPatches())->toHaveCount(1)
        ->and(gitHubPatches()[0]['body'])->toBe("{$body}\n\n".renderedEstimateBlock('XL'));
});

it('does not write when the block already holds the estimate', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => "Text\n\n".renderedEstimateBlock('5')])),
    ]);

    expect(runGitHubSync(gitHubSyncTask($table, '5'))->needs_sync)->toBeFalse()
        ->and(gitHubPatches())->toBeEmpty();
});

it('removes the block when the estimate is cleared', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => "Text\n\n".renderedEstimateBlock('3')])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);

    runGitHubSync(gitHubSyncTask($table, null));

    expect(gitHubPatches()[0]['body'])->toBe('Text');
});

it('restarts when the description changed meanwhile', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    $patches = 0;
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::sequence()
            ->push(gitHubIssue(7, ['body' => 'First']))
            ->push(gitHubIssue(7, ['body' => 'Second'])),
        'api.github.com/repos/acme/api/issues/7' => function (Request $request) use (&$patches) {
            $patches++;

            return Http::response(gitHubIssue(7, ['body' => $patches === 1 ? 'Edited meanwhile' : $request['body']]));
        },
    ]);

    expect(runGitHubSync(gitHubSyncTask($table, '8'))->synced_at)->not->toBeNull()
        ->and(gitHubPatches())->toHaveCount(2)
        ->and(gitHubPatches()[1]['body'])->toBe("Second\n\n".renderedEstimateBlock('8'));
});

it('gives up after three changed descriptions', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => 'Body'])),
        'api.github.com/repos/acme/api/issues/7' => Http::response(gitHubIssue(7, ['body' => 'Someone else'])),
    ]);

    $task = runGitHubSync(gitHubSyncTask($table, '8'));

    expect($task->needs_sync)->toBeTrue()
        ->and($task->sync_error)->toBe('The issue description kept changing. Try again.')
        ->and(gitHubPatches())->toHaveCount(3);
});

it('refuses bodies over the GitHub limit and missing issues', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => str_repeat('a', 65530)])),
        'api.github.com/repositories/9001/issues/8' => Http::response(['message' => 'Not Found'], 404),
    ]);

    expect(runGitHubSync(gitHubSyncTask($table, '8'))->sync_error)->toBe('The issue description is too long to add the estimate.')
        ->and(runGitHubSync(gitHubSyncTask($table, '8', 8))->sync_error)->toBe('This issue was not found in GitHub.')
        ->and(gitHubPatches())->toBeEmpty();
});

it('marks tasks of read-only GitHub connections as unsupported', function () {
    $table = trackerTable(IntegrationProvider::GitHub, IntegrationAccess::Read);
    $task = gitHubSyncTask($table, '5');

    expect(PokerTaskSync::for($table['game'])->unsupportedReason($task))->toBe('This GitHub connection is read-only.');
});

it('reads tracked issues in batches of 100 per repository', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues(collect(range(1, 150))->reject(fn (int $number) => $number === 42)->mapWithKeys(fn (int $number) => [$number => gitHubIssue($number)])->all()),
    ]);
    $integration = TeamIntegration::factory()->gitHub()->create();
    $ids = array_map(fn (int $number): string => "9001/{$number}", range(1, 150));

    $issues = resolve(GitHubTracker::class)->issues($integration, $ids);

    expect($issues)->toHaveCount(149)
        ->and($issues)->not->toHaveKey('9001/42')
        ->and($issues['9001/7']->key)->toBe('acme/api#7')
        ->and(Http::recorded(fn (Request $request) => $request->url() === 'https://api.github.com/graphql'))->toHaveCount(2);
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.github.com/graphql'
        && $request['variables'] === ['owner' => 'acme', 'name' => 'api']
        && substr_count($request['query'], ': issue(number: ') === 100);
    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/repositories/9001/issues/'));
});

it('refuses unsafe GitHub references', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9003' => Http::response(gitHubRepository(9003, 'acme/..')),
    ]);
    $integration = TeamIntegration::factory()->gitHub()->create();
    $tracker = resolve(GitHubTracker::class);

    expect($tracker->iterations($integration, '../9001'))->toBeEmpty()
        ->and($tracker->iterationIssues($integration, '9001/../2')->issues)->toBeEmpty()
        ->and($tracker->issues($integration, ['../1', '9001/abc']))->toBeEmpty()
        ->and(fn () => $tracker->writeEstimate($integration, '9001/../7', '3'))->toThrow(EstimateRejected::class)
        ->and(fn () => $tracker->iterations($integration, '9003'))->toThrow(ProviderRejected::class);

    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/milestones'));
});

it('keeps search results to the chosen repository whatever the query smuggles in', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/search/issues*' => Http::response(['total_count' => 2, 'incomplete_results' => false, 'items' => [
            gitHubIssue(7),
            gitHubIssue(8, ['repository_url' => 'https://api.github.com/repos/other/repo', 'html_url' => 'https://github.com/other/repo/issues/8']),
            gitHubIssue(9, ['repository_url' => 'https://api.github.com/repos/ACME/API', 'html_url' => 'https://github.com/ACME/API/issues/9']),
        ]]),
    ]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'github']), ['mode' => 'query', 'query' => '(repo:other/repo) bug OR(org:evil) -user:x is:pr', 'container' => '9001'])
        ->assertOk()
        ->assertJsonCount(2, 'issues')
        ->assertJsonPath('issues.0.key', 'acme/api#7')
        ->assertJsonPath('issues.1.key', 'ACME/API#9');

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/search/issues')
        && $request['q'] === 'bug OR repo:acme/api is:issue');
});

it('refuses issue numbers GitHub GraphQL cannot read', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();
    $integration = TeamIntegration::factory()->gitHub()->create();

    expect(GitHubTracker::issueReference('9001/007'))->toBeNull()
        ->and(GitHubTracker::issueReference('9001/2147483648'))->toBeNull()
        ->and(GitHubTracker::issueReference('9001/2147483647'))->toBe(['9001', '2147483647'])
        ->and(resolve(GitHubTracker::class)->issues($integration, ['9001/007', '9001/2147483648', '9001/0']))->toBeEmpty();

    Http::assertNotSent(fn (Request $request) => $request->url() === 'https://api.github.com/graphql');
});

it('reports a transferred issue as not found on write-back', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(['message' => 'Moved Permanently', 'url' => 'https://api.github.com/repositories/9002/issues/1'], 301),
    ]);

    expect(runGitHubSync(gitHubSyncTask($table, '8'))->sync_error)->toBe('This issue was not found in GitHub.')
        ->and(gitHubPatches())->toBeEmpty();
});

it('reads closed issues on refresh', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues([7 => gitHubIssue(7, ['state' => 'closed', 'state_reason' => 'completed'])]),
    ]);
    $integration = TeamIntegration::factory()->gitHub()->create();

    expect(resolve(GitHubTracker::class)->issues($integration, ['9001/7'])['9001/7']->status)->toBe('closed');
});

it('fails the refresh on GraphQL errors other than missing issues', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => Http::response(['data' => null, 'errors' => [['type' => 'RATE_LIMITED', 'message' => 'API rate limit exceeded']]]),
    ]);
    $integration = TeamIntegration::factory()->gitHub()->create();

    expect(fn () => resolve(GitHubTracker::class)->issues($integration, ['9001/7']))->toThrow(ProviderRejected::class);
});

it('leaves out the issues of a repository the installation no longer sees', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001' => Http::response(['message' => 'Not Found'], 404),
    ]);
    $integration = TeamIntegration::factory()->gitHub()->create();

    expect(resolve(GitHubTracker::class)->issues($integration, ['9001/7']))->toBeEmpty();

    Http::assertNotSent(fn (Request $request) => $request->url() === 'https://api.github.com/graphql');
});

it('reads and writes back an issue whose body holds an unclosed marker and thousands of short lines', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    $body = "<!-- skrum:estimate -->\n".str_repeat("x\n", 32000);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues([7 => gitHubIssue(7, ['body' => $body])]),
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => $body])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);

    $issue = resolve(GitHubTracker::class)->issues($table['integration'], ['9001/7'])['9001/7'];

    expect($issue->estimate)->toBeNull()
        ->and(runGitHubSync(gitHubSyncTask($table, '5'))->synced_at)->not->toBeNull()
        ->and(gitHubPatches()[0]['body'])->toBe(rtrim($body)."\n\n".renderedEstimateBlock('5'));
});

it('lists repositories for the picker from the cached listing', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();

    foreach (['api', 'web'] as $query) {
        $this->actingAs($table['member'])
            ->getJson(route('poker.imports.containers.index', [$table['game'], 'github', 'q' => $query]))
            ->assertOk()
            ->assertJsonCount(1, 'containers');
    }

    expect(Http::recorded(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/installation/repositories')))->toHaveCount(1);
});

it('accepts a write-back GitHub echoes with normalised line endings', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => "Steps\r\n\r\n- one\r\n- two"])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => str_replace("\r\n", "\n", $request['body'])])),
    ]);

    $task = runGitHubSync(gitHubSyncTask($table, '5'));

    expect($task->synced_at)->not->toBeNull()
        ->and($task->sync_error)->toBeNull()
        ->and(gitHubPatches())->toHaveCount(1);
});
