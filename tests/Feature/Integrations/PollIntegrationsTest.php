<?php

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\HostResolver;
use App\Support\Integrations\IntegrationPolls;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
    config(['services.integrations.inbound_webhooks' => 'off', 'services.integrations.poll_minutes' => 5]);
});

/**
 * @param  array<string, mixed>  $attributes
 * @param  array<string, mixed>  $settings
 */
function pollingIntegration(array $attributes = [], array $settings = [], IntegrationProvider $provider = IntegrationProvider::Jira): TeamIntegration
{
    enableIntegrations($provider);
    $factory = TeamIntegration::factory();
    $integration = ($provider === IntegrationProvider::Linear ? $factory->linear() : $factory->jira())->create();
    $integration->forceFill([
        'settings' => [...$integration->settings, 'statusSync' => true, 'statusSyncSince' => '2026-10-01T00:00:00+00:00', ...$settings],
        'inbound_mode' => IntegrationInboundMode::Polling,
        ...$attributes,
    ])->save();

    return $integration->fresh() ?? $integration;
}

function trackedJiraLink(TeamIntegration $integration, string $externalId, array $item = []): ActionItemExternalLink
{
    return ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id, ...$item])->id,
        'external_id' => $externalId,
        'external_key' => 'PROJ-'.substr($externalId, -1),
    ]);
}

function runTrackedRead(TeamIntegration $integration, bool $full = false, bool $initial = false): ReadTrackedIssues
{
    $job = (new ReadTrackedIssues($integration->id, $full, $initial))->withFakeQueueInteractions();
    app()->call([$job, 'handle']);

    return $job;
}

it('queues reads of due integrations only', function () {
    Queue::fake();
    $due = pollingIntegration(['last_polled_at' => now()->subMinutes(6)]);
    pollingIntegration(['last_polled_at' => now()->subMinutes(4)]);
    $never = pollingIntegration(['last_polled_at' => null]);
    pollingIntegration(['last_polled_at' => null], ['statusSync' => false]);
    pollingIntegration(['last_polled_at' => null, 'status' => IntegrationStatus::ReconnectRequired]);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertPushed(ReadTrackedIssues::class, 2);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $due->id && ! $job->full);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $never->id);
});

it('reads healthy webhook integrations hourly and failing ones at the polling interval', function () {
    Queue::fake();
    config(['services.integrations.inbound_webhooks' => 'on', 'services.linear.webhook_secret' => 'linear-webhook-secret']);
    $healthy = pollingIntegration(['last_polled_at' => now()->subMinutes(59), 'webhook_status' => IntegrationWebhookStatus::Active], provider: IntegrationProvider::Linear);
    $stale = pollingIntegration(['last_polled_at' => now()->subMinutes(61), 'webhook_status' => IntegrationWebhookStatus::Active], provider: IntegrationProvider::Linear);
    $failing = pollingIntegration(['last_polled_at' => now()->subMinutes(6), 'webhook_status' => IntegrationWebhookStatus::Failing], provider: IntegrationProvider::Linear);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertPushed(ReadTrackedIssues::class, 2);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $stale->id);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $failing->id);
    expect($healthy->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Webhook);
});

it('falls back to polling when webhooks cannot reach the instance', function () {
    Queue::fake();
    $integration = pollingIntegration(['inbound_mode' => IntegrationInboundMode::Webhook, 'webhook_status' => IntegrationWebhookStatus::Active, 'last_polled_at' => now()->subMinutes(6)]);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    expect($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Polling);
    Queue::assertPushed(ReadTrackedIssues::class, 1);
});

it('waits while the source asks to', function () {
    Queue::fake();
    $integration = pollingIntegration(['last_polled_at' => null]);
    IntegrationPolls::pause($integration->id, 120);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertNothingPushed();
});

it('reads the tracked issues updated since the cursor and moves the cursor', function () {
    $integration = pollingIntegration(['poll_cursor' => '2026-10-07 10:15:00']);
    $link = trackedJiraLink($integration, '10001');
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', [
        'status' => ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
        'project' => ['key' => 'PROJ'],
        'updated' => '2026-10-07T10:25:00.000+0000',
    ])]);

    runTrackedRead($integration);

    Http::assertSent(fn (Request $request) => ($request['jql'] ?? null) === 'id in (10001) AND updated >= "-18m"');
    expect($link->actionItem->fresh()->completed_at)->not->toBeNull()
        ->and($integration->fresh()->poll_cursor?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00')
        ->and($integration->fresh()->last_polled_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00');
});

it('reads every tracked issue on a full read and flags the missing ones', function () {
    $integration = pollingIntegration();
    $link = trackedJiraLink($integration, '10001');
    fakeJiraTrackerApi([]);

    runTrackedRead($integration, full: true);

    Http::assertSent(fn (Request $request) => ($request['jql'] ?? null) === 'id in (10001)');
    expect($link->fresh()->missing_at)->not->toBeNull();
});

it('reads open items, items completed within 90 days and tasks of running games only', function () {
    $integration = pollingIntegration();
    trackedJiraLink($integration, '10001');
    trackedJiraLink($integration, '10002', ['completed_at' => now()->subDays(30)]);
    trackedJiraLink($integration, '10003', ['completed_at' => now()->subDays(100)]);
    $ended = PokerGame::factory()->create(['team_id' => $integration->team_id, 'ended_at' => now()->subDay()]);
    PokerTask::factory()->imported()->create(['poker_game_id' => $ended->id])->forceFill(['external_id' => '10004'])->save();
    fakeJiraTrackerApi([]);

    runTrackedRead($integration, full: true);

    Http::assertSent(function (Request $request) {
        $jql = (string) ($request['jql'] ?? '');

        return str_contains($jql, '10001') && str_contains($jql, '10002')
            && ! str_contains($jql, '10003') && ! str_contains($jql, '10004');
    });
});

it('never drops the first read after sync is turned on behind a daily full read', function () {
    Queue::fake();
    $integration = pollingIntegration();

    ReadTrackedIssues::dispatch($integration->id, true);
    ReadTrackedIssues::dispatch($integration->id, true, true);
    ReadTrackedIssues::dispatch($integration->id);

    Queue::assertPushed(ReadTrackedIssues::class, 3);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->full && $job->initial);
});

it('postpones the integration when the source rate limits', function () {
    $integration = pollingIntegration(['poll_cursor' => '2026-10-07 10:15:00', 'last_polled_at' => now()->subMinutes(10)]);
    trackedJiraLink($integration, '10001');
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::response(['errorMessages' => ['Slow down']], 429, ['Retry-After' => '120'])]);

    runTrackedRead($integration);

    expect(IntegrationPolls::isDue($integration->fresh()))->toBeFalse()
        ->and($integration->fresh()->poll_cursor?->toIso8601String())->toBe('2026-10-07T10:15:00+00:00');
});

it('flags webhooks that stay silent while the source changes', function (?string $lastInboundAt, IntegrationWebhookStatus $expected) {
    $integration = pollingIntegration([
        'inbound_mode' => IntegrationInboundMode::Webhook,
        'webhook_status' => IntegrationWebhookStatus::Active,
        'last_inbound_at' => $lastInboundAt,
        'poll_cursor' => '2026-10-07 09:30:00',
    ]);
    trackedJiraLink($integration, '10001');
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', ['updated' => '2026-10-07T10:00:00.000+0000', 'project' => ['key' => 'PROJ']])]);

    runTrackedRead($integration);

    expect($integration->fresh()->webhook_status)->toBe($expected);
})->with([
    'silent for a day' => ['2026-10-06 09:00:00', IntegrationWebhookStatus::Failing],
    'heard an hour ago' => ['2026-10-07 09:30:00', IntegrationWebhookStatus::Active],
]);

it('queues the daily full read of synced integrations after their check', function () {
    Queue::fake();
    $synced = pollingIntegration();
    pollingIntegration(settings: ['statusSync' => false]);
    Http::fake(['api.atlassian.com/oauth/token/accessible-resources' => Http::response([
        ['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme', 'scopes' => ['read:jira-work']],
    ])]);

    $this->artisan('skrum:check-integrations')->assertSuccessful();

    Queue::assertPushed(ReadTrackedIssues::class, 1);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $synced->id && $job->full && ! $job->initial);
});

it('waits a polling interval after a source error without failing the read', function () {
    Log::spy();
    $integration = pollingIntegration(['poll_cursor' => '2026-10-07 10:15:00', 'last_polled_at' => now()->subMinutes(10)]);
    trackedJiraLink($integration, '10001');
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::response(['errorMessages' => ['Down for maintenance']], 503)]);

    $job = runTrackedRead($integration);

    $job->assertNotFailed();
    $job->assertNotReleased();
    Http::assertSentCount(1);
    Log::shouldHaveReceived('warning')->once();
    expect($integration->fresh()->poll_cursor?->toIso8601String())->toBe('2026-10-07T10:15:00+00:00');

    Queue::fake();
    $this->travel(1)->minute();
    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertNothingPushed();
});

it('retries the first read after sync is turned on instead of dropping it', function (int $status, array $headers, int $delay) {
    $integration = pollingIntegration();
    trackedJiraLink($integration, '10001');
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::response(['errorMessages' => ['Not now']], $status, $headers)]);

    $job = runTrackedRead($integration, full: true, initial: true);

    $job->assertReleased($delay);
    $job->assertNotFailed();
})->with([
    'rate limited' => [429, ['Retry-After' => '120'], 120],
    'unavailable' => [503, [], 60],
]);

it('keeps the cursor when the connection must be reconnected', function () {
    $integration = pollingIntegration(['poll_cursor' => '2026-10-07 10:15:00']);
    trackedJiraLink($integration, '10001');
    Http::fake([
        'auth.atlassian.com/oauth/token' => Http::response(['error' => 'invalid_grant'], 400),
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['message' => 'Unauthorized'], 401),
    ]);

    $job = runTrackedRead($integration);

    $job->assertNotFailed();
    expect($integration->fresh()->poll_cursor?->toIso8601String())->toBe('2026-10-07T10:15:00+00:00')
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('reads nothing for connections that are not active or not synced', function (array $attributes, array $settings) {
    Http::fake();
    $integration = pollingIntegration($attributes, $settings);
    trackedJiraLink($integration, '10001');

    runTrackedRead($integration, full: true);

    Http::assertNothingSent();
})->with([
    'reconnect required' => [['status' => IntegrationStatus::ReconnectRequired], []],
    'sync off' => [[], ['statusSync' => false]],
]);

it('keeps the inbound mode while the instance address cannot be resolved', function () {
    Queue::fake();
    config(['services.integrations.inbound_webhooks' => 'auto', 'app.url' => 'https://skrum.example.com', 'services.linear.webhook_secret' => 'linear-webhook-secret']);
    $resolver = new class extends HostResolver
    {
        public int $lookups = 0;

        public function addresses(string $host): array
        {
            $this->lookups++;

            return [];
        }
    };
    app()->instance(HostResolver::class, $resolver);
    $first = pollingIntegration(['inbound_mode' => IntegrationInboundMode::Webhook, 'webhook_status' => IntegrationWebhookStatus::Active, 'last_polled_at' => now()->subMinutes(10)], provider: IntegrationProvider::Linear);
    $second = pollingIntegration(['inbound_mode' => IntegrationInboundMode::Webhook, 'webhook_status' => IntegrationWebhookStatus::Active, 'last_polled_at' => now()->subMinutes(10)], provider: IntegrationProvider::Linear);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    expect($first->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Webhook)
        ->and($second->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Webhook)
        ->and($resolver->lookups)->toBe(1);
    Queue::assertNothingPushed();
});

it('counts only the reads it actually queued', function () {
    Queue::fake();
    $integration = pollingIntegration(['last_polled_at' => null]);
    ReadTrackedIssues::dispatch($integration->id);

    $this->artisan('skrum:poll-integrations')
        ->expectsOutputToContain('Queued 0 integration reads.')
        ->assertSuccessful();

    Queue::assertPushed(ReadTrackedIssues::class, 1);
});

it('keeps a webhook active when an event arrives during the read', function () {
    $integration = pollingIntegration([
        'inbound_mode' => IntegrationInboundMode::Webhook,
        'webhook_status' => IntegrationWebhookStatus::Active,
        'last_inbound_at' => '2026-10-06 09:00:00',
        'poll_cursor' => '2026-10-07 09:30:00',
    ]);
    trackedJiraLink($integration, '10001');
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => function () use ($integration) {
        TeamIntegration::query()->whereKey($integration->id)->update(['last_inbound_at' => now(), 'webhook_status' => IntegrationWebhookStatus::Active]);

        return Http::response(['issues' => [jiraTrackerIssue('10001', 'PROJ-1', ['updated' => '2026-10-07T10:00:00.000+0000', 'project' => ['key' => 'PROJ']])], 'isLast' => true]);
    }]);

    runTrackedRead($integration);

    expect($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Active);
});

it('holds its unique lock longer than it may be retried', function () {
    $job = new ReadTrackedIssues('integration');

    expect(now()->addSeconds($job->uniqueFor)->gt($job->retryUntil()))->toBeTrue();
});

it('queues the first read again while it has not completed', function () {
    Queue::fake();
    $integration = pollingIntegration(['last_polled_at' => now()], ['initialReadPending' => 'first-read-token']);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertPushed(ReadTrackedIssues::class, 1);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $integration->id && $job->full && $job->initial);
});

it('clears the pending first read only once it completes', function () {
    $integration = pollingIntegration(settings: ['initialReadPending' => 'first-read-token']);
    trackedJiraLink($integration, '10001');
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::sequence()
        ->push(['errorMessages' => ['Down for maintenance']], 503)
        ->push(['issues' => [jiraTrackerIssue('10001', 'PROJ-1', ['project' => ['key' => 'PROJ']])], 'isLast' => true])
        ->push(['issues' => [jiraTrackerIssue('10001', 'PROJ-1', ['project' => ['key' => 'PROJ']])], 'isLast' => true]),
    ]);

    runTrackedRead($integration, full: true, initial: true);

    expect($integration->fresh()->setting('initialReadPending'))->toBe('first-read-token');

    runTrackedRead($integration, full: true);

    expect($integration->fresh()->setting('initialReadPending'))->toBe('first-read-token');

    runTrackedRead($integration, full: true, initial: true);

    expect($integration->fresh()->setting('initialReadPending'))->toBeNull();
});

it('keeps the first read owed when sync is turned off and on while it runs', function () {
    $integration = pollingIntegration(settings: ['initialReadPending' => 'first-read-token']);
    trackedJiraLink($integration, '10001');
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => function () use ($integration) {
        $integration->fresh()->mergeSettings(['initialReadPending' => 'second-read-token']);

        return Http::response(['issues' => [jiraTrackerIssue('10001', 'PROJ-1', ['project' => ['key' => 'PROJ']])], 'isLast' => true]);
    }]);

    runTrackedRead($integration, full: true, initial: true);

    expect($integration->fresh()->setting('initialReadPending'))->toBe('second-read-token');
});

it('backs off a first read that keeps failing instead of queueing it every minute', function () {
    $integration = pollingIntegration(['last_polled_at' => now()], ['initialReadPending' => 'first-read-token']);
    trackedJiraLink($integration, '10001');
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::response(['errorMessages' => ['Down for maintenance']], 503)]);

    $job = runTrackedRead($integration, full: true, initial: true);
    $job->failed(new RuntimeException('Gave up'));

    Queue::fake();
    $this->travel(1)->minute();
    $this->artisan('skrum:poll-integrations')->assertSuccessful();
    $this->travel(ReadTrackedIssues::InitialReadBackoffMinutes - 2)->minutes();
    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertNothingPushed();

    $this->travel(3)->minutes();
    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->full && $job->initial);
});

it('honours a long Retry-After on the first read', function () {
    $integration = pollingIntegration(['last_polled_at' => now()], ['initialReadPending' => 'first-read-token']);
    trackedJiraLink($integration, '10001');
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::response(['errorMessages' => ['Slow down']], 429, ['Retry-After' => '1800'])]);

    $job = runTrackedRead($integration, full: true, initial: true);

    $job->assertNotReleased();
    $job->assertNotFailed();

    Queue::fake();
    $this->travel(29)->minutes();
    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertNothingPushed();

    $this->travel(2)->minutes();
    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->full && $job->initial);
});
