<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::Slack);
});

/**
 * @param  array<string, string>  $query
 */
function targetsUrl(TeamIntegration $integration, array $query = []): string
{
    $url = route('teams.integrations.targets.index', [$integration->team->workspace, $integration->team, $integration]);

    return $query === [] ? $url : $url.'?'.http_build_query($query);
}

function fakeJiraTargets(): void
{
    Http::fake([
        jiraApiUrl('rest/api/3/project/search*') => Http::response(['values' => [
            ['id' => '10000', 'key' => 'PROJ', 'name' => 'Project'],
            ['id' => '10001', 'key' => 'OPS', 'name' => 'Operations'],
        ]]),
        jiraApiUrl('rest/api/3/issuetype/project*') => fn (HttpClientRequest $request) => Http::response($request['projectId'] === '10001'
            ? [['id' => '20', 'name' => 'Incident', 'subtask' => false]]
            : [['id' => '10', 'name' => 'Bug', 'subtask' => false], ['id' => '11', 'name' => 'Task', 'subtask' => false], ['id' => '12', 'name' => 'Sub-task', 'subtask' => true]]),
    ]);
}

it('lists Jira projects and preselects the Task issue type', function () {
    fakeJiraTargets();
    $integration = TeamIntegration::factory()->jira()->create();

    $this->actingAs(teamMember($integration->team))->getJson(targetsUrl($integration))
        ->assertOk()
        ->assertExactJson([
            'projects' => [['id' => '10000', 'key' => 'PROJ', 'name' => 'Project'], ['id' => '10001', 'key' => 'OPS', 'name' => 'Operations']],
            'issueTypes' => [['id' => '10', 'name' => 'Bug'], ['id' => '11', 'name' => 'Task']],
            'defaults' => ['projectId' => '10000', 'issueTypeId' => '11'],
        ]);

    Http::assertSent(fn (HttpClientRequest $request) => str_contains($request->url(), 'project/search') && $request['action'] === 'create');
});

it('preselects the last target and lists the issue types of a chosen project', function () {
    fakeJiraTargets();
    $integration = TeamIntegration::factory()->jira()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'exportProjectId' => '10001', 'exportIssueTypeId' => '20']])->save();
    $member = teamMember($integration->team);

    $this->actingAs($member)->getJson(targetsUrl($integration))
        ->assertJsonPath('defaults', ['projectId' => '10001', 'issueTypeId' => '20']);

    $this->actingAs($member)->getJson(targetsUrl($integration, ['project_id' => '10000']))
        ->assertJsonPath('defaults.projectId', '10000')
        ->assertJsonPath('issueTypes.1.name', 'Task');
});

it('filters Jira projects while keeping the chosen project', function () {
    fakeJiraTargets();
    $integration = TeamIntegration::factory()->jira()->create();

    $this->actingAs(teamMember($integration->team))->getJson(targetsUrl($integration, ['project_id' => '10001', 'q' => 'Proj']))
        ->assertOk()
        ->assertJsonPath('defaults', ['projectId' => '10001', 'issueTypeId' => '20']);

    Http::assertSent(fn (HttpClientRequest $request) => str_contains($request->url(), 'project/search') && $request['query'] === 'Proj');
});

it('lists Linear teams', function () {
    fakeLinearGraphql(['teams(' => ['teams' => ['nodes' => [
        ['id' => '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a01', 'key' => 'ENG', 'name' => 'Engineering'],
        ['id' => '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a02', 'key' => 'OPS', 'name' => 'Operations'],
    ]]]]);
    $integration = TeamIntegration::factory()->linear()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'exportTeamId' => '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a02']])->save();

    $this->actingAs(teamMember($integration->team))->getJson(targetsUrl($integration))
        ->assertOk()
        ->assertJsonPath('teams.0.key', 'ENG')
        ->assertJsonPath('defaults.teamId', '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a02');
});

it('refuses outsiders, read-only connections and chat channels', function () {
    $jira = TeamIntegration::factory()->jira()->create();
    $read = TeamIntegration::factory()->linear(IntegrationAccess::Read)->create();
    $slack = TeamIntegration::factory()->slack()->create();

    $this->actingAs(teamMember(Team::factory()->create()))->getJson(targetsUrl($jira))->assertForbidden();
    $this->actingAs(teamMember(Team::factory()->create(['workspace_id' => $jira->team->workspace_id])))->getJson(targetsUrl($jira))->assertForbidden();
    $this->actingAs(teamMember($read->team))->getJson(targetsUrl($read))->assertConflict();
    $this->actingAs(teamMember($slack->team))->getJson(targetsUrl($slack))->assertNotFound();
    $this->actingAs(teamMember($jira->team))->getJson(targetsUrl($jira, ['project_id' => '../x']))->assertUnprocessable();
});

it('refuses a search longer than 100 characters', function () {
    $jira = TeamIntegration::factory()->jira()->create();

    $this->actingAs(teamMember($jira->team))
        ->getJson(targetsUrl($jira, ['q' => str_repeat('a', 101)]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('q');
});

it('answers 404 for a connection of another team', function () {
    $jira = TeamIntegration::factory()->jira()->create();
    $otherTeam = Team::factory()->create(['workspace_id' => $jira->team->workspace_id]);
    $member = teamMember($jira->team);
    $otherTeam->members()->attach($member, ['role' => 'member']);

    $this->actingAs($member)
        ->getJson(route('teams.integrations.targets.index', [$otherTeam->workspace, $otherTeam, $jira]))
        ->assertNotFound();
});

it('offers export sources to members on the board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    $jira = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    [$user] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('exportSources', []);

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('exportSources', [['source' => 'jira', 'label' => 'Jira', 'integrationId' => $jira->id]]);

    disableIntegrations();

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))->assertJsonPath('exportSources', []);
});

it('offers export sources per team on the action items page', function () {
    $team = Team::factory()->create();
    $linear = TeamIntegration::factory()->linear()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->jira()->reconnectRequired()->create(['team_id' => $team->id]);

    $this->actingAs(teamMember($team))
        ->get(route('workspaces.actionItems.index', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page->where("exportSources.{$team->id}", [
            ['source' => 'linear', 'label' => 'Linear', 'integrationId' => $linear->id],
        ]));
});
