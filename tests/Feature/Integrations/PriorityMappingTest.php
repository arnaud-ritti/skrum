<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::Slack);
});

function fakeJiraPriorities(): void
{
    Http::fake([jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => [
        ['id' => '1', 'name' => 'Highest'],
        ['id' => '2', 'name' => 'High'],
        ['id' => '3', 'name' => 'Medium'],
        ['id' => '4', 'name' => 'Low'],
    ]])]);
}

/**
 * @return array<string, mixed>
 */
function priorityRoute(TeamIntegration $integration): array
{
    return ['workspace' => $integration->team->workspace, 'team' => $integration->team, 'integration' => $integration];
}

it('lists the priorities of the provider', function () {
    fakeJiraPriorities();
    $jira = TeamIntegration::factory()->jira()->create();
    $linear = TeamIntegration::factory()->linear()->create();

    $this->actingAs(integrationAdmin($jira->team))
        ->getJson(route('teams.integrations.priorities.index', priorityRoute($jira)))
        ->assertOk()
        ->assertJsonPath('0', ['id' => '1', 'name' => 'Highest'])
        ->assertJsonCount(4);

    $this->actingAs(integrationAdmin($linear->team))
        ->getJson(route('teams.integrations.priorities.index', priorityRoute($linear)))
        ->assertOk()
        ->assertJsonPath('2', ['id' => 2, 'name' => 'High'])
        ->assertJsonCount(5);
});

it('keeps the priorities to owners and admins of trackers', function () {
    $jira = TeamIntegration::factory()->jira()->create();
    $slack = TeamIntegration::factory()->slack()->create();

    $this->actingAs(teamMember($jira->team))->getJson(route('teams.integrations.priorities.index', priorityRoute($jira)))->assertForbidden();
    $this->actingAs(integrationAdmin($slack->team))->getJson(route('teams.integrations.priorities.index', priorityRoute($slack)))->assertNotFound();
});

it('maps Jira priorities, "Don\'t set" and defaults', function () {
    fakeJiraPriorities();
    $integration = TeamIntegration::factory()->jira()->create();
    $admin = integrationAdmin($integration->team);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['high' => '1', 'low' => null]])
        ->assertOk()
        ->assertJsonPath('settings.priorityMap.high', ['id' => '1', 'name' => 'Highest'])
        ->assertJsonPath('settings.priorityMap.low', null);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['high' => 'default']])
        ->assertOk()
        ->assertJsonMissingPath('settings.priorityMap.high')
        ->assertJsonPath('settings.priorityMap.low', null);
});

it('refuses priorities that are not on the Jira site', function () {
    fakeJiraPriorities();
    $integration = TeamIntegration::factory()->jira()->create();

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['high' => '99']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('priority_map.high');
});

it('maps Linear priorities within its scale', function () {
    $integration = TeamIntegration::factory()->linear()->create();
    $admin = integrationAdmin($integration->team);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['high' => 1, 'medium' => 0]])
        ->assertOk()
        ->assertJsonPath('settings.priorityMap.high', 1)
        ->assertJsonPath('settings.priorityMap.medium', 0);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['low' => 5]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('priority_map.low');

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['urgent' => 1]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('priority_map');
});

it('refuses a priority mapping on a read-only connection', function () {
    $integration = TeamIntegration::factory()->linear(IntegrationAccess::Read)->create();

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['high' => 1]])
        ->assertConflict()
        ->assertJsonPath('message', 'This Linear connection is read-only.');
});

it('shows the mapping on the integrations page', function () {
    $integration = TeamIntegration::factory()->linear()->create(['settings' => [
        'organizationId' => 'org-1', 'organizationName' => 'Acme', 'urlKey' => 'acme', 'priorityMap' => ['high' => 1],
    ]]);

    $this->actingAs(integrationAdmin($integration->team))
        ->get(route('teams.integrations.index', [$integration->team->workspace, $integration->team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('providers.2.provider', 'linear')
            ->where('providers.2.connection.settings.priorityMap', ['high' => 1]));
});
