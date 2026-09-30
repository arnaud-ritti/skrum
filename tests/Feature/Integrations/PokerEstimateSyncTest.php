<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerTaskSaved;
use App\Jobs\SyncTaskEstimate;
use App\Models\PokerTask;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(fn () => Http::preventStrayRequests());

/**
 * @param  array<string, mixed>  $table
 */
function revealImportedTask(array $table, PokerTask $task, string ...$values): void
{
    $round = openPokerRound($table['game'], $task);
    $players = [$table['facilitatorPlayer'], $table['memberPlayer']];

    foreach ($values as $index => $value) {
        pokerVote($round, $players[$index], $value);
    }

    $round->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);
}

/**
 * @param  array<string, mixed>  $table
 */
function pendingSyncTask(array $table, ?string $estimate, IntegrationProvider $source = IntegrationProvider::Jira): PokerTask
{
    return importedPokerTask($table['game'], [
        'estimate' => $estimate,
        'estimate_numeric' => $estimate === null ? null : PokerDeck::numericValue($estimate),
        'estimated_at' => $estimate === null ? null : now(),
        'needs_sync' => true,
    ], $source);
}

function runEstimateSync(PokerTask $task): void
{
    app()->call([new SyncTaskEstimate($task->id), 'handle']);
}

it('is a unique, retried job', function () {
    $job = new SyncTaskEstimate('task-id');

    expect($job)->toBeInstanceOf(ShouldBeUniqueUntilProcessing::class)
        ->and($job->uniqueId())->toBe('task-id')
        ->and($job->tries)->toBe(5)
        ->and($job->backoff)->toBe([10, 30, 120, 600]);
});

it('queues a write-back when the facilitator sets the estimate of an imported task', function () {
    Queue::fake();
    $table = trackerTable();
    $task = importedPokerTask($table['game']);
    revealImportedTask($table, $task, '5');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => '5'])
        ->assertOk()
        ->assertJsonPath('external.syncState', 'pending');

    expect($task->fresh()?->needs_sync)->toBeTrue();
    Queue::assertPushed(SyncTaskEstimate::class, fn (SyncTaskEstimate $job) => $job->taskId === $task->id);
});

it('queues a write-back when the facilitator clears the estimate', function () {
    Queue::fake();
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['estimate' => '5', 'estimate_numeric' => 5, 'estimated_at' => now(), 'synced_at' => now()]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => null])
        ->assertOk()
        ->assertJsonPath('external.syncState', 'pending');

    Queue::assertPushed(SyncTaskEstimate::class, 1);
});

it('coalesces quick estimate changes into one queued write', function () {
    Queue::fake();
    $table = trackerTable();
    $task = importedPokerTask($table['game']);
    revealImportedTask($table, $task, '5', '8');
    $url = route('poker.tasks.estimate.update', [$table['game'], $task]);

    $this->actingAs($table['facilitator'])->putJson($url, ['value' => '5'])->assertOk();
    $this->actingAs($table['facilitator'])->putJson($url, ['value' => '8'])->assertOk();

    Queue::assertPushed(SyncTaskEstimate::class, 1);
});

it('queues nothing for tasks it cannot write back', function () {
    Queue::fake();
    $table = trackerTable(deck: PokerDeck::Tshirt);
    $imported = importedPokerTask($table['game']);
    $local = PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);
    revealImportedTask($table, $imported, 'M');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $imported]), ['value' => 'M'])
        ->assertOk()
        ->assertJsonPath('external.syncState', 'unsupported')
        ->assertJsonPath('external.unsupportedReason', "T-shirt estimates can't be written to Jira.");

    revealImportedTask($table, $local, 'L');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $local]), ['value' => 'L'])
        ->assertOk();

    Queue::assertNothingPushed();
    expect($imported->fresh()?->needs_sync)->toBeFalse();
});

it('writes the estimate to the first story points field on the Jira edit screen', function () {
    Event::fake([PokerTaskSaved::class]);
    $table = trackerTable();
    $table['integration']->forceFill(['settings' => [...$table['integration']->settings, 'storyPointFields' => [
        ['id' => 'customfield_10026', 'name' => 'Story Points'],
        ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
    ]]])->save();
    $task = pendingSyncTask($table, '5');
    fakeJiraTrackerApi();

    runEstimateSync($task);

    $task->refresh();

    expect($task->needs_sync)->toBeFalse()
        ->and($task->synced_at)->not->toBeNull()
        ->and($task->sync_error)->toBeNull();

    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && str_ends_with($request->url(), "/rest/api/3/issue/{$task->external_id}")
        && $request->data() == ['fields' => ['customfield_10016' => 5.0]]);
    Event::assertDispatched(PokerTaskSaved::class, fn (PokerTaskSaved $event) => $event->task['id'] === $task->id
        && $event->task['external'] === ['source' => 'jira', 'key' => $task->external_key, 'url' => $task->external_url, 'isManaged' => true]);
});

it('writes half points and cleared estimates to Jira', function (?string $estimate, ?float $sent) {
    $table = trackerTable(deck: PokerDeck::ModifiedFibonacci);
    $task = pendingSyncTask($table, $estimate);
    fakeJiraTrackerApi();

    runEstimateSync($task);

    expect($task->fresh()?->needs_sync)->toBeFalse();
    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && array_key_exists('customfield_10016', (array) data_get($request->data(), 'fields'))
        && data_get($request->data(), 'fields.customfield_10016') === $sent);
})->with([
    'half a point' => ['½', 0.5],
    'a cleared estimate' => [null, null],
]);

it('fails when no story points field is on the Jira edit screen', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*/editmeta' => Http::response(['fields' => ['summary' => []]])]);

    runEstimateSync($task);

    $task->refresh();

    expect($task->sync_error)->toBe('This issue has no story points field on its edit screen.')
        ->and($task->needs_sync)->toBeTrue()
        ->and($task->synced_at)->toBeNull();
    Http::assertNotSent(fn (Request $request) => $request->method() === 'PUT');
});

it('records the Jira error when the write is refused', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*/editmeta' => Http::response(['fields' => ['customfield_10016' => []]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*' => Http::response(['errorMessages' => ['Field cannot be set.']], 400),
    ]);

    runEstimateSync($task);

    expect($task->fresh()?->sync_error)->toBe('Field cannot be set.');
});

it('writes Linear estimates within its scale', function (PokerDeck $deck, string $estimate, bool $allowsZero, ?int $sent) {
    $table = trackerTable(IntegrationProvider::Linear, deck: $deck);
    $task = pendingSyncTask($table, $estimate, IntegrationProvider::Linear);
    fakeLinearGraphql([
        'issueEstimationType' => ['issue' => ['team' => ['issueEstimationType' => 'fibonacci', 'issueEstimationAllowZero' => $allowsZero]]],
        'issueUpdate(' => ['issueUpdate' => ['success' => true]],
    ]);

    runEstimateSync($task);

    expect($task->fresh()?->needs_sync)->toBeFalse();
    Http::assertSent(fn (Request $request) => str_contains((string) $request['query'], 'issueUpdate(')
        && data_get($request->data(), 'variables.id') === $task->external_id
        && data_get($request->data(), 'variables.estimate') === $sent);
})->with([
    'a whole number' => [PokerDeck::Fibonacci, '3', false, 3],
    'zero when the team allows it' => [PokerDeck::Fibonacci, '0', true, 0],
    'zero cleared when the team does not' => [PokerDeck::Fibonacci, '0', false, null],
]);

it('refuses estimates Linear cannot hold', function (PokerDeck $deck, string $estimate, string $type, string $error) {
    $table = trackerTable(IntegrationProvider::Linear, deck: $deck);
    $task = pendingSyncTask($table, $estimate, IntegrationProvider::Linear);
    fakeLinearGraphql(['issueEstimationType' => ['issue' => ['team' => ['issueEstimationType' => $type, 'issueEstimationAllowZero' => true]]]]);

    runEstimateSync($task);

    expect($task->fresh()?->sync_error)->toBe($error)
        ->and($task->fresh()?->needs_sync)->toBeTrue();
    Http::assertNotSent(fn (Request $request) => str_contains((string) $request['query'], 'issueUpdate('));
})->with([
    'estimates turned off' => [PokerDeck::Fibonacci, '3', 'notUsed', 'Estimates are turned off for this Linear team.'],
    'a half point' => [PokerDeck::ModifiedFibonacci, '½', 'fibonacci', 'Linear only accepts whole-number estimates.'],
    'more than 64' => [PokerDeck::Fibonacci, '89', 'exponential', 'Linear accepts estimates from 0 to 64.'],
]);

it('shows the reason Linear rejects an estimate', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    $task = pendingSyncTask($table, '21', IntegrationProvider::Linear);
    Http::fake(['api.linear.app/graphql' => function (Request $request) {
        if (str_contains((string) $request['query'], 'issueEstimationType')) {
            return Http::response(['data' => ['issue' => ['team' => ['issueEstimationType' => 'fibonacci', 'issueEstimationAllowZero' => false]]]]);
        }

        return Http::response(['errors' => [['message' => 'Estimate is not valid for this team', 'extensions' => ['code' => 'INVALID_INPUT']]]], 400);
    }]);

    runEstimateSync($task);

    expect($task->fresh()?->sync_error)->toBe('Linear rejected this estimate: Estimate is not valid for this team');
});

it('waits for the rate limit before retrying', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*/editmeta' => Http::response([], 429, ['Retry-After' => '42'])]);

    $job = (new SyncTaskEstimate($task->id))->withFakeQueueInteractions();
    app()->call([$job, 'handle']);

    $job->assertReleased(42);
    expect($task->fresh()?->sync_error)->toBeNull();
});

it('retries while the source is unavailable and records the final failure', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/*' => Http::response([], 503)]);
    $job = new SyncTaskEstimate($task->id);

    expect(fn () => app()->call([$job, 'handle']))->toThrow(ProviderUnavailable::class)
        ->and($task->fresh()?->sync_error)->toBeNull();

    $job->failed(new ProviderUnavailable(IntegrationProvider::Jira));

    expect($task->fresh()?->sync_error)->toBe('Jira did not respond. Try again later.')
        ->and($task->fresh()?->needs_sync)->toBeTrue();
});

it('records the reason instead of calling a provider that no longer covers the task', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    $table['integration']->forceFill(['access' => IntegrationAccess::Read])->save();

    runEstimateSync($task);

    expect($task->fresh()?->sync_error)->toBe('This Jira connection is read-only.');
    Http::assertNothingSent();
});

it('does nothing for a deleted task or one already written', function () {
    $table = trackerTable();
    $written = importedPokerTask($table['game'], ['estimate' => '5', 'needs_sync' => false]);

    app()->call([new SyncTaskEstimate((string) Str::uuid()), 'handle']);
    runEstimateSync($written);

    Http::assertNothingSent();
});

it('keeps needs_sync when the estimate changed during the write', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*/editmeta' => Http::response(['fields' => ['customfield_10016' => []]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*' => function () use ($task) {
            PokerTask::query()->whereKey($task->id)->update(['estimate' => '8', 'estimate_numeric' => 8]);

            return Http::response(null, 204);
        },
    ]);

    runEstimateSync($task);

    expect($task->fresh()?->needs_sync)->toBeTrue()
        ->and($task->fresh()?->synced_at)->toBeNull();
});

it('lets only the facilitator force a write-back', function () {
    Queue::fake();
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['estimate' => '5', 'estimate_numeric' => 5, 'synced_at' => now()]);
    $url = route('poker.tasks.sync.store', [$table['game'], $task]);

    $this->actingAs($table['member'])->postJson($url)->assertForbidden();

    $this->actingAs($table['facilitator'])->postJson($url)
        ->assertAccepted()
        ->assertJsonPath('external.syncState', 'pending');

    expect($task->fresh()?->needs_sync)->toBeTrue();
    Queue::assertPushed(SyncTaskEstimate::class, fn (SyncTaskEstimate $job) => $job->taskId === $task->id);
});

it('retries a failed write-back', function () {
    Queue::fake();
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['estimate' => '5', 'estimate_numeric' => 5, 'needs_sync' => true, 'sync_error' => 'Boom']);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.sync.store', [$table['game'], $task]))
        ->assertAccepted();

    expect($task->fresh()?->sync_error)->toBeNull();
    Queue::assertPushed(SyncTaskEstimate::class, 1);
});

it('refuses to sync tasks without an estimate, unsupported or not imported', function (Closure $arrange, string $message) {
    Queue::fake();
    $table = trackerTable();
    $task = $arrange($table);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.sync.store', [$table['game'], $task]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => $message]);

    Queue::assertNothingPushed();
})->with([
    'no estimate' => [fn (array $table) => importedPokerTask($table['game']), 'Set an estimate before syncing it.'],
    'another site' => [fn (array $table) => importedPokerTask($table['game'], ['estimate' => '5', 'external_site' => 'cloud-9']), 'This task comes from another Jira site.'],
    'not imported' => [fn (array $table) => PokerTask::factory()->estimated('5')->create(['poker_game_id' => $table['game']->id]), 'This task was not imported from a tracker.'],
]);

it('never lets an external id escape the issue path', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    $task->forceFill(['external_id' => '../../project'])->save();

    runEstimateSync($task);

    expect($task->fresh()?->sync_error)->toBe('This issue was not found in Jira.');
    Http::assertNothingSent();
});
