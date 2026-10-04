<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamSprint;
use App\Models\User;

/**
 * Each write of the team settings of spec plan 23 §10, as [method, route name, body].
 *
 * @return array<string, array{
 *     0: string,
 *     1: string,
 *     2: array<string, mixed>
 * }>
 */
function teamSettingsWrites(): array
{
    return [
        'rename the team' => ['patch', 'teams.update', ['name' => 'Borealis', 'description' => 'Ours']],
        'add a sprint' => ['post', 'teams.sprints.store', ['number' => 50, 'starts_on' => '2027-01-04', 'ends_on' => '2027-01-17']],
        'edit a sprint' => ['patch', 'teams.sprints.update', ['number' => 42, 'starts_on' => '2026-09-21', 'ends_on' => '2026-10-02']],
        'delete a sprint' => ['delete', 'teams.sprints.destroy', []],
        'start the next sprint' => ['post', 'teams.sprintStarts.store', []],
        'save the rituals' => ['put', 'teams.rituals.update', ['sprint_length_weeks' => 3]],
        'save the facilitators' => ['put', 'teams.facilitators.update', ['user_ids' => [], 'rotation' => false]],
        'choose the default template' => ['put', 'teams.defaultRetroTemplate.update', ['template' => 'four_ls']],
    ];
}

it('refuses every write of the team settings to an observer and to a workspace member outside the team, and leaves the sprint as it was', function (string $method, string $routeName, array $body) {
    $team = Team::factory()->create(['name' => 'Atlas', 'sprint_length_weeks' => 2]);
    $sprint = teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $parameters = str_starts_with($routeName, 'teams.sprints.') && $routeName !== 'teams.sprints.store'
        ? [$team->workspace, $team, $sprint]
        : [$team->workspace, $team];

    foreach ([teamMember($team, TeamRole::Observer), workspaceManager($team->workspace, WorkspaceRole::Member)] as $user) {
        $this->actingAs($user)->{$method}(route($routeName, $parameters), $body)->assertForbidden();
    }

    expect($team->fresh())
        ->name->toBe('Atlas')
        ->sprint_length_weeks->toBe(2)
        ->default_retro_template->toBeNull()
        ->and(TeamSprint::query()->where('team_id', $team->id)->sole()->ends_on->toDateString())->toBe('2026-10-04');
})->with(teamSettingsWrites());

it('refuses a plain member the edit and the deletion of a sprint', function (string $method, string $routeName, array $body) {
    $team = Team::factory()->create();
    $sprint = teamSprint($team, 42, '2026-09-21', '2026-10-04');

    $this->actingAs(teamMember($team))
        ->{$method}(route($routeName, [$team->workspace, $team, $sprint]), $body)
        ->assertForbidden();

    expect($sprint->fresh()->ends_on->toDateString())->toBe('2026-10-04');
})->with([
    'edit' => ['patch', 'teams.sprints.update', ['number' => 42, 'starts_on' => '2026-09-21', 'ends_on' => '2026-10-02']],
    'delete' => ['delete', 'teams.sprints.destroy', []],
]);

it('refuses a team owner the rename of the workspace', function () {
    $team = Team::factory()->create();
    $workspace = $team->workspace;
    $name = $workspace->name;

    $this->actingAs(teamMember($team, TeamRole::Owner))
        ->put(route('workspaces.details.update', $workspace), ['name' => 'Taken over', 'description' => null])
        ->assertForbidden();

    expect($workspace->fresh()->name)->toBe($name);
});

it('keeps a user of another workspace out of the team settings writes', function () {
    $team = Team::factory()->create();
    $stranger = User::factory()->create();

    $this->actingAs($stranger)
        ->put(route('teams.rituals.update', [$team->workspace, $team]), ['sprint_length_weeks' => 3])
        ->assertForbidden();

    expect($team->fresh()->sprint_length_weeks)->toBeNull();
});
