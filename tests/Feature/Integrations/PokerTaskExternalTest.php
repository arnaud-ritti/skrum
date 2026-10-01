<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationStatus;
use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Http::preventStrayRequests());

it('shows the full external object and the connections to non-guest players', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['external_assignee' => 'Jane Doe', 'external_estimate' => '3', 'synced_at' => now()]);

    $response = $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))->assertOk();

    expect($response->json('tasks.0.external'))->toBe([
        'source' => 'jira',
        'key' => $task->external_key,
        'url' => $task->external_url,
        'assignee' => 'Jane Doe',
        'sourceEstimate' => '3',
        'refreshedAt' => $task->external_refreshed_at?->toIso8601String(),
        'syncState' => 'synced',
        'syncError' => null,
        'unsupportedReason' => null,
        'isManaged' => true,
    ])
        ->and($response->json('integrations'))->toBe(['jira' => ['connected' => true, 'canWrite' => true], 'linear' => null, 'jira_dc' => null, 'github' => null])
        ->and($response->json('tasks.0.external.syncState'))->toBe('synced');
});

it('gives guests the reduced external object and no connections', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['external_assignee' => 'Jane Doe', 'sync_error' => 'Boom', 'needs_sync' => true]);
    $guest = pokerGuest($table['game']);

    $response = $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk();

    expect($response->json('tasks.0.external'))->toBe([
        'source' => 'jira',
        'key' => $task->external_key,
        'url' => $task->external_url,
        'isManaged' => true,
    ])
        ->and($response->json('integrations'))->toBeNull()
        ->and($response->getContent())->not->toContain('Jane Doe')->not->toContain('Boom');
});

it('keeps external null for tasks that were not imported', function () {
    $table = trackerTable();
    PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external', null);
});

it('broadcasts the reduced external object and answers the full one', function () {
    Queue::fake();
    Event::fake([PokerTaskSaved::class]);
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['external_estimate' => '3']);
    $round = openPokerRound($table['game'], $task);
    pokerVote($round, $table['facilitatorPlayer'], '5');
    $round->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => '5'])
        ->assertOk()
        ->assertJsonPath('external.sourceEstimate', '3')
        ->assertJsonPath('external.isManaged', true);

    Event::assertDispatched(PokerTaskSaved::class, fn (PokerTaskSaved $event) => $event->task['external'] === [
        'source' => 'jira',
        'key' => $task->external_key,
        'url' => $task->external_url,
        'isManaged' => true,
    ]);
});

it('computes the write-back state', function (array $attributes, ?string $state, ?string $error) {
    $table = trackerTable();
    importedPokerTask($table['game'], $attributes);

    $external = $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))->json('tasks.0.external');

    expect($external['syncState'])->toBe($state)
        ->and($external['syncError'])->toBe($error)
        ->and($external['unsupportedReason'])->toBeNull();
})->with([
    'never written' => [[], null, null],
    'pending' => [['needs_sync' => true], 'pending', null],
    'failed' => [['needs_sync' => true, 'sync_error' => 'Boom'], 'failed', 'Boom'],
    'synced' => [['synced_at' => now()], 'synced', null],
]);

it('marks tasks unsupported for an unsupported write-back', function (Closure $arrange, string $reason) {
    $table = trackerTable();
    $task = importedPokerTask($table['game']);
    $arrange($table, $task);

    $external = $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))->json('tasks.0.external');

    expect($external['syncState'])->toBe('unsupported')
        ->and($external['unsupportedReason'])->toBe($reason);
})->with([
    'a T-shirt deck' => [fn (array $table) => $table['game']->forceFill(['deck' => PokerDeck::Tshirt, 'cards' => PokerDeck::Tshirt->cards()])->save(), "T-shirt estimates can't be written to Jira."],
    'a read-only connection' => [fn (array $table) => $table['integration']->forceFill(['access' => IntegrationAccess::Read])->save(), 'This Jira connection is read-only.'],
    'another site' => [fn (array $table, PokerTask $task) => $task->forceFill(['external_site' => 'cloud-9'])->save(), 'This task comes from another Jira site.'],
    'no story points field' => [fn (array $table) => $table['integration']->forceFill(['settings' => [...$table['integration']->settings, 'storyPointFields' => []]])->save(), 'No story points field found.'],
    'a lost connection' => [fn (array $table) => $table['integration']->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save(), 'Reconnect Jira in the team settings.'],
    'no connection' => [fn (array $table) => $table['integration']->delete(), 'Connect Jira in the team settings.'],
]);

it('refuses edits of imported tasks but lets the facilitator delete them', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game']);

    $this->actingAs($table['member'])
        ->patchJson(route('poker.tasks.update', [$table['game'], $task]), ['title' => 'Renamed'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title' => 'This task is managed in Jira.']);

    expect($task->fresh()?->title)->not->toBe('Renamed');

    $this->actingAs($table['facilitator'])
        ->deleteJson(route('poker.tasks.destroy', [$table['game'], $task]))
        ->assertNoContent();

    Http::assertNothingSent();
});
