<?php

use App\Actions\Teams\BuildTeamMoodTrend;
use App\Enums\RetroPhase;
use App\Enums\TeamRole;
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

it('shows the health check page to a team member without the statements, which are in the settings', function () {
    [$member, $workspace, $team] = healthCheckPageTeam(WorkspaceRole::Member);

    $this->actingAs($member)
        ->get(route('teams.healthCheck.show', [$workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/health-check')
            ->where('workspace.slug', $workspace->slug)
            ->where('team', ['id' => $team->id, 'name' => $team->name])
            ->missing('healthStatements')
            ->missing('canManageHealthStatements')
            ->where('canEditStatements', false)
            ->where('statementsUrl', route('teams.healthStatements.index', [$workspace, $team]))
            ->missing('ritualsUrl')
            ->where('canCreateSurvey', true));
});

it('tells who may edit the statements where they are', function (WorkspaceRole $workspaceRole, TeamRole $teamRole, bool $canEdit) {
    [$user, $workspace, $team] = healthCheckPageTeam($workspaceRole);
    $team->members()->updateExistingPivot($user->id, ['role' => $teamRole->value]);

    $this->actingAs($user)
        ->get(route('teams.healthCheck.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canEditStatements', $canEdit)
            ->where('statementsUrl', route('teams.healthStatements.index', [$workspace, $team])));
})->with([
    'a workspace admin' => [WorkspaceRole::Admin, TeamRole::Member, true],
    'a team owner' => [WorkspaceRole::Member, TeamRole::Owner, true],
    'a facilitator, who reads them there without editing them' => [WorkspaceRole::Member, TeamRole::Facilitator, false],
]);

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

it('answers the team page and the health check page when their trend cannot be built', function (string $routeName, array $deferred) {
    [$member, $workspace, $team] = healthCheckPageTeam(WorkspaceRole::Member);
    $this->mock(BuildTeamMoodTrend::class)->shouldReceive('handle')->andThrow(new RuntimeException('The trend failed.'));

    $url = route($routeName, [$workspace, $team]);

    $page = $this->actingAs($member)
        ->get($url)
        ->assertInertia(fn (Assert $page) => $page->missing('moodTrend'))
        ->viewData('page');

    expect($page['deferredProps']['trend'])->toBe($deferred);

    $this->get($url, [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => $page['version'],
        'X-Inertia-Partial-Component' => $page['component'],
        'X-Inertia-Partial-Data' => 'moodTrend',
    ])
        ->assertOk()
        ->assertJsonMissingPath('props.moodTrend')
        ->assertJsonPath('rescuedProps', ['moodTrend']);
})->with([
    'teams.show' => ['teams.show', ['moodTrend', 'latestHealth', 'latestEnps']],
    'teams.healthCheck.show' => ['teams.healthCheck.show', ['moodTrend']],
]);
