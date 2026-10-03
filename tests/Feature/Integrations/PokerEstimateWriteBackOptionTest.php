<?php

use App\Actions\Integrations\PokerTaskSync;
use App\Jobs\SyncTaskEstimate;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('queues no write when the game does not write estimates', function () {
    Bus::fake([SyncTaskEstimate::class]);
    $table = trackerTable();
    $table['game']->update(['writes_estimates' => false]);
    $task = importedPokerTask($table['game']);
    $round = openPokerRound($table['game'], $task);
    pokerVote($round, $table['memberPlayer'], '5');
    $round->update(['revealed_at' => now()]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => '5'])
        ->assertOk()
        ->assertJsonPath('external.syncState', 'unsupported')
        ->assertJsonPath('external.unsupportedReason', 'Estimates are not written back in this game.');

    Bus::assertNotDispatched(SyncTaskEstimate::class);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.sync.store', [$table['game'], $task]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Estimates are not written back in this game.']);
});

it('writes to the field the game names', function () {
    $table = trackerTable();
    $table['integration']->mergeSettings(['numberFields' => [
        ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
        ['id' => 'customfield_10200', 'name' => 'Team points'],
    ]]);
    $table['game']->update(['estimate_field_id' => 'customfield_10200']);
    $task = importedPokerTask($table['game'], ['external_id' => '10001', 'estimate' => '5', 'estimate_numeric' => 5, 'needs_sync' => true]);
    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10001/editmeta' => Http::response(['fields' => [
            'customfield_10016' => ['name' => 'Story point estimate'],
            'customfield_10200' => ['name' => 'Team points'],
        ]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10001' => Http::response(null, 204),
    ]);

    app()->call([new SyncTaskEstimate($task->id), 'handle']);

    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && array_key_exists('customfield_10200', (array) $request['fields'])
        && ! array_key_exists('customfield_10016', (array) $request['fields']));
});

it('does not refuse a game whose field the connection lists when no story points field was found', function () {
    $table = trackerTable();
    $table['integration']->mergeSettings([
        'storyPointFields' => [],
        'numberFields' => [['id' => 'customfield_10200', 'name' => 'Team points']],
    ]);
    $task = importedPokerTask($table['game']);

    expect(PokerTaskSync::for($table['game'])->unsupportedReason($task))->toBe('No story points field found.');

    $table['game']->update(['estimate_field_id' => 'customfield_10200']);

    expect(PokerTaskSync::for($table['game']->fresh())->unsupportedReason($task))->toBeNull();
});
