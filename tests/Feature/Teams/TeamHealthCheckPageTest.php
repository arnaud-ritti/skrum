<?php

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Actions\Teams\BuildTeamMoodTrend;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * @return array{0: User, 1: Workspace, 2: Team}
 */
function healthCheckPageTeam(WorkspaceRole $role): array
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();
    $team = Team::factory()->for($workspace)->withMember($user)->create();

    return [$user, $workspace, $team];
}

it('shows the health check page to a team member, read-only, with every statement', function () {
    [$member, $workspace, $team] = healthCheckPageTeam(WorkspaceRole::Member);

    $this->actingAs($member)
        ->get(route('teams.healthCheck.show', [$workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/health-check')
            ->where('workspace.slug', $workspace->slug)
            ->where('team', ['id' => $team->id, 'name' => $team->name])
            ->has('healthStatements', 6)
            ->where('healthStatements.0', [
                'id' => 'interaction',
                'key' => 'interaction',
                'label' => 'Interaction',
                'text' => 'Interaction with colleagues was productive',
                'isBuiltin' => true,
                'isArchived' => false,
            ])
            ->where('canManageHealthStatements', false)
            ->where('canCreateSurvey', true));
});

it('lets a workspace admin manage the statements from the health check page, archived ones listed', function () {
    [$admin, $workspace, $team] = healthCheckPageTeam(WorkspaceRole::Admin);
    resolve(ManageTeamHealthStatements::class)->archive($team, 'vision');
    $vision = $team->healthStatements()->where('builtin', 'vision')->sole();

    $this->actingAs($admin)
        ->get(route('teams.healthCheck.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('healthStatements.3.id', $vision->id)
            ->where('healthStatements.3.isArchived', true)
            ->where('canManageHealthStatements', true));
});

it('defers the mood trend of the health check page', function () {
    [$member, $workspace, $team] = healthCheckPageTeam(WorkspaceRole::Member);
    $retro = Retro::factory()->for($team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
        'completed_at' => '2026-01-01 10:00:00',
    ]);
    answerHealthCheck($retro, Participant::factory()->create(['retro_id' => $retro->id]), ['vision' => 4]);
    closeHealthCheck($retro);

    $this->actingAs($member)
        ->get(route('teams.healthCheck.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('moodTrend')
            ->loadDeferredProps('trend', fn (Assert $reload) => $reload
                ->where('moodTrend.0.retroId', $retro->id)
                ->where('moodTrend.0.mood', 4)
                ->where('moodTrend.0.moodVoters', 1)));
});

it('forbids the health check page to a workspace member outside the team', function () {
    $outsider = User::factory()->create();
    $workspace = Workspace::factory()->withMember($outsider, WorkspaceRole::Member)->create();
    $team = Team::factory()->for($workspace)->create();

    $this->actingAs($outsider)
        ->get(route('teams.healthCheck.show', [$workspace, $team]))
        ->assertForbidden();
});

it('returns not found for the health check page of a team of another workspace', function () {
    [$admin, $workspace] = healthCheckPageTeam(WorkspaceRole::Admin);
    $foreignTeam = Team::factory()->create();

    $this->actingAs($admin)
        ->get(route('teams.healthCheck.show', [$workspace, $foreignTeam]))
        ->assertNotFound();
});

it('sends guests of the health check page to the login', function () {
    [, $workspace, $team] = healthCheckPageTeam(WorkspaceRole::Member);

    $this->get(route('teams.healthCheck.show', [$workspace, $team]))
        ->assertRedirect(route('login'));
});

it('answers the team page and the health check page when their trend cannot be built', function (string $routeName) {
    [$member, $workspace, $team] = healthCheckPageTeam(WorkspaceRole::Member);
    $this->mock(BuildTeamMoodTrend::class)->shouldReceive('handle')->andThrow(new RuntimeException('The trend failed.'));

    $url = route($routeName, [$workspace, $team]);

    $page = $this->actingAs($member)
        ->get($url)
        ->assertInertia(fn (Assert $page) => $page->missing('moodTrend'))
        ->viewData('page');

    expect($page['deferredProps']['trend'])->toBe(['moodTrend']);

    $this->get($url, [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => $page['version'],
        'X-Inertia-Partial-Component' => $page['component'],
        'X-Inertia-Partial-Data' => 'moodTrend',
    ])
        ->assertOk()
        ->assertJsonMissingPath('props.moodTrend')
        ->assertJsonPath('rescuedProps', ['moodTrend']);
})->with(['teams.show', 'teams.healthCheck.show']);
