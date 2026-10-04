<?php

use App\Enums\InboundEventStatus;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\ApplyInboundIssueChanges;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationInboundEvent;
use App\Models\TeamIntegration;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

const InboundJiraToken = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd';

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
    config([
        'services.integrations.inbound_webhooks' => 'on',
        'services.linear.webhook_secret' => 'linear-webhook-secret',
        'services.github_app.webhook_secret' => 'github-webhook-secret',
    ]);
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter, IntegrationProvider::Linear, IntegrationProvider::GitHub);
});

function jiraWebhookToken(TeamIntegration $integration, ?string $secret = null): TeamIntegration
{
    $integration->forceFill(['credentials' => [
        ...(array) $integration->readableCredentials(),
        'webhookToken' => InboundJiraToken,
        ...($secret === null ? [] : ['webhookSecret' => $secret]),
    ]])->save();

    return $integration;
}

function inboundJiraUrl(TeamIntegration $integration, string $token = InboundJiraToken, string $source = 'jira'): string
{
    return route('integrations.webhooks.tracker.store', ['source' => $source, 'integration' => $integration->id, 'token' => $token]);
}

function jiraWebhookBody(string $issueId = '10001'): string
{
    return json_encode(['webhookEvent' => 'jira:issue_updated', 'issue' => ['id' => $issueId, 'key' => 'PROJ-1', 'fields' => ['status' => ['name' => 'Done']]]], JSON_THROW_ON_ERROR);
}

/**
 * @param  array<string, string>  $headers
 */
function postInboundWebhook(string $url, string $body, array $headers = []): TestResponse
{
    $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];

    foreach ($headers as $name => $value) {
        $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
    }

    return test()->call('POST', $url, [], [], [], $server, $body);
}

/**
 * @param  array<string, mixed>  $payload
 * @return array{0: string, 1: array<string, string>}
 */
function signedLinearWebhook(array $payload = [], string $delivery = 'linear-delivery-1'): array
{
    $body = json_encode([
        'action' => 'update',
        'type' => 'Issue',
        'organizationId' => 'org-1',
        'data' => ['id' => 'lin-1'],
        'webhookTimestamp' => now()->getTimestampMs(),
        ...$payload,
    ], JSON_THROW_ON_ERROR);

    return [$body, ['Linear-Delivery' => $delivery, 'Linear-Signature' => hash_hmac('sha256', $body, 'linear-webhook-secret')]];
}

/**
 * @param  array<string, mixed>  $payload
 * @return array{0: string, 1: array<string, string>}
 */
function signedGitHubWebhook(string $event, array $payload, string $delivery = 'github-delivery-1'): array
{
    $body = json_encode(['installation' => ['id' => 4242], ...$payload], JSON_THROW_ON_ERROR);

    return [$body, [
        'X-GitHub-Event' => $event,
        'X-GitHub-Delivery' => $delivery,
        'X-Hub-Signature-256' => 'sha256='.hash_hmac('sha256', $body, 'github-webhook-secret'),
    ]];
}

/**
 * @param  array<string, mixed>  $claims
 */
function hs256Jwt(array $claims, string $secret): string
{
    $encode = fn (string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    $header = $encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
    $payload = $encode(json_encode($claims, JSON_THROW_ON_ERROR));

    return "{$header}.{$payload}.".$encode(hash_hmac('sha256', "{$header}.{$payload}", $secret, true));
}

function withStatusSync(TeamIntegration $integration): TeamIntegration
{
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true]])->save();

    return $integration;
}

it('accepts a Jira event with its URL token and queues a re-read', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody(), ['X-Atlassian-Webhook-Identifier' => 'delivery-1'])->assertAccepted()
        ->assertCookieMissing(config('session.cookie'));

    Queue::assertPushed(ApplyInboundIssueChanges::class, fn (ApplyInboundIssueChanges $job) => $job->integrationId === $integration->id
        && $job->externalIds === ['10001']);
    $event = IntegrationInboundEvent::query()->sole();
    expect($event->event_key)->toBe("{$integration->id}:delivery-1")
        ->and($event->event_type)->toBe('jira:issue_updated')
        ->and($event->status)->toBe(InboundEventStatus::Applied)
        ->and($event->team_integration_id)->toBe($integration->id)
        ->and($integration->fresh()->last_inbound_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00');
});

it('refuses a wrong token and logs once an hour', function () {
    Log::spy();
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration, str_repeat('x', 40)), jiraWebhookBody())->assertUnauthorized();
    postInboundWebhook(inboundJiraUrl($integration, str_repeat('y', 40)), jiraWebhookBody('10002'))->assertUnauthorized();

    Queue::assertNothingPushed();
    $rejected = IntegrationInboundEvent::query()->where('status', InboundEventStatus::Rejected->value)->get();
    expect($rejected)->toHaveCount(2)
        ->and($rejected->pluck('event_key')->every(fn (string $key) => str_starts_with($key, 'rejected:')))->toBeTrue()
        ->and($rejected->toJson())->not->toContain('PROJ-1')->not->toContain('10001');
    Log::shouldHaveReceived('warning')->once();
});

it('verifies the Atlassian JWT when one is sent', function (string $secret, int $expiresIn, int $status) {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);
    $jwt = hs256Jwt(['iss' => 'jira', 'exp' => now()->addSeconds($expiresIn)->getTimestamp()], $secret);

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody(), ['Authorization' => "Bearer {$jwt}"])->assertStatus($status);
})->with([
    'valid' => ['jira-secret', 60, 202],
    'other secret' => ['not-the-secret', 60, 401],
    'expired' => ['jira-secret', -300, 401],
]);

it('answers duplicates with 200 and no job', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody(), ['X-Atlassian-Webhook-Identifier' => 'same'])->assertAccepted();
    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody(), ['X-Atlassian-Webhook-Identifier' => 'same'])->assertOk();

    Queue::assertPushed(ApplyInboundIssueChanges::class, 1);
});

it('ignores issues skrum does not track', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody('99999'))->assertAccepted();

    Queue::assertNothingPushed();
    expect(IntegrationInboundEvent::query()->sole()->status)->toBe(InboundEventStatus::Ignored);
});

it('refuses bodies over 1 MB', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration), str_repeat('a', 1_048_577))->assertStatus(413);

    expect(IntegrationInboundEvent::query()->count())->toBe(0);
});

it('answers 404 where this instance cannot take the provider’s webhooks', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);
    [$linearBody, $linearHeaders] = signedLinearWebhook();

    config(['services.linear.webhook_secret' => '']);
    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'linear']), $linearBody, $linearHeaders)->assertNotFound();

    config(['services.integrations.inbound_webhooks' => 'off']);
    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody())->assertNotFound();

    config(['services.integrations.inbound_webhooks' => 'on']);
    disableIntegrations();
    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody())->assertNotFound();
});

it('checks the Jira Data Center signature when one is sent', function (?string $signatureSecret, int $status) {
    $integration = withStatusSync(TeamIntegration::factory()->jiraDataCenter()->create());
    jiraWebhookToken($integration, 'dc-webhook-secret');
    $body = jiraWebhookBody();
    $headers = $signatureSecret === null ? [] : ['X-Hub-Signature' => 'sha256='.hash_hmac('sha256', $body, $signatureSecret)];

    postInboundWebhook(inboundJiraUrl($integration, source: 'jira-dc'), $body, $headers)->assertStatus($status);
})->with([
    'signed' => ['dc-webhook-secret', 202],
    'badly signed' => ['another-secret', 401],
    'unsigned' => [null, 202],
]);

it('routes Linear events by organization to every synced team', function () {
    $first = withStatusSync(TeamIntegration::factory()->linear()->create());
    $second = withStatusSync(TeamIntegration::factory()->linear()->create());
    $off = TeamIntegration::factory()->linear()->create();

    foreach ([$first, $second, $off] as $integration) {
        ActionItemExternalLink::factory()->linear()->create([
            'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
            'external_id' => 'lin-1',
        ]);
    }

    [$body, $headers] = signedLinearWebhook();

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'linear']), $body, $headers)->assertAccepted();

    Queue::assertPushed(ApplyInboundIssueChanges::class, 2);
    Queue::assertNotPushed(ApplyInboundIssueChanges::class, fn (ApplyInboundIssueChanges $job) => $job->integrationId === $off->id);
});

it('refuses stale or badly signed Linear deliveries', function () {
    withStatusSync(TeamIntegration::factory()->linear()->create());
    [$stale, $staleHeaders] = signedLinearWebhook(['webhookTimestamp' => now()->subMinutes(2)->getTimestampMs()]);
    [$body] = signedLinearWebhook(delivery: 'linear-delivery-2');

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'linear']), $stale, $staleHeaders)->assertUnauthorized();
    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'linear']), $body, ['Linear-Signature' => str_repeat('0', 64)])->assertUnauthorized();

    Queue::assertNothingPushed();
});

it('queues a re-read for GitHub issue events of the installation', function () {
    $integration = withStatusSync(TeamIntegration::factory()->gitHub()->create());
    ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
        'source' => IntegrationProvider::GitHub,
        'external_site' => '4242',
        'external_id' => '9001/12',
        'external_key' => 'acme/api#12',
        'external_url' => 'https://github.com/acme/api/issues/12',
    ]);
    [$body, $headers] = signedGitHubWebhook('issues', ['action' => 'closed', 'issue' => ['number' => 12], 'repository' => ['id' => 9001, 'full_name' => 'acme/api']]);

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'github']), $body, $headers)->assertAccepted();

    Queue::assertPushed(ApplyInboundIssueChanges::class, fn (ApplyInboundIssueChanges $job) => $job->externalIds === ['9001/12']);
});

it('re-reads the issues of repositories removed from the installation', function () {
    $integration = withStatusSync(TeamIntegration::factory()->gitHub()->create());
    ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
        'source' => IntegrationProvider::GitHub,
        'external_site' => '4242',
        'external_id' => '9001/12',
        'external_key' => 'acme/api#12',
        'external_url' => 'https://github.com/acme/api/issues/12',
    ]);
    [$body, $headers] = signedGitHubWebhook('installation_repositories', ['action' => 'removed', 'repositories_removed' => [['id' => 9001]]]);

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'github']), $body, $headers)->assertAccepted();

    Queue::assertPushed(ApplyInboundIssueChanges::class, fn (ApplyInboundIssueChanges $job) => $job->externalIds === ['9001/12']);
});

it('asks every team of the installation to reconnect once GitHub confirms the removal', function (string $action, array $installation, int $status, string $message) {
    $first = TeamIntegration::factory()->gitHub()->create();
    $second = TeamIntegration::factory()->gitHub()->create();
    $other = TeamIntegration::factory()->gitHub()->create();
    $other->forceFill(['settings' => [...$other->settings, 'installationId' => '5151']])->save();
    Cache::put('github-installation-token:4242', 'cached', now()->addMinutes(50));
    Http::fake(['api.github.com/app/installations/4242' => Http::response($installation, $status)]);
    [$body, $headers] = signedGitHubWebhook('installation', ['action' => $action]);

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'github']), $body, $headers)->assertAccepted();

    expect($first->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($second->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($first->fresh()->last_error)->toBe($message)
        ->and($other->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and(Cache::has('github-installation-token:4242'))->toBeFalse();
})->with([
    'deleted' => ['deleted', ['message' => 'Not Found'], 404, 'The GitHub App was uninstalled from acme.'],
    'suspended' => ['suspend', ['id' => 4242, 'suspended_at' => '2026-10-07T10:29:00Z'], 200, 'The GitHub App is suspended on acme.'],
]);

it('ignores installation removals GitHub does not confirm', function () {
    $integration = TeamIntegration::factory()->gitHub()->create();
    Cache::put('github-installation-token:4242', 'cached', now()->addMinutes(50));
    Http::fake(['api.github.com/app/installations/4242' => Http::response(['id' => 4242, 'suspended_at' => null])]);
    [$body, $headers] = signedGitHubWebhook('installation', ['action' => 'suspend']);

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'github']), $body, $headers)->assertAccepted();

    expect($integration->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and(Cache::has('github-installation-token:4242'))->toBeTrue()
        ->and(IntegrationInboundEvent::query()->sole()->status)->toBe(InboundEventStatus::Ignored);
});

it('treats a replayed installation event under a new delivery id as a duplicate', function () {
    TeamIntegration::factory()->gitHub()->create();
    Http::fake(['api.github.com/app/installations/4242' => Http::response(['id' => 4242, 'suspended_at' => '2026-10-07T10:29:00Z'])]);
    [$body, $headers] = signedGitHubWebhook('installation', ['action' => 'suspend']);
    $url = route('integrations.webhooks.store', ['source' => 'github']);

    postInboundWebhook($url, $body, $headers)->assertAccepted();
    postInboundWebhook($url, $body, [...$headers, 'X-GitHub-Delivery' => 'github-delivery-2'])->assertOk();

    Http::assertSentCount(1);
});

it('keeps Jira delivery ids apart per connection', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);
    $other = jiraWebhookToken(withStatusSync(TeamIntegration::factory()->jira()->create()));

    postInboundWebhook(inboundJiraUrl($other), jiraWebhookBody(), ['X-Atlassian-Webhook-Identifier' => 'same'])->assertAccepted();
    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody(), ['X-Atlassian-Webhook-Identifier' => 'same'])->assertAccepted();

    Queue::assertPushed(ApplyInboundIssueChanges::class, fn (ApplyInboundIssueChanges $job) => $job->integrationId === $integration->id);
    expect(IntegrationInboundEvent::query()->count())->toBe(2);
});

it('refuses a badly signed GitHub delivery', function () {
    [$body, $headers] = signedGitHubWebhook('issues', ['action' => 'closed']);

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'github']), $body, [...$headers, 'X-Hub-Signature-256' => 'sha256='.str_repeat('0', 64)])
        ->assertUnauthorized();
});

it('refuses an unknown connection like a wrong token and 404s a malformed token', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(route('integrations.webhooks.tracker.store', ['source' => 'jira', 'integration' => fake()->uuid(), 'token' => InboundJiraToken]), jiraWebhookBody())
        ->assertUnauthorized();
    postInboundWebhook(inboundJiraUrl($integration, substr(InboundJiraToken, 1)), jiraWebhookBody())->assertNotFound();
});

it('keeps no event row when the re-read cannot be queued, so the provider retry is not a duplicate', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);
    Bus::shouldReceive('dispatch')->andThrow(new RuntimeException('Queue unavailable'));

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody(), ['X-Atlassian-Webhook-Identifier' => 'delivery-1'])->assertServerError();

    expect(IntegrationInboundEvent::query()->count())->toBe(0);
});

it('lets a change arriving during a re-read queue another one', function () {
    expect(new ApplyInboundIssueChanges('integration', ['10001']))->toBeInstanceOf(ShouldBeUniqueUntilProcessing::class);
});

it('marks the webhook active on its first verified event', function () {
    ['integration' => $integration] = statusSyncLink();
    $integration->forceFill(['webhook_status' => IntegrationWebhookStatus::Pending])->save();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody())->assertAccepted();

    expect($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Active);
});

it('trusts the API, not the payload', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink();
    $event = IntegrationInboundEvent::factory()->create(['team_integration_id' => $integration->id, 'status' => InboundEventStatus::Applied]);
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', [
        'status' => ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
        'project' => ['key' => 'PROJ'],
    ])]);

    app()->call([new ApplyInboundIssueChanges($integration->id, ['10001'], $event->id)->withFakeQueueInteractions(), 'handle']);

    expect($item->fresh()->completed_at)->toBeNull()
        ->and($event->fresh()->status)->toBe(InboundEventStatus::Applied);
});

it('reads nothing for connections whose sync was turned off meanwhile', function () {
    ['integration' => $integration] = statusSyncLink(syncOn: false);
    $event = IntegrationInboundEvent::factory()->create(['team_integration_id' => $integration->id]);

    app()->call([new ApplyInboundIssueChanges($integration->id, ['10001'], $event->id)->withFakeQueueInteractions(), 'handle']);

    Http::assertNothingSent();
    expect($event->fresh()->status)->toBe(InboundEventStatus::Ignored);
});

it('processes a redelivered installation event when GitHub could not confirm it the first time', function () {
    $integration = TeamIntegration::factory()->gitHub()->create();
    Http::fake(['api.github.com/app/installations/4242' => Http::sequence()
        ->push(['message' => 'Server Error'], 500)
        ->push(['id' => 4242, 'suspended_at' => '2026-10-07T10:29:00Z'])]);
    [$body, $headers] = signedGitHubWebhook('installation', ['action' => 'suspend']);
    $url = route('integrations.webhooks.store', ['source' => 'github']);

    postInboundWebhook($url, $body, $headers)->assertServiceUnavailable();

    expect(IntegrationInboundEvent::query()->count())->toBe(0)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);

    postInboundWebhook($url, $body, $headers)->assertAccepted();

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('marks webhooks of a connection listening to them active when an event arrives', function () {
    $integration = withStatusSync(TeamIntegration::factory()->linear()->create());
    $integration->forceFill(['inbound_mode' => IntegrationInboundMode::Webhook, 'webhook_status' => null])->save();
    [$body, $headers] = signedLinearWebhook();

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'linear']), $body, $headers)->assertAccepted();

    expect($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Active);
});
