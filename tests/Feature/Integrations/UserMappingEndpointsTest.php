<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Jobs\MatchIntegrationUsers;
use App\Models\IntegrationUserMapping;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::Slack);
});

/**
 * @return array<string, mixed>
 */
function mappingRoute(TeamIntegration $integration, ?User $user = null): array
{
    return array_filter([
        'workspace' => $integration->team->workspace,
        'team' => $integration->team,
        'integration' => $integration,
        'user' => $user?->id,
    ]);
}

it('is reserved to workspace owners and admins', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $member = teamMember($integration->team);

    $this->actingAs($member)->getJson(route('teams.integrations.userMappings.index', mappingRoute($integration)))->assertForbidden();
    $this->actingAs($member)->putJson(route('teams.integrations.userMappings.update', mappingRoute($integration, $member)), ['external_account_id' => null])->assertForbidden();
    $this->actingAs($member)->postJson(route('teams.integrations.userMappings.match.store', mappingRoute($integration)))->assertForbidden();
    $this->actingAs($member)->getJson(route('teams.integrations.accounts.index', mappingRoute($integration)).'?q=ada')->assertForbidden();
});

it('lists every team member with their mapping', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $admin = integrationAdmin($integration->team);
    $mapped = teamMember($integration->team);
    $never = teamMember($integration->team);
    $inactive = teamMember($integration->team);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $mapped->id, 'external_account_id' => 'acc-1', 'external_display_name' => 'Ada L.']);
    IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id, 'user_id' => $never->id]);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $inactive->id, 'account_inactive' => true]);

    $response = $this->actingAs($admin)->getJson(route('teams.integrations.userMappings.index', mappingRoute($integration)))->assertOk();

    $rows = collect($response->json('members'))->keyBy('userId');

    expect($rows)->toHaveCount(4)
        ->and($rows[$admin->id]['mapping'])->toBeNull()
        ->and($rows[$admin->id]['email'])->toBe($admin->email)
        ->and($rows[$mapped->id]['mapping'])->toBe(['accountId' => 'acc-1', 'displayName' => 'Ada L.', 'matchedBy' => 'email', 'accountInactive' => false])
        ->and($rows[$never->id]['mapping']['accountId'])->toBeNull()
        ->and($rows[$never->id]['mapping']['matchedBy'])->toBe('manual')
        ->and($rows[$inactive->id]['mapping']['accountInactive'])->toBeTrue()
        ->and($response->json('matching'))->toBeFalse();
});

it('maps a member manually after checking the account', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $admin = integrationAdmin($integration->team);
    $member = teamMember($integration->team);
    Http::fake([jiraApiUrl('rest/api/3/user?accountId=acc-ada') => Http::response(jiraAccount('acc-ada', 'Ada L.'))]);

    $this->actingAs($admin)
        ->putJson(route('teams.integrations.userMappings.update', mappingRoute($integration, $member)), ['external_account_id' => 'acc-ada'])
        ->assertOk()
        ->assertJsonPath('userId', $member->id)
        ->assertJsonPath('mapping.accountId', 'acc-ada')
        ->assertJsonPath('mapping.displayName', 'Ada L.')
        ->assertJsonPath('mapping.matchedBy', 'manual');

    expect($integration->accountFor($member)?->matched_by)->toBe(IntegrationUserMatch::Manual);
});

it('refuses unknown or inactive accounts', function (array|int $response, int $status) {
    $integration = TeamIntegration::factory()->jira()->create();
    $admin = integrationAdmin($integration->team);
    $member = teamMember($integration->team);
    Http::fake([jiraApiUrl('rest/api/3/user?accountId=acc-x') => Http::response($response, $status)]);

    $this->actingAs($admin)
        ->putJson(route('teams.integrations.userMappings.update', mappingRoute($integration, $member)), ['external_account_id' => 'acc-x'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['external_account_id' => 'This Jira account was not found or is inactive.']);

    expect($integration->accountFor($member))->toBeNull();
})->with([
    'unknown' => [['errorMessages' => ['Not found']], 404],
    'inactive' => [jiraAccount('acc-x', 'Gone', active: false), 200],
]);

it('sets never assign and resets a mapping', function () {
    $integration = TeamIntegration::factory()->linear()->create();
    $admin = integrationAdmin($integration->team);
    $member = teamMember($integration->team);

    $this->actingAs($admin)
        ->putJson(route('teams.integrations.userMappings.update', mappingRoute($integration, $member)), ['external_account_id' => null])
        ->assertOk()
        ->assertJsonPath('mapping.accountId', null);

    expect($integration->accountFor($member)?->isNeverAssign())->toBeTrue();

    $this->actingAs($admin)
        ->deleteJson(route('teams.integrations.userMappings.destroy', mappingRoute($integration, $member)))
        ->assertNoContent();

    expect($integration->accountFor($member))->toBeNull();
});

it('only maps current members of the team', function (Closure $makeStranger) {
    $integration = TeamIntegration::factory()->jira()->create();
    $admin = integrationAdmin($integration->team);
    $stranger = $makeStranger($integration->team);

    $this->actingAs($admin)
        ->putJson(route('teams.integrations.userMappings.update', mappingRoute($integration, $stranger)), ['external_account_id' => null])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['user' => 'This person is not a member of the team.']);

    expect($integration->accountFor($stranger))->toBeNull();
})->with([
    'member of a team in another workspace' => fn (Team $team): User => teamMember(Team::factory()->create()),
    'member of another team in the workspace' => fn (Team $team): User => teamMember(Team::factory()->create(['workspace_id' => $team->workspace_id])),
    'former member of the team' => function (Team $team): User {
        $former = teamMember($team);
        $team->members()->detach($former);

        return $former;
    },
]);

it('hides the mappings of another team from an admin of a team elsewhere', function (string $method, string $routeName) {
    $integration = TeamIntegration::factory()->jira()->create();
    $foreignTeam = Team::factory()->create();
    $foreignAdmin = integrationAdmin($foreignTeam);
    $member = teamMember($integration->team);
    $parameters = ['workspace' => $foreignTeam->workspace, 'team' => $foreignTeam, 'integration' => $integration, 'user' => $member->id];

    $this->actingAs($foreignAdmin)
        ->json($method, route($routeName, $parameters), ['external_account_id' => null, 'q' => 'ada'])
        ->assertNotFound();

    expect($integration->accountFor($member))->toBeNull();
})->with([
    'the mappings' => ['get', 'teams.integrations.userMappings.index'],
    'a saved mapping' => ['put', 'teams.integrations.userMappings.update'],
    'an automatic match' => ['post', 'teams.integrations.userMappings.match.store'],
    'an account search' => ['get', 'teams.integrations.accounts.index'],
]);

it('starts email matching in the background', function () {
    Queue::fake();
    $integration = TeamIntegration::factory()->jira()->create();

    $this->actingAs(integrationAdmin($integration->team))
        ->postJson(route('teams.integrations.userMappings.match.store', mappingRoute($integration)))
        ->assertAccepted()
        ->assertJsonPath('matching', true);

    Queue::assertPushed(MatchIntegrationUsers::class);

    $this->actingAs(integrationAdmin($integration->team))
        ->getJson(route('teams.integrations.userMappings.index', mappingRoute($integration)))
        ->assertJsonPath('matching', true);
});

it('searches accounts without emails or avatars', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response([
        [...jiraAccount('acc-1', 'Ada L.', 'ada@example.com'), 'avatarUrls' => ['48x48' => 'https://avatar.example/ada.png']],
    ])]);

    $response = $this->actingAs(integrationAdmin($integration->team))
        ->getJson(route('teams.integrations.accounts.index', mappingRoute($integration)).'?q=ada')
        ->assertOk()
        ->assertExactJson([['accountId' => 'acc-1', 'displayName' => 'Ada L.']]);

    expect($response->getContent())->not->toContain('example');
});

it('validates the account search', function (string $query) {
    $integration = TeamIntegration::factory()->jira()->create();

    $this->actingAs(integrationAdmin($integration->team))
        ->getJson(route('teams.integrations.accounts.index', mappingRoute($integration)).'?q='.urlencode($query))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('q');
})->with(['too short' => 'a', 'too long' => str_repeat('a', 101)]);

it('answers with the state of the connection', function (TeamIntegration $integration, int $status, ?string $message) {
    $response = $this->actingAs(integrationAdmin($integration->team))
        ->getJson(route('teams.integrations.userMappings.index', mappingRoute($integration)))
        ->assertStatus($status);

    if ($message !== null) {
        $response->assertJsonPath('message', $message);
    }
})->with([
    'read only' => [fn () => TeamIntegration::factory()->jira(IntegrationAccess::Read)->create(), 409, 'This Jira connection is read-only.'],
    'reconnect required' => [fn () => TeamIntegration::factory()->linear()->reconnectRequired()->create(), 409, 'Reconnect Linear in the team settings.'],
    'Jira without account scope' => [fn () => TeamIntegration::factory()->jira()->create(['scopes' => ['offline_access', 'read:jira-work', 'write:jira-work']]), 409, 'Reconnect Jira to enable assignee mapping.'],
    'chat channel' => [fn () => TeamIntegration::factory()->slack()->create(), 404, null],
]);

it('does not exist while the provider is disabled', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    disableIntegrations();

    $this->actingAs(integrationAdmin($integration->team))
        ->getJson(route('teams.integrations.userMappings.index', mappingRoute($integration)))
        ->assertNotFound();
});
