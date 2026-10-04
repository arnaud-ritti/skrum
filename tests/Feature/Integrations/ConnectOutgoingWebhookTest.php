<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\HostResolver;
use App\Support\Integrations\Webhook\WebhookHealth;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();
});

/**
 * @return array{0: Team, 1: User}
 */
function outgoingWebhookAdmin(): array
{
    $team = Team::factory()->create();

    return [$team, integrationAdmin($team)];
}

it('connects a webhook and shows its signing secret once', function () {
    [$team, $admin] = outgoingWebhookAdmin();

    $response = $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), [
            'url' => TeamIntegrationFactory::WebhookUrl,
            'channel_label' => '  Zapier  ',
        ]);

    $response->assertCreated()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJson([
            'provider' => 'webhook',
            'status' => 'active',
            'settings' => ['host' => 'hooks.example.com', 'channelLabel' => 'Zapier', 'events' => []],
            'webhook' => ['consecutiveFailures' => 0, 'lastDeliverySucceededAt' => null],
            'connectedBy' => $admin->name,
        ]);

    $secret = $response->json('secret');
    $integration = TeamIntegration::query()->sole();

    expect($secret)->toMatch('/^[0-9a-f]{64}$/')
        ->and($integration->credential('webhookSecret'))->toBe($secret)
        ->and($integration->credential('url'))->toBe(TeamIntegrationFactory::WebhookUrl)
        ->and($integration->getRawOriginal('credentials'))->not->toContain($secret)
        ->and($response->json('settings.secretCreatedAt'))->not->toBeNull()
        ->and($response->getContent())->not->toContain('skrum/incoming');
    Http::assertNothingSent();
});

it('refuses private and invalid endpoints', function (string $url, array $addresses) {
    [$team, $admin] = outgoingWebhookAdmin();
    outgoingWebhookResolves($addresses);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), ['url' => $url])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['url' => 'This URL points to a private or invalid address.']);

    expect(TeamIntegration::query()->count())->toBe(0);
})->with([
    'loopback' => ['https://hooks.example.com/x', ['127.0.0.1']],
    'cloud metadata' => ['https://hooks.example.com/x', ['169.254.169.254']],
    'plain http' => ['http://hooks.example.com/x', ['93.184.216.34']],
    'user info' => ['https://user:pass@hooks.example.com/x', ['93.184.216.34']],
    'unresolvable' => ['https://nowhere.example.com/x', []],
]);

it('accepts private http endpoints when the instance allows them', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    outgoingWebhookResolves(['10.0.0.5']);
    config([
        'services.outgoing_webhooks.allow_http' => true,
        'services.outgoing_webhooks.allow_private_networks' => true,
    ]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), ['url' => 'http://ci.internal:8080/hooks'])
        ->assertCreated()
        ->assertJson(['settings' => ['host' => 'ci.internal']]);
});

it('answers 404 while outgoing webhooks are disabled', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    config(['services.outgoing_webhooks.enabled' => false]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), ['url' => TeamIntegrationFactory::WebhookUrl])
        ->assertNotFound();
});

it('is reserved to workspace owners and admins, before validation', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    $this->mock(HostResolver::class, fn (MockInterface $mock) => $mock->shouldNotReceive('addresses'));

    $this->actingAs($member)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), ['url' => 'https://127.0.0.1/x'])
        ->assertForbidden();
    $this->actingAs($member)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['events' => ['nope']])
        ->assertForbidden();
    $this->actingAs($member)
        ->postJson(route('teams.integrations.secret.store', [$team->workspace, $team, $integration]))
        ->assertForbidden();
    $this->actingAs($member)
        ->getJson(route('teams.integrations.deliveries.index', [$team->workspace, $team, $integration]))
        ->assertForbidden();

    expect($integration->fresh()->credential('webhookSecret'))->toBe(TeamIntegrationFactory::WebhookSecret);
});

it('replaces a webhook with a new secret and no subscriptions', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $existing = TeamIntegration::factory()->webhook(['retro.completed'])->create(['team_id' => $team->id]);
    $existing->forceFill(['consecutive_failures' => 5])->save();

    $response = $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), ['url' => 'https://other.example.com/in'])
        ->assertCreated()
        ->assertJson(['settings' => ['host' => 'other.example.com', 'events' => []], 'webhook' => ['consecutiveFailures' => 0]]);

    $integration = TeamIntegration::query()->sole();

    expect($response->json('secret'))->not->toBe(TeamIntegrationFactory::WebhookSecret)
        ->and($integration->id)->toBe($existing->id)
        ->and($integration->credential('webhookSecret'))->toBe($response->json('secret'));
});

it('updates the label, the URL and the subscriptions without changing the secret', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook(['retro.completed'])->create(['team_id' => $team->id]);
    $url = route('teams.integrations.update', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->patchJson($url, ['channel_label' => 'n8n'])
        ->assertOk()
        ->assertJson(['settings' => ['channelLabel' => 'n8n', 'events' => ['retro.completed']]])
        ->assertJsonMissingPath('secret');

    $this->actingAs($admin)->patchJson($url, ['events' => ['poker.task.estimated', 'retro.completed']])
        ->assertOk()
        ->assertJson(['settings' => ['events' => ['retro.completed', 'poker.task.estimated']]]);

    $this->actingAs($admin)->patchJson($url, ['url' => 'https://other.example.com/in'])
        ->assertOk()
        ->assertJson(['settings' => ['host' => 'other.example.com', 'channelLabel' => 'n8n']]);

    $this->actingAs($admin)->patchJson($url, ['events' => ['card.created']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['events.0']);
    $this->actingAs($admin)->patchJson($url, ['events' => ['retro.completed', 'retro.completed']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['events.0']);
    $this->actingAs($admin)->patchJson($url, ['events' => 'retro.completed'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['events']);

    outgoingWebhookResolves(['10.0.0.1']);

    $this->actingAs($admin)->patchJson($url, ['url' => 'https://internal.example.com/in'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['url' => 'This URL points to a private or invalid address.']);

    $fresh = $integration->fresh();

    expect($fresh->credential('url'))->toBe('https://other.example.com/in')
        ->and($fresh->credential('webhookSecret'))->toBe(TeamIntegrationFactory::WebhookSecret)
        ->and($fresh->setting('events'))->toBe(['retro.completed', 'poker.task.estimated']);
});

it('re-enables a disabled webhook, and ignores re-enabling an active one', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('Disabled after 10 failed deliveries in a row.')->create(['team_id' => $team->id]);
    $integration->forceFill([
        'consecutive_failures' => 10,
        'settings' => [...$integration->settings, 'disabledReason' => WebhookHealth::FailuresReason],
    ])->save();
    $url = route('teams.integrations.update', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->patchJson($url, ['enabled' => true])
        ->assertOk()
        ->assertJson(['status' => 'active', 'lastError' => null, 'webhook' => ['consecutiveFailures' => 0]])
        ->assertJsonMissingPath('settings.disabledReason');

    $this->actingAs($admin)->patchJson($url, ['enabled' => true])
        ->assertOk()
        ->assertJson(['status' => 'active']);
});

it('re-activates a disabled webhook when its URL is replaced', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('The receiver asked skrum to stop.')->create(['team_id' => $team->id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'disabledReason' => WebhookHealth::GoneReason]])->save();

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['url' => 'https://other.example.com/in'])
        ->assertOk()
        ->assertJson(['status' => 'active', 'lastError' => null])
        ->assertJsonMissingPath('settings.disabledReason');
});

it('refuses to re-enable a webhook whose stored URL is no longer allowed', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('This webhook URL is no longer allowed. Paste a new one.')->create(['team_id' => $team->id]);
    $integration->forceFill(['credentials' => ['url' => 'http://hooks.example.com/in', 'webhookSecret' => TeamIntegrationFactory::WebhookSecret]])->save();

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['enabled' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['enabled']);

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('resets the failure count and the last success when the URL changes, even while active', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    $integration->forceFill(['consecutive_failures' => 6, 'last_delivery_succeeded_at' => now()->subDay()])->save();

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['url' => 'https://other.example.com/in'])
        ->assertOk()
        ->assertJson(['status' => 'active', 'webhook' => ['consecutiveFailures' => 0, 'lastDeliverySucceededAt' => null]]);

    expect($integration->fresh()->consecutive_failures)->toBe(0)
        ->and($integration->fresh()->last_delivery_succeeded_at)->toBeNull();
});

it('rotates the signing secret', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);

    $secret = $this->actingAs($admin)
        ->postJson(route('teams.integrations.secret.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->json('secret');

    expect($secret)->toMatch('/^[0-9a-f]{64}$/')
        ->and($secret)->not->toBe(TeamIntegrationFactory::WebhookSecret)
        ->and($integration->fresh()->setting('secretCreatedAt'))->not->toBe('2026-10-01T09:00:00Z');

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertOk();

    Http::assertSent(fn (Request $request) => outgoingWebhookSignatureIsValid($request, $secret)
        && ! outgoingWebhookSignatureIsValid($request));
});

it('answers 404 for the secret and the log of another kind of integration', function () {
    enableIntegrations(IntegrationProvider::Slack);
    [$team, $admin] = outgoingWebhookAdmin();
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);

    $this->actingAs($admin)->postJson(route('teams.integrations.secret.store', [$team->workspace, $team, $slack]))->assertNotFound();
    $this->actingAs($admin)->getJson(route('teams.integrations.deliveries.index', [$team->workspace, $team, $slack]))->assertNotFound();
});

it('sends a signed test request that is not logged', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    Http::fake(['hooks.example.com/*' => Http::response('', 200)]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonMissingPath('secret');

    Http::assertSent(fn (Request $request) => $request->header('X-Skrum-Event')[0] === 'webhook.test'
        && json_decode($request->body(), true)['data'] === ['message' => 'skrum is connected.']
        && outgoingWebhookSignatureIsValid($request));
    expect(IntegrationDelivery::query()->count())->toBe(0)
        ->and($integration->fresh()->last_checked_at)->not->toBeNull()
        ->and($integration->fresh()->last_delivery_succeeded_at)->toBeNull();
});

it('tests a disabled webhook without re-enabling it', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('Disabled after 10 failed deliveries in a row.')->create(['team_id' => $team->id]);
    Http::fake(['hooks.example.com/*' => Http::response('', 200)]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJson(['status' => 'reconnect_required', 'lastError' => 'Disabled after 10 failed deliveries in a row.']);
});

it('reports a refused test', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertUnprocessable()
        ->assertJson(['message' => 'The receiver answered 404.']);

    expect($integration->fresh()->consecutive_failures)->toBe(0);
});

it('lists deliveries newest first, 25 per page', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    IntegrationDelivery::factory()->count(30)
        ->sequence(fn ($sequence) => ['created_at' => now()->subMinutes($sequence->index), 'event' => "event-{$sequence->index}"])
        ->create([
            'team_id' => $team->id,
            'channel' => IntegrationDeliveryChannel::Webhook,
            'kind' => IntegrationDeliveryKind::Event,
            'team_integration_id' => $integration->id,
            'attempts' => 2,
            'response_status' => 503,
            'requested_by_user_id' => null,
        ]);
    IntegrationDelivery::factory()->create(['team_id' => $team->id, 'channel' => IntegrationDeliveryChannel::Slack]);
    IntegrationDelivery::factory()->create(['channel' => IntegrationDeliveryChannel::Webhook]);
    $url = route('teams.integrations.deliveries.index', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->getJson($url)
        ->assertOk()
        ->assertJsonCount(25, 'data')
        ->assertJson([
            'currentPage' => 1,
            'lastPage' => 2,
            'total' => 30,
            'data' => [['event' => 'event-0', 'kind' => 'event', 'status' => 'queued', 'attempts' => 2, 'responseStatus' => 503, 'error' => null]],
        ]);

    $this->actingAs($admin)->getJson("{$url}?page=2")
        ->assertOk()
        ->assertJsonCount(5, 'data')
        ->assertJsonPath('data.4.event', 'event-29');
});

it('never serializes the URL or the secret on the integrations page', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/integrations')
            ->where('providers.0.provider', 'webhook')
            ->where('providers.0.label', 'Webhook')
            ->where('providers.0.connection.settings', [
                'host' => 'hooks.example.com',
                'channelLabel' => null,
                'secretCreatedAt' => '2026-10-01T09:00:00Z',
                'events' => [],
            ])
            ->where('providers.0.connection.webhook', ['consecutiveFailures' => 0, 'lastDeliverySucceededAt' => null])
            ->has('webhookEvents', 5)
            ->where('webhookEvents.0', ['name' => 'retro.completed', 'description' => 'A retrospective is completed, with its results recap.']))
        ->assertDontSee(TeamIntegrationFactory::WebhookSecret)
        ->assertDontSee('skrum/incoming');
});

it('disconnects without calling the receiver', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->deleteJson(route('teams.integrations.destroy', [$team->workspace, $team, $integration]))
        ->assertNoContent();

    expect(TeamIntegration::query()->count())->toBe(0);
    Http::assertNothingSent();
});

it('re-validates stored URLs in the daily check without calling them', function () {
    config(['services.outgoing_webhooks.allow_http' => true]);
    $plain = TeamIntegration::factory()->webhook()->create([
        'credentials' => ['url' => 'http://hooks.example.com/in', 'webhookSecret' => TeamIntegrationFactory::WebhookSecret],
    ]);
    $secure = TeamIntegration::factory()->webhook()->create();
    config(['services.outgoing_webhooks.allow_http' => false]);
    $this->mock(HostResolver::class, fn (MockInterface $mock) => $mock->shouldNotReceive('addresses'));

    $this->artisan('skrum:check-integrations')->assertSuccessful();

    expect($plain->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($plain->fresh()->last_error)->toBe('This webhook URL is no longer allowed. Paste a new one.')
        ->and($secure->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($secure->fresh()->last_checked_at)->not->toBeNull();
    Http::assertNothingSent();
});
