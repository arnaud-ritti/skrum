<?php

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Jobs\Integrations\RemoveTrackerWebhooks;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\InboundModes;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use App\Support\Integrations\TrackerWebhooks;
use Carbon\CarbonImmutable;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
    config(['services.integrations.inbound_webhooks' => 'on']);
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter);
});

/**
 * A synced connection tracking PROJ-1 and ENG-3.
 *
 * @param  array<string, mixed>  $settings
 */
function webhookIntegration(IntegrationProvider $provider = IntegrationProvider::Jira, array $settings = [], array $attributes = []): TeamIntegration
{
    $factory = TeamIntegration::factory();
    $integration = ($provider === IntegrationProvider::JiraDataCenter ? $factory->jiraDataCenter() : $factory->jira())->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true, ...$settings], ...$attributes])->save();
    $site = $provider === IntegrationProvider::JiraDataCenter ? JiraDataCenterServer::key(TeamIntegrationFactory::JiraDataCenterUrl) : 'cloud-1';

    foreach (['10001' => 'PROJ-1', '10003' => 'ENG-3'] as $id => $key) {
        ActionItemExternalLink::factory()->create([
            'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
            'source' => $provider,
            'external_site' => $site,
            'external_id' => $id,
            'external_key' => $key,
        ]);
    }

    return $integration->fresh() ?? $integration;
}

function runWebhookRegistration(TeamIntegration $integration, bool $force = false): void
{
    app()->call([(new RegisterTrackerWebhooks($integration->id, $force))->withFakeQueueInteractions(), 'handle']);
}

it('registers a Jira Cloud webhook for the projects of tracked issues', function () {
    $integration = webhookIntegration();
    Http::fake([jiraApiUrl('rest/api/3/webhook') => Http::response(['webhookRegistrationResult' => [['createdWebhookId' => 7001]]])]);

    runWebhookRegistration($integration);

    $integration->refresh();
    $token = $integration->credential('webhookToken');
    expect($token)->toBeString()->toHaveLength(40)
        ->and($integration->setting('webhookIds'))->toBe(['7001'])
        ->and($integration->setting('webhookProjects'))->toBe(['ENG', 'PROJ'])
        ->and($integration->webhook_status)->toBe(IntegrationWebhookStatus::Pending)
        ->and($integration->webhook_expires_at?->toDateString())->toBe('2026-11-06')
        ->and($integration->inbound_mode)->toBe(IntegrationInboundMode::Webhook);
    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/webhook')
        && $request['url'] === route('integrations.webhooks.tracker.store', ['source' => 'jira', 'integration' => $integration->id, 'token' => $token])
        && $request['webhooks'] === [['events' => ['jira:issue_updated', 'jira:issue_deleted'], 'jqlFilter' => 'project in ("ENG", "PROJ")']]);
});

it('re-registers when a new project appears and deletes the old webhook', function () {
    $integration = webhookIntegration(settings: ['webhookIds' => ['7001'], 'webhookProjects' => ['PROJ']]);
    Http::fake([jiraApiUrl('rest/api/3/webhook') => fn (Request $request) => $request->method() === 'DELETE'
        ? Http::response(null, 202)
        : Http::response(['webhookRegistrationResult' => [['createdWebhookId' => 7002]]])]);

    app(TrackerWebhooks::class)->registerIfNeeded($integration);
    Queue::assertPushed(RegisterTrackerWebhooks::class, fn (RegisterTrackerWebhooks $job) => $job->integrationId === $integration->id);

    runWebhookRegistration($integration);

    expect($integration->fresh()->setting('webhookIds'))->toBe(['7002']);
    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE' && $request['webhookIds'] === [7001]);
});

it('refreshes Jira webhooks that expire within a week', function () {
    $integration = webhookIntegration(
        settings: ['webhookIds' => ['7001'], 'webhookProjects' => ['ENG', 'PROJ']],
        attributes: ['webhook_expires_at' => now()->addDays(5), 'webhook_status' => IntegrationWebhookStatus::Active],
    );
    Http::fake([
        'api.atlassian.com/oauth/token/accessible-resources' => Http::response([['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme', 'scopes' => ['read:jira-work']]]),
        jiraApiUrl('rest/api/3/webhook/refresh') => Http::response(['expirationDate' => '2026-11-06T10:30:00.000+0000']),
    ]);

    $this->artisan('skrum:check-integrations')->assertSuccessful();
    Queue::assertPushed(RegisterTrackerWebhooks::class);

    runWebhookRegistration($integration);

    expect($integration->fresh()->webhook_expires_at?->toIso8601String())->toBe('2026-11-06T10:30:00+00:00');
    Http::assertSent(fn (Request $request) => $request->method() === 'PUT' && $request['webhookIds'] === [7001]);
});

it('marks the webhook failing when its registration keeps failing', function () {
    $integration = webhookIntegration();

    (new RegisterTrackerWebhooks($integration->id))->failed(new ProviderRejected(IntegrationProvider::Jira, 'nope', 403));

    expect($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Failing);
});

it('registers Jira Data Center webhooks only for Jira administrators', function (bool $administers) {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/mypermissions*') => Http::response(['permissions' => ['ADMINISTER' => ['havePermission' => $administers]]]),
        jiraDataCenterUrl('rest/webhooks/1.0/webhook') => Http::response(['self' => 'https://jira.example.com/rest/webhooks/1.0/webhook/12'], 201),
    ]);

    runWebhookRegistration($integration);

    $integration->refresh();
    expect($integration->credential('webhookSecret'))->toBeString()->toHaveLength(40)
        ->and($integration->setting('webhookIds'))->toBe($administers ? ['12'] : [])
        ->and($integration->setting('webhookManual'))->toBe(! $administers)
        ->and($integration->webhook_status)->toBe($administers ? IntegrationWebhookStatus::Pending : null)
        ->and(app(InboundModes::class)->hint($integration))->toBe($administers ? null : InboundModes::HintManual);
    $administers
        ? Http::assertSent(fn (Request $request) => $request->method() === 'POST' && $request['filters'] === ['issue-related-events-section' => 'project in ("ENG", "PROJ")'])
        : Http::assertNotSent(fn (Request $request) => $request->method() === 'POST');
})->with(['administrator' => [true], 'not an administrator' => [false]]);

it('shows the manual webhook details to owners and admins only', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter, ['webhookManual' => true]);
    $team = $integration->team;
    $route = route('teams.integrations.trackerWebhook.show', [$team->workspace, $team, $integration]);

    $this->actingAs(teamMember($team))->getJson($route)->assertForbidden();

    $response = $this->actingAs(integrationAdmin($team))->getJson($route)->assertOk();

    $integration->refresh();
    expect($response->json())->toBe([
        'url' => route('integrations.webhooks.tracker.store', ['source' => 'jira-dc', 'integration' => $integration->id, 'token' => $integration->credential('webhookToken')]),
        'secret' => $integration->credential('webhookSecret'),
        'events' => ['jira:issue_updated', 'jira:issue_deleted'],
        'jql' => 'project in ("ENG", "PROJ")',
    ])
        ->and($response->headers->get('Cache-Control'))->toContain('no-store');

    $cloud = webhookIntegration();
    $this->actingAs(integrationAdmin($cloud->team))
        ->getJson(route('teams.integrations.trackerWebhook.show', [$cloud->team->workspace, $cloud->team, $cloud]))
        ->assertNotFound();
});

it('confirms a webhook registered by hand', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter, ['webhookManual' => true]);
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.trackerWebhook.store', [$team->workspace, $team, $integration]), ['registered' => true])
        ->assertStatus(202);

    expect($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Pending)
        ->and($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Webhook);
});

it('queues a registration on request, refused while sync is off', function () {
    $integration = webhookIntegration();
    $team = $integration->team;
    $admin = integrationAdmin($team);
    $route = route('teams.integrations.trackerWebhook.store', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->postJson($route, ['registered' => true])->assertUnprocessable();
    $this->actingAs($admin)->postJson($route)->assertStatus(202);
    Queue::assertPushed(RegisterTrackerWebhooks::class, 1);

    $integration->mergeSettings(['statusSync' => false]);
    $this->actingAs($admin)->postJson($route)->assertStatus(409)->assertJsonPath('message', 'Turn on status sync for Jira first.');
    $this->actingAs(teamMember($team))->postJson($route, ['registered' => 'nonsense'])->assertForbidden();
});

it('never exposes the webhook token or secret outside the details endpoint', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter, ['webhookManual' => true]);
    $team = $integration->team;
    $admin = integrationAdmin($team);
    $this->actingAs($admin)->getJson(route('teams.integrations.trackerWebhook.show', [$team->workspace, $team, $integration]))->assertOk();
    $integration->refresh();
    $secrets = [$integration->credential('webhookToken'), $integration->credential('webhookSecret')];

    $page = $this->actingAs($admin)->get(route('teams.integrations.index', [$team->workspace, $team]))->assertOk()->getContent();
    $json = $this->actingAs($admin)->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), [])->assertOk()->getContent();

    foreach ($secrets as $secret) {
        expect($page)->not->toContain($secret)
            ->and($json)->not->toContain($secret)
            ->and(serialize(new RegisterTrackerWebhooks($integration->id)))->not->toContain($secret);
    }
});

it('deletes the webhooks when the connection is removed, best effort', function () {
    $integration = webhookIntegration(settings: ['webhookIds' => ['7001']]);
    $team = $integration->team;
    Http::fake([jiraApiUrl('rest/api/3/webhook') => Http::response(['errorMessages' => ['down']], 500)]);

    $this->actingAs(integrationAdmin($team))
        ->deleteJson(route('teams.integrations.destroy', [$team->workspace, $team, $integration]))
        ->assertNoContent();

    expect(TeamIntegration::query()->find($integration->id))->toBeNull();
    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE' && $request['webhookIds'] === [7001]);
});

it('removes the given webhooks', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter);
    Http::fake([jiraDataCenterUrl('rest/webhooks/1.0/webhook/12') => Http::response(null, 204)]);

    app()->call([new RemoveTrackerWebhooks($integration->id, ['12', '../x']), 'handle']);

    Http::assertSentCount(1);
    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE' && $request->url() === 'https://jira.example.com/rest/webhooks/1.0/webhook/12');
});

it('registers the webhook when a polling connection can switch to webhooks', function () {
    $integration = webhookIntegration(attributes: ['inbound_mode' => IntegrationInboundMode::Polling]);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    expect($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Webhook);
    Queue::assertPushed(RegisterTrackerWebhooks::class, fn (RegisterTrackerWebhooks $job) => $job->integrationId === $integration->id);
});

it('retries a rate-limited registration without counting a failure', function () {
    $integration = webhookIntegration();
    Http::fake([jiraApiUrl('rest/api/3/webhook') => Http::response(null, 429, ['Retry-After' => '40'])]);
    $job = (new RegisterTrackerWebhooks($integration->id))->withFakeQueueInteractions();

    app()->call([$job, 'handle']);

    $job->assertReleased(40);
    expect($integration->fresh()->setting('webhookIds'))->toBeNull();
});

it('quotes project keys in the webhook filter', function () {
    expect(TrackerWebhooks::jql(['OR', 'ENG']))->toBe('project in ("OR", "ENG")');
});

it('re-registers an expired Jira Cloud webhook instead of refreshing it, keeping its URL token', function () {
    $integration = webhookIntegration(
        settings: ['webhookIds' => ['7001'], 'webhookProjects' => ['ENG', 'PROJ']],
        attributes: ['webhook_expires_at' => now()->subDay(), 'webhook_status' => IntegrationWebhookStatus::Active, 'credentials' => ['access_token' => 'jira-access', 'refresh_token' => 'jira-refresh', 'expires_at' => now()->addHour()->getTimestamp(), 'webhookToken' => str_repeat('t', 40)]],
    );
    Http::fake([jiraApiUrl('rest/api/3/webhook') => fn (Request $request) => $request->method() === 'DELETE'
        ? Http::response(null, 202)
        : Http::response(['webhookRegistrationResult' => [['createdWebhookId' => 7002]]])]);

    runWebhookRegistration($integration);

    $integration->refresh();
    $methods = Http::recorded()->map(fn (array $pair) => $pair[0]->method())->all();
    expect($methods)->toBe(['POST', 'DELETE'])
        ->and($integration->setting('webhookIds'))->toBe(['7002'])
        ->and($integration->credential('webhookToken'))->toBe(str_repeat('t', 40))
        ->and($integration->webhook_expires_at?->toDateString())->toBe('2026-11-06');
    Http::assertSent(fn (Request $request) => $request->method() === 'POST' && str_contains($request['url'], str_repeat('t', 40)));
});

it('re-registers a failing webhook and marks it pending again', function () {
    $integration = webhookIntegration(
        settings: ['webhookIds' => ['7001'], 'webhookProjects' => ['ENG', 'PROJ']],
        attributes: ['webhook_expires_at' => now()->addDays(20), 'webhook_status' => IntegrationWebhookStatus::Failing],
    );
    Http::fake([jiraApiUrl('rest/api/3/webhook') => fn (Request $request) => $request->method() === 'DELETE'
        ? Http::response(null, 202)
        : Http::response(['webhookRegistrationResult' => [['createdWebhookId' => 7002]]])]);

    runWebhookRegistration($integration);

    expect($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Pending)
        ->and($integration->fresh()->setting('webhookIds'))->toBe(['7002']);
});

it('keeps old webhook ids whose deletion failed for a later removal', function () {
    $integration = webhookIntegration(settings: ['webhookIds' => ['7001'], 'webhookProjects' => ['PROJ']]);
    Http::fake([jiraApiUrl('rest/api/3/webhook') => fn (Request $request) => $request->method() === 'DELETE'
        ? Http::response(['errorMessages' => ['down']], 503)
        : Http::response(['webhookRegistrationResult' => [['createdWebhookId' => 7002]]])]);

    runWebhookRegistration($integration);

    expect($integration->fresh()->setting('webhookIds'))->toBe(['7002']);
    Queue::assertPushed(RemoveTrackerWebhooks::class, fn (RemoveTrackerWebhooks $job) => $job->webhookIds === ['7001']);
});

it('forces a registration when an admin asks, even for a current webhook', function () {
    $integration = webhookIntegration(
        settings: ['webhookIds' => ['7001'], 'webhookProjects' => ['ENG', 'PROJ']],
        attributes: ['webhook_expires_at' => now()->addDays(20), 'webhook_status' => IntegrationWebhookStatus::Active],
    );
    $team = $integration->team;
    Http::fake([jiraApiUrl('rest/api/3/webhook') => fn (Request $request) => $request->method() === 'DELETE'
        ? Http::response(null, 202)
        : Http::response(['webhookRegistrationResult' => [['createdWebhookId' => 7002]]])]);

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.trackerWebhook.store', [$team->workspace, $team, $integration]))
        ->assertStatus(202);
    Queue::assertPushed(RegisterTrackerWebhooks::class, fn (RegisterTrackerWebhooks $job) => $job->force);

    runWebhookRegistration($integration, true);

    expect($integration->fresh()->setting('webhookIds'))->toBe(['7002']);
});

it('queues a registration when a connection with an expired webhook switches to webhooks', function () {
    $integration = webhookIntegration(
        settings: ['webhookIds' => ['7001'], 'webhookProjects' => ['ENG', 'PROJ']],
        attributes: ['inbound_mode' => IntegrationInboundMode::Polling, 'webhook_expires_at' => now()->subDays(3)],
    );

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertPushed(RegisterTrackerWebhooks::class, fn (RegisterTrackerWebhooks $job) => $job->integrationId === $integration->id);
});

it('backs off a rejected registration until a day passes or the projects change', function () {
    $integration = webhookIntegration();
    Http::fake([jiraApiUrl('rest/api/3/webhook') => Http::response(['errorMessages' => ['Too many webhooks']], 400)]);

    runWebhookRegistration($integration);

    $integration->refresh();
    expect($integration->webhook_status)->toBe(IntegrationWebhookStatus::Failing);
    Http::assertSentCount(1);

    app(TrackerWebhooks::class)->registerIfNeeded($integration);
    Queue::assertNotPushed(RegisterTrackerWebhooks::class);

    ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
        'source' => IntegrationProvider::Jira,
        'external_site' => 'cloud-1',
        'external_id' => '10009',
        'external_key' => 'OPS-9',
    ]);
    app(TrackerWebhooks::class)->registerIfNeeded($integration);
    Queue::assertPushed(RegisterTrackerWebhooks::class, 1);
});

it('retries a rejected registration after a day', function () {
    $integration = webhookIntegration(settings: ['webhookFailedAt' => now()->subHours(25)->toIso8601String(), 'webhookFailedProjects' => ['ENG', 'PROJ']]);

    app(TrackerWebhooks::class)->registerIfNeeded($integration);

    Queue::assertPushed(RegisterTrackerWebhooks::class, 1);
});

it('treats webhooks already gone as removed and removes the rest', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter);
    Http::fake([
        jiraDataCenterUrl('rest/webhooks/1.0/webhook/12') => Http::response(null, 404),
        jiraDataCenterUrl('rest/webhooks/1.0/webhook/13') => Http::response(null, 204),
    ]);

    app()->call([new RemoveTrackerWebhooks($integration->id, ['12', '13']), 'handle']);

    Http::assertSentCount(2);
});

it('removes webhooks after sync was turned off', function () {
    $integration = webhookIntegration(settings: ['statusSync' => false]);
    Http::fake([jiraApiUrl('rest/api/3/webhook') => Http::response(null, 202)]);

    app()->call([new RemoveTrackerWebhooks($integration->id, ['7001']), 'handle']);

    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE' && $request['webhookIds'] === [7001]);
});

it('removes Jira Data Center webhooks when the connection is removed', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter, ['webhookIds' => ['12']]);
    $team = $integration->team;
    Http::fake([jiraDataCenterUrl('rest/webhooks/1.0/webhook/12') => Http::response(null, 204)]);

    $this->actingAs(integrationAdmin($team))
        ->deleteJson(route('teams.integrations.destroy', [$team->workspace, $team, $integration]))
        ->assertNoContent();

    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE' && $request->url() === 'https://jira.example.com/rest/webhooks/1.0/webhook/12');
});

it('keeps an active hand-registered webhook active when confirmed again', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter, ['webhookManual' => true], ['webhook_status' => IntegrationWebhookStatus::Active]);

    app(TrackerWebhooks::class)->confirmManual($integration);

    expect($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Active);
});

it('refuses to register next to a webhook registered by hand', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter, ['webhookManual' => true], ['webhook_status' => IntegrationWebhookStatus::Active]);
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.trackerWebhook.store', [$team->workspace, $team, $integration]))
        ->assertStatus(409)
        ->assertJsonPath('message', 'This webhook was registered by hand in Jira Data Center; skrum leaves it as it is.');

    Queue::assertNotPushed(RegisterTrackerWebhooks::class);
    expect($integration->fresh()->setting('webhookManual'))->toBeTrue();
});

it('asks to reconnect Jira Cloud connections without the webhook scope', function () {
    $integration = webhookIntegration(attributes: ['scopes' => ['read:jira-work']]);
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.trackerWebhook.store', [$team->workspace, $team, $integration]))
        ->assertStatus(409)
        ->assertJsonPath('message', 'Reconnect Jira so skrum can register its webhook.');

    Queue::assertNotPushed(RegisterTrackerWebhooks::class);
});
