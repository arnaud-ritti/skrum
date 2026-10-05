<?php

use App\Actions\Integrations\ListPokerSources;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Actions\Integrations\ToggleStatusSync;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\PushActionItemState;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Jobs\Integrations\RemoveTrackerWebhooks;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\TeamIntegration;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
    config(['services.integrations.inbound_webhooks' => 'off', 'services.integrations.poll_minutes' => 5]);
});

function syncSettingsIntegration(IntegrationProvider $provider = IntegrationProvider::Jira, array $settings = [], array $attributes = []): TeamIntegration
{
    enableIntegrations($provider);
    $factory = TeamIntegration::factory();
    $integration = (match ($provider) {
        IntegrationProvider::Linear => $factory->linear(),
        IntegrationProvider::GitHub => $factory->gitHub(),
        IntegrationProvider::JiraDataCenter => $factory->jiraDataCenter(),
        default => $factory->jira(),
    })->create();
    $integration->forceFill(['settings' => [...$integration->settings, ...$settings], ...$attributes])->save();

    return $integration->fresh() ?? $integration;
}

function syncSettingsRoute(TeamIntegration $integration): string
{
    return route('teams.integrations.update', [$integration->team->workspace, $integration->team, $integration]);
}

it('reserves status sync to owners and admins, before validation', function () {
    $integration = syncSettingsIntegration();

    $this->actingAs(teamMember($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => 'nonsense'])
        ->assertForbidden();

    expect($integration->fresh()->setting('statusSync'))->toBeNull();
});

it('turns sync on with a first full read and no push', function () {
    $integration = syncSettingsIntegration();

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true])
        ->assertOk()
        ->assertJsonPath('statusSync', true)
        ->assertJsonPath('inboundMode', 'polling')
        ->assertJsonPath('webhookStatus', null);

    expect($integration->fresh()->setting('statusSyncSince'))->toBe('2026-10-07T10:30:00+00:00');
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $integration->id && $job->full && $job->initial);
    Queue::assertNotPushed(PushActionItemState::class);
    Queue::assertNotPushed(RegisterTrackerWebhooks::class);
});

it('registers Jira webhooks when the instance can receive them', function () {
    config(['services.integrations.inbound_webhooks' => 'on']);
    $integration = syncSettingsIntegration();

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true])
        ->assertOk()
        ->assertJsonPath('inboundMode', 'webhook');

    Queue::assertPushed(RegisterTrackerWebhooks::class);
});

it('starts Linear and GitHub webhooks as pending', function (IntegrationProvider $provider) {
    config([
        'services.integrations.inbound_webhooks' => 'on',
        'services.linear.webhook_secret' => 'linear-webhook-secret',
        'services.github_app.webhook_secret' => 'github-webhook-secret',
    ]);
    $integration = syncSettingsIntegration($provider);

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true])
        ->assertOk()
        ->assertJsonPath('inboundMode', 'webhook')
        ->assertJsonPath('webhookStatus', 'pending');
})->with([IntegrationProvider::Linear, IntegrationProvider::GitHub]);

it('refuses to turn sync on for a connection that needs a reconnect', function () {
    $integration = syncSettingsIntegration(attributes: ['status' => IntegrationStatus::ReconnectRequired]);

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true])
        ->assertStatus(409);

    Queue::assertNothingPushed();
});

it('turns sync off and removes the registered webhooks', function () {
    $integration = syncSettingsIntegration(
        settings: ['statusSync' => true, 'webhookIds' => ['7001'], 'webhookProjects' => ['PROJ']],
        attributes: ['inbound_mode' => IntegrationInboundMode::Webhook, 'webhook_status' => IntegrationWebhookStatus::Active],
    );

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => false])
        ->assertOk()
        ->assertJsonPath('statusSync', false)
        ->assertJsonPath('inboundMode', 'off');

    expect($integration->fresh()->webhook_status)->toBeNull()
        ->and($integration->fresh()->setting('webhookIds'))->toBe([]);
    Queue::assertPushed(RemoveTrackerWebhooks::class, fn (RemoveTrackerWebhooks $job) => $job->webhookIds === ['7001']);
});

it('saves "Treat canceled as done" for Linear and GitHub only, and re-reads', function () {
    $linear = syncSettingsIntegration(IntegrationProvider::Linear, ['statusSync' => true]);
    $jira = syncSettingsIntegration(IntegrationProvider::Jira, ['statusSync' => true]);

    $this->actingAs(integrationAdmin($linear->team))
        ->patchJson(syncSettingsRoute($linear), ['treat_canceled_as_done' => false])
        ->assertOk()
        ->assertJsonPath('settings.treatCanceledAsDone', false);

    $this->actingAs(integrationAdmin($jira->team))
        ->patchJson(syncSettingsRoute($jira), ['treat_canceled_as_done' => false])
        ->assertOk();

    expect($jira->fresh()->setting('treatCanceledAsDone'))->toBeNull();
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $linear->id && $job->full && ! $job->initial);
});

it('saves and resets a status mapping per project', function () {
    $integration = syncSettingsIntegration();
    $admin = integrationAdmin($integration->team);

    $this->actingAs($admin)->patchJson(syncSettingsRoute($integration), ['status_mapping' => [
        'container' => 'PROJ',
        'done_status_ids' => ['10002', '10005'],
        'complete_status_id' => '10002',
    ]])->assertOk();

    expect($integration->fresh()->setting('statusMapping'))->toBeIgnoringKeyOrder(['projects' => ['PROJ' => [
        'doneStatusIds' => ['10002', '10005'],
        'startStatusId' => null,
        'completeStatusId' => '10002',
        'reopenStatusId' => null,
    ]]]);

    $this->actingAs($admin)->patchJson(syncSettingsRoute($integration), ['status_mapping' => ['container' => 'PROJ']])->assertOk();

    expect($integration->fresh()->setting('statusMapping'))->toBe(['projects' => []]);
});

it('validates status mappings', function (IntegrationProvider $provider, array $mapping, string $invalidField) {
    $integration = syncSettingsIntegration($provider);

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_mapping' => $mapping])
        ->assertUnprocessable()
        ->assertOnlyJsonValidationErrors($invalidField);
})->with([
    'unsafe container' => [IntegrationProvider::Jira, ['container' => '../PROJ'], 'status_mapping.container'],
    'jira status id' => [IntegrationProvider::Jira, ['container' => 'PROJ', 'complete_status_id' => 'abc'], 'status_mapping.complete_status_id'],
    'unknown key' => [IntegrationProvider::Jira, ['container' => 'PROJ', 'complete_state_id' => 'x'], 'status_mapping'],
    'linear state id' => [IntegrationProvider::Linear, ['container' => 'ENG', 'complete_state_id' => 'has spaces'], 'status_mapping.complete_state_id'],
    'empty mapping' => [IntegrationProvider::Jira, [], 'status_mapping'],
    'jira start status id' => [IntegrationProvider::Jira, ['container' => 'PROJ', 'start_status_id' => 'abc'], 'status_mapping.start_status_id'],
    'linear start state id' => [IntegrationProvider::Linear, ['container' => 'ENG', 'start_state_id' => 'has spaces'], 'status_mapping.start_state_id'],
    'linear key on jira' => [IntegrationProvider::Jira, ['container' => 'PROJ', 'start_state_id' => 'x'], 'status_mapping'],
]);

it('saves and resets a start status per Jira project and a start state per Linear team', function () {
    $jira = syncSettingsIntegration();
    $admin = integrationAdmin($jira->team);

    $this->actingAs($admin)->patchJson(syncSettingsRoute($jira), ['status_mapping' => ['container' => 'PROJ', 'start_status_id' => '3']])->assertOk();

    expect($jira->fresh()->setting('statusMapping'))->toBeIgnoringKeyOrder(['projects' => ['PROJ' => [
        'doneStatusIds' => null,
        'startStatusId' => '3',
        'completeStatusId' => null,
        'reopenStatusId' => null,
    ]]]);

    $linear = syncSettingsIntegration(IntegrationProvider::Linear);

    $this->actingAs(integrationAdmin($linear->team))->patchJson(syncSettingsRoute($linear), ['status_mapping' => ['container' => 'ENG', 'start_state_id' => 'st-started']])->assertOk();

    expect($linear->fresh()->setting('statusMapping'))->toBeIgnoringKeyOrder(['teams' => ['ENG' => [
        'startStateId' => 'st-started',
        'completeStateId' => null,
        'reopenStateId' => null,
    ]]]);

    $this->actingAs($admin)->patchJson(syncSettingsRoute($jira), ['status_mapping' => ['container' => 'PROJ', 'start_status_id' => null]])->assertOk();

    expect($jira->fresh()->setting('statusMapping'))->toBe(['projects' => []]);
});

it('lists the projects of tracked issues and their statuses', function () {
    $integration = syncSettingsIntegration(settings: ['statusSync' => true]);
    ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
        'external_key' => 'PROJ-4',
    ]);
    Http::fake([jiraApiUrl('rest/api/3/project/PROJ/statuses') => Http::response([
        ['id' => '1', 'name' => 'Story', 'statuses' => [['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']]]],
    ])]);
    $team = $integration->team;
    $admin = integrationAdmin($team);
    $route = route('teams.integrations.statuses.index', [$team->workspace, $team, $integration]);

    $this->actingAs(teamMember($team))->getJson($route)->assertForbidden();
    $this->actingAs($admin)->getJson($route)->assertOk()->assertExactJson(['containers' => ['PROJ']]);
    $this->actingAs($admin)->getJson($route.'?container=PROJ')->assertOk()->assertExactJson([
        'statuses' => [['id' => '10002', 'name' => 'Done', 'category' => 'done']],
    ]);
    $this->actingAs($admin)->getJson($route.'?container=..%2Fx')->assertUnprocessable();

    $gitHub = syncSettingsIntegration(IntegrationProvider::GitHub);
    $this->actingAs(integrationAdmin($gitHub->team))
        ->getJson(route('teams.integrations.statuses.index', [$gitHub->team->workspace, $gitHub->team, $gitHub]))
        ->assertNotFound();
});

it('presents the sync state without secrets', function () {
    $integration = syncSettingsIntegration(
        settings: ['statusSync' => true, 'statusMapping' => ['projects' => ['PROJ' => ['doneStatusIds' => null, 'startStatusId' => '3', 'completeStatusId' => null, 'reopenStatusId' => null]]]],
        attributes: ['inbound_mode' => IntegrationInboundMode::Polling, 'last_polled_at' => '2026-10-07 10:25:00'],
    );
    $integration->forceFill(['credentials' => [...(array) $integration->readableCredentials(), 'webhookToken' => 'TopSecretWebhookToken0123456789abcdefgh']])->save();
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertDontSee('TopSecretWebhookToken0123456789abcdefgh')
        ->assertInertia(fn (Assert $page) => $page
            ->where('pollMinutes', 5)
            ->where('providers.0.connection.statusSync', true)
            ->where('providers.0.connection.inboundMode', 'polling')
            ->where('providers.0.connection.webhookStatus', null)
            ->where('providers.0.connection.lastPolledAt', '2026-10-07T10:25:00+00:00')
            ->where('providers.0.connection.lastInboundAt', null)
            ->where('providers.0.connection.inboundHint', null)
            ->where('providers.0.connection.settings.statusMapping.projects.PROJ.startStatusId', '3'));
});

it('presents the start target as null in a mapping saved before it existed', function (IntegrationProvider $provider, string $group, array $saved, string $startKey) {
    $integration = syncSettingsIntegration($provider, settings: ['statusMapping' => [$group => ['KEY' => $saved]]]);

    $mapping = resolve(PresentTeamIntegration::class)->handle($integration)['settings']['statusMapping'][$group]['KEY'];

    expect($mapping)->toHaveKey($startKey)
        ->and($mapping[$startKey])->toBeNull()
        ->and($mapping)->toMatchArray($saved);
})->with([
    'jira' => [IntegrationProvider::Jira, 'projects', ['doneStatusIds' => ['10002'], 'completeStatusId' => '10002', 'reopenStatusId' => null], 'startStatusId'],
    'jira data center' => [IntegrationProvider::JiraDataCenter, 'projects', ['doneStatusIds' => null, 'completeStatusId' => null, 'reopenStatusId' => '1'], 'startStatusId'],
    'linear' => [IntegrationProvider::Linear, 'teams', ['completeStateId' => 'state-done', 'reopenStateId' => null], 'startStateId'],
]);

it('tells MCP clients which trackers sync and how', function () {
    $integration = syncSettingsIntegration();

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true])
        ->assertOk();

    expect(resolve(ListPokerSources::class)->handle($integration->team->fresh())[0])
        ->toMatchArray(['source' => 'jira', 'canSyncStatus' => true, 'syncMode' => 'polling']);
});

it('keeps a distinct first read pending each time sync is turned on, until it is turned off', function () {
    $integration = syncSettingsIntegration();
    $admin = integrationAdmin($integration->team);

    $this->actingAs($admin)->patchJson(syncSettingsRoute($integration), ['status_sync' => true])->assertOk();
    $firstMarker = $integration->fresh()->setting('initialReadPending');

    $this->actingAs($admin)->patchJson(syncSettingsRoute($integration), ['status_sync' => false])->assertOk();

    expect($integration->fresh()->setting('initialReadPending'))->toBeNull();

    $this->actingAs($admin)->patchJson(syncSettingsRoute($integration), ['status_sync' => true])->assertOk();

    expect($firstMarker)->toBeString()->toHaveLength(40)
        ->and($integration->fresh()->setting('initialReadPending'))->toBeString()->not->toBe($firstMarker);
});

it('re-reads after a mapping change sent with sync already on', function () {
    $integration = syncSettingsIntegration(settings: ['statusSync' => true]);

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true, 'status_mapping' => ['container' => 'PROJ', 'complete_status_id' => '10002']])
        ->assertOk();

    Queue::assertPushed(ReadTrackedIssues::class, 1);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->full && $job->remapped && ! $job->initial);
});

it('saves nothing when sync cannot be turned on', function () {
    $integration = syncSettingsIntegration(IntegrationProvider::Linear, attributes: ['status' => IntegrationStatus::ReconnectRequired]);

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), [
            'status_sync' => true,
            'treat_canceled_as_done' => false,
            'status_mapping' => ['container' => 'ENG', 'complete_state_id' => 'state-1'],
        ])
        ->assertStatus(409);

    expect($integration->fresh()->setting('treatCanceledAsDone'))->toBeNull()
        ->and($integration->fresh()->setting('statusMapping'))->toBeNull();
});

it('never lets a remap re-read be swallowed by a pending daily full read', function () {
    $integration = syncSettingsIntegration(IntegrationProvider::Linear, ['statusSync' => true]);
    dispatch(new ReadTrackedIssues($integration->id, true));

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['treat_canceled_as_done' => false])
        ->assertOk();

    Queue::assertPushed(ReadTrackedIssues::class, 2);
});

it('lists the states of a Linear team', function () {
    $integration = syncSettingsIntegration(IntegrationProvider::Linear, ['statusSync' => true]);
    Http::fake(['api.linear.app/graphql' => Http::response(['data' => ['teams' => ['nodes' => [['states' => ['nodes' => [
        ['id' => 'state-done', 'name' => 'Done', 'type' => 'completed', 'position' => 3],
    ]]]]]]])]);
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->getJson(route('teams.integrations.statuses.index', [$team->workspace, $team, $integration]).'?container=ENG')
        ->assertOk()
        ->assertExactJson(['statuses' => [['id' => 'state-done', 'name' => 'Done', 'category' => 'done']]]);
});

it('asks to reconnect before listing statuses', function () {
    $integration = syncSettingsIntegration(attributes: ['status' => IntegrationStatus::ReconnectRequired]);
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->getJson(route('teams.integrations.statuses.index', [$team->workspace, $team, $integration]).'?container=PROJ')
        ->assertStatus(409);
});

it('presents no status mapping for GitHub', function () {
    $integration = syncSettingsIntegration(IntegrationProvider::GitHub, ['statusSync' => true, 'statusMapping' => ['teams' => []]]);

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['treat_canceled_as_done' => true])
        ->assertOk()
        ->assertJsonPath('settings.treatCanceledAsDone', true)
        ->assertJsonMissingPath('settings.statusMapping');
});

it('removes the webhooks registered since the connection was loaded when sync is turned off', function () {
    $integration = syncSettingsIntegration(
        settings: ['statusSync' => true, 'webhookIds' => ['7001']],
        attributes: ['inbound_mode' => IntegrationInboundMode::Webhook, 'webhook_status' => IntegrationWebhookStatus::Pending],
    );
    TeamIntegration::query()->findOrFail($integration->id)->mergeSettings(['webhookIds' => ['7002']]);

    resolve(ToggleStatusSync::class)->handle($integration, false);

    expect($integration->fresh()->setting('webhookIds'))->toBe([])
        ->and($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Off);
    Queue::assertPushed(RemoveTrackerWebhooks::class, fn (RemoveTrackerWebhooks $job) => $job->webhookIds === ['7002']);
});
