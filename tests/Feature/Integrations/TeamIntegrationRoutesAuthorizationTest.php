<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\TeamRole;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(...IntegrationProvider::cases());
});

/**
 * @return array<string, array{0: string, 1: string, 2: array<string, string>}>
 */
function teamIntegrationManagerRoutes(): array
{
    $delivery = (string) Str::uuid();
    $user = (string) Str::uuid();

    return [
        'the integrations page' => ['get', 'teams.integrations.index', []],
        'an OAuth connection' => ['get', 'teams.integrations.connect', ['provider' => 'slack']],
        'a Telegram connect code' => ['post', 'teams.integrations.telegramCode.store', []],
        'a Jira Data Center token' => ['post', 'teams.integrations.jiraDataCenterToken.store', []],
        'a pasted channel URL' => ['post', 'teams.integrations.urls.store', ['provider' => 'mattermost']],
        'the settings of a connection' => ['patch', 'teams.integrations.update', ['integration' => true]],
        'a disconnection' => ['delete', 'teams.integrations.destroy', ['integration' => true]],
        'a test message' => ['post', 'teams.integrations.test.store', ['integration' => true]],
        'a story points detection' => ['post', 'teams.integrations.detection.store', ['integration' => true]],
        'the people mappings' => ['get', 'teams.integrations.userMappings.index', ['integration' => true]],
        'an automatic people match' => ['post', 'teams.integrations.userMappings.match.store', ['integration' => true]],
        'a saved people mapping' => ['put', 'teams.integrations.userMappings.update', ['integration' => true, 'user' => $user]],
        'a removed people mapping' => ['delete', 'teams.integrations.userMappings.destroy', ['integration' => true, 'user' => $user]],
        'an account search' => ['get', 'teams.integrations.accounts.index', ['integration' => true]],
        'the tracker priorities' => ['get', 'teams.integrations.priorities.index', ['integration' => true]],
        'the tracker statuses' => ['get', 'teams.integrations.statuses.index', ['integration' => true]],
        'the tracker webhook details' => ['get', 'teams.integrations.trackerWebhook.show', ['integration' => true]],
        'a tracker webhook registration' => ['post', 'teams.integrations.trackerWebhook.store', ['integration' => true]],
        'a webhook secret rotation' => ['post', 'teams.integrations.secret.store', ['integration' => true]],
        'the webhook deliveries' => ['get', 'teams.integrations.deliveries.index', ['integration' => true]],
        'a webhook delivery' => ['get', 'teams.integrations.deliveries.show', ['integration' => true, 'delivery' => $delivery]],
        'a webhook redelivery' => ['post', 'teams.integrations.deliveries.redelivery.store', ['integration' => true, 'delivery' => $delivery]],
    ];
}

/**
 * The routes that answer for a webhook connection, so that a 404 on them can only come from the team scoping.
 *
 * @return array<string, array{0: string, 1: string, 2: array<string, bool>, 3: int}>
 */
function teamWebhookIntegrationRoutes(): array
{
    return [
        'the settings of a connection' => ['patch', 'teams.integrations.update', ['integration' => true], 200],
        'a disconnection' => ['delete', 'teams.integrations.destroy', ['integration' => true], 204],
        'a test message' => ['post', 'teams.integrations.test.store', ['integration' => true], 200],
        'a webhook secret rotation' => ['post', 'teams.integrations.secret.store', ['integration' => true], 200],
        'the webhook deliveries' => ['get', 'teams.integrations.deliveries.index', ['integration' => true], 200],
        'a webhook delivery' => ['get', 'teams.integrations.deliveries.show', ['integration' => true, 'delivery' => true], 200],
        'a webhook redelivery' => ['post', 'teams.integrations.deliveries.redelivery.store', ['integration' => true, 'delivery' => true], 202],
    ];
}

function failedWebhookDeliveryOf(TeamIntegration $integration): IntegrationDelivery
{
    $delivery = IntegrationDelivery::factory()->create([
        'team_id' => $integration->team_id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'event' => 'action_item.completed',
        'team_integration_id' => $integration->id,
        'status' => IntegrationDeliveryStatus::Failed,
    ]);
    $delivery->payload()->create(['message' => [
        'id' => $delivery->id,
        'event' => 'action_item.completed',
        'occurredAt' => '2026-10-07T10:00:00Z',
        'data' => ['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']],
    ]]);

    return $delivery;
}

/**
 * @param  array<string, string|bool>  $parameters
 */
function teamIntegrationRouteUrl(string $name, Team $team, TeamIntegration $integration, array $parameters, ?IntegrationDelivery $delivery = null): string
{
    if (($parameters['integration'] ?? false) === true) {
        $parameters['integration'] = $integration->id;
    }

    if (($parameters['delivery'] ?? false) === true) {
        $parameters['delivery'] = $delivery?->id;
    }

    return route($name, [$team->workspace, $team, ...$parameters]);
}

it('refuses every integration route to a team role that does not own the team', function (TeamRole $role, string $method, string $name, array $parameters) {
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    $user = teamMember($team, $role);

    $this->actingAs($user)
        ->json($method, teamIntegrationRouteUrl($name, $team, $integration, $parameters))
        ->assertForbidden();

    expect($integration->fresh())->not->toBeNull();
})->with([
    'facilitator' => TeamRole::Facilitator,
    'member' => TeamRole::Member,
    'observer' => TeamRole::Observer,
])->with(teamIntegrationManagerRoutes());

it('refuses every integration route to a member of another workspace', function (string $method, string $name, array $parameters) {
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    $outsider = integrationAdmin(Team::factory()->create());

    $this->actingAs($outsider)
        ->json($method, teamIntegrationRouteUrl($name, $team, $integration, $parameters))
        ->assertForbidden();
})->with(teamIntegrationManagerRoutes());

it('sends a visitor who is not signed in to the login page from every integration route', function (string $method, string $name, array $parameters) {
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);

    $this->call(strtoupper($method), teamIntegrationRouteUrl($name, $team, $integration, $parameters))
        ->assertRedirect(route('login'));
})->with(teamIntegrationManagerRoutes());

it('answers 404 when the integration belongs to another team of the workspace', function (string $method, string $name, array $parameters, int $successStatus) {
    Queue::fake();
    $team = Team::factory()->create();
    $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $otherIntegration = TeamIntegration::factory()->webhook()->create(['team_id' => $otherTeam->id]);
    $delivery = failedWebhookDeliveryOf($otherIntegration);
    $admin = integrationAdmin($team);

    $this->actingAs($admin)
        ->json($method, teamIntegrationRouteUrl($name, $team, $otherIntegration, $parameters, $delivery))
        ->assertNotFound();

    expect($otherIntegration->fresh())->not->toBeNull();
})->with(teamWebhookIntegrationRoutes());

it('answers the same routes for a webhook integration of the team itself', function (string $method, string $name, array $parameters, int $successStatus) {
    Queue::fake();
    outgoingWebhookResolves();
    Http::fake(['*' => Http::response()]);
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    $delivery = failedWebhookDeliveryOf($integration);
    $admin = integrationAdmin($team);

    $this->actingAs($admin)
        ->json($method, teamIntegrationRouteUrl($name, $team, $integration, $parameters, $delivery))
        ->assertStatus($successStatus);
})->with(teamWebhookIntegrationRoutes());

it('lets the owner of the team open the integrations page', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);

    $this->actingAs($owner)
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertOk();
});

it('lets the owner of the team rotate the webhook secret and disconnect the webhook', function () {
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    $owner = teamMember($team, TeamRole::Owner);

    $this->actingAs($owner)
        ->postJson(route('teams.integrations.secret.store', [$team->workspace, $team, $integration]))
        ->assertOk();

    $this->actingAs($owner)
        ->deleteJson(route('teams.integrations.destroy', [$team->workspace, $team, $integration]))
        ->assertNoContent();

    expect($integration->fresh())->toBeNull();
});
