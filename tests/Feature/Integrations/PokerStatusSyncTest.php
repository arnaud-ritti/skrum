<?php

use App\Enums\ExternalStatusCategory;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Events\Poker\PokerTaskSaved;
use App\Jobs\SyncTaskEstimate;
use App\Mcp\Presenters\McpPokerGame;
use App\Models\PokerTask;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
});

/**
 * An imported task estimated 5 in skrum, synced at 09:00, whose source
 * estimate became `$sourceEstimate` at 10:00.
 *
 * @param  array<string, mixed>  $table
 * @param  array<string, mixed>  $attributes
 */
function conflictingTask(array $table, string $sourceEstimate = '8', array $attributes = []): PokerTask
{
    $table['integration']->mergeSettings(['statusSync' => true]);

    return importedPokerTask($table['game'], [
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => '2026-10-07 08:55:00',
        'external_estimate' => $sourceEstimate,
        'external_updated_at' => '2026-10-07 10:00:00',
        'synced_at' => '2026-10-07 09:00:00',
        ...$attributes,
    ], $table['integration']->provider);
}

function conflictRoute(array $table, PokerTask $task): string
{
    return route('poker.tasks.estimate-conflict.store', [$table['game'], $task]);
}

it('shows the source status, missing flag and sync mode to members only', function () {
    $table = trackerTable();
    $table['integration']->mergeSettings(['statusSync' => true]);
    $table['integration']->forceFill(['inbound_mode' => IntegrationInboundMode::Polling])->save();
    importedPokerTask($table['game'], [
        'external_status_name' => 'In Review',
        'external_status_category' => ExternalStatusCategory::InProgress,
        'external_missing_at' => '2026-10-07 10:00:00',
    ]);
    $guest = pokerGuest($table['game']);

    $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external.status', 'In Review')
        ->assertJsonPath('tasks.0.external.statusCategory', 'in_progress')
        ->assertJsonPath('tasks.0.external.missing', true)
        ->assertJsonPath('tasks.0.external.estimateConflict', null)
        ->assertJsonPath('tasks.0.external.syncMode', 'polling');

    app('auth')->forgetGuards();

    $guestView = $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk();

    expect($guestView->json('tasks.0.external'))->not->toHaveKey('status')
        ->and($guestView->getContent())->not->toContain('In Review');
});

it('flags a source estimate that changed after the last sync', function () {
    $table = trackerTable();
    conflictingTask($table);

    $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external.estimateConflict', ['sourceEstimate' => '8', 'matchingCard' => '8']);
});

it('does not flag equal, pending, older or unestimated values', function (array $attributes) {
    $table = trackerTable();
    conflictingTask($table, attributes: $attributes);

    $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external.estimateConflict', null);
})->with([
    'same value' => [['external_estimate' => '5']],
    'write-back pending' => [['needs_sync' => true]],
    'changed before the sync' => [['external_updated_at' => '2026-10-07 08:00:00']],
    'no skrum estimate' => [['estimate' => null, 'estimate_numeric' => null, 'estimated_at' => null]],
    'never synced, unchanged since import' => [['synced_at' => null]],
]);

it('keeps the skrum estimate by writing it again', function () {
    Event::fake([PokerTaskSaved::class]);
    $table = trackerTable();
    $task = conflictingTask($table);

    $this->actingAs($table['facilitator'])
        ->postJson(conflictRoute($table, $task), ['resolution' => 'keepSkrum'])
        ->assertOk()
        ->assertJsonPath('estimate', '5')
        ->assertJsonPath('external.estimateConflict', null);

    expect($task->fresh()->needs_sync)->toBeTrue();
    Queue::assertPushed(SyncTaskEstimate::class, fn (SyncTaskEstimate $job) => $job->taskId === $task->id);
    Event::assertDispatched(PokerTaskSaved::class, fn (PokerTaskSaved $event) => $event->task['id'] === $task->id && $event->task['estimate'] === '5');
});

it('uses the source estimate without a new round', function () {
    Event::fake([PokerTaskSaved::class]);
    $table = trackerTable();
    $task = conflictingTask($table);

    $this->actingAs($table['facilitator'])
        ->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertOk()
        ->assertJsonPath('estimate', '8')
        ->assertJsonPath('external.estimateConflict', null);

    expect($task->fresh())
        ->estimate->toBe('8')
        ->needs_sync->toBeFalse();
    Queue::assertNotPushed(SyncTaskEstimate::class);
    Event::assertDispatched(PokerTaskSaved::class, fn (PokerTaskSaved $event) => $event->task['id'] === $task->id && $event->task['estimate'] === '8');
});

it('clears a failed write-back when using the source estimate', function () {
    $table = trackerTable();
    $task = conflictingTask($table, attributes: ['needs_sync' => true, 'sync_error' => 'Boom']);

    $this->actingAs($table['facilitator'])
        ->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertOk()
        ->assertJsonPath('external.syncState', 'synced')
        ->assertJsonPath('external.syncError', null)
        ->assertJsonPath('external.estimateConflict', null);

    expect($task->fresh())
        ->needs_sync->toBeFalse()
        ->sync_error->toBeNull()
        ->synced_at->toEqual(now());
    Queue::assertNotPushed(SyncTaskEstimate::class);
});

it('does not flag an accepted source estimate again after a later failed write-back', function () {
    $table = trackerTable();
    $task = conflictingTask($table);

    $this->actingAs($table['facilitator'])
        ->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertOk();

    $this->travel(5)->minutes();
    $task->fresh()->forceFill(['estimate' => '13', 'estimate_numeric' => 13, 'needs_sync' => true, 'sync_error' => 'Boom'])->save();

    $this->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external.syncState', 'failed')
        ->assertJsonPath('tasks.0.external.estimateConflict', null);
});

it('answers 404 for a task of another game', function () {
    $table = trackerTable();
    $other = trackerTable();
    $task = conflictingTask($other);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.estimate-conflict.store', [$table['game'], $task]), ['resolution' => 'useSource'])
        ->assertNotFound();

    expect($task->fresh()->estimate)->toBe('5');
});

it('neither flags nor resolves conflicts in an ended game', function () {
    $table = trackerTable();
    $task = conflictingTask($table);
    $table['game']->forceFill(['ended_at' => now(), 'current_task_id' => null])->save();

    $this->actingAs($table['facilitator'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external.estimateConflict', null);

    $this->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertForbidden()
        ->assertJsonPath('message', 'This game has ended.');

    expect($task->fresh()->estimate)->toBe('5');
});

it('refuses a source estimate that is not in the deck', function () {
    $table = trackerTable();
    $task = conflictingTask($table, '7');

    $this->actingAs($table['facilitator'])
        ->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['resolution' => '7 is not in this deck.']);

    expect($task->fresh()->estimate)->toBe('5');
});

it('answers 409 when the estimate is already in sync', function () {
    $table = trackerTable();
    $task = conflictingTask($table, '5');

    $this->actingAs($table['facilitator'])
        ->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertStatus(409)
        ->assertJsonPath('message', 'This estimate is already in sync.');
});

it('reserves conflict resolution to the facilitator', function () {
    $table = trackerTable();
    $task = conflictingTask($table);
    $guest = pokerGuest($table['game']);

    $this->actingAs($table['member'])->postJson(conflictRoute($table, $task), ['resolution' => 'nonsense'])->assertForbidden();

    app('auth')->forgetGuards();

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertForbidden();

    expect($task->fresh()->estimate)->toBe('5');
});

it('matches GitHub estimates to card labels exactly', function (string $sourceEstimate, ?string $matchingCard) {
    enableIntegrations(IntegrationProvider::GitHub);
    $table = trackerTable(IntegrationProvider::GitHub, deck: PokerDeck::Tshirt);
    conflictingTask($table, $sourceEstimate, ['estimate' => 'M', 'estimate_numeric' => null]);

    $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external.estimateConflict', ['sourceEstimate' => $sourceEstimate, 'matchingCard' => $matchingCard]);
})->with([
    'same label' => ['L', 'L'],
    'other case' => ['l', null],
]);

it('exposes the status and conflict to MCP clients', function () {
    $table = trackerTable();
    conflictingTask($table, attributes: ['external_status_category' => ExternalStatusCategory::Done]);

    $tasks = app(McpPokerGame::class)->tasks($table['game']->fresh(), $table['memberPlayer']);

    expect($tasks[0]['external'])->toMatchArray([
        'statusCategory' => 'done',
        'missing' => false,
        'estimateConflict' => ['sourceEstimate' => '8', 'matchingCard' => '8'],
    ]);
});
