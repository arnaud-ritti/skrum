<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;

function teamPageVisitor(Team $team, string $who): User
{
    return match ($who) {
        'manager' => workspaceManager($team->workspace),
        'workspace member' => workspaceManager($team->workspace, WorkspaceRole::Member),
        default => teamMember($team, TeamRole::from($who)),
    };
}

it('opens each page of a team to the roles allowed there and refuses the others', function (string $routeName, array $allowed) {
    $team = Team::factory()->create();

    foreach (['manager', 'owner', 'facilitator', 'member', 'observer', 'workspace member'] as $who) {
        $status = $this->actingAs(teamPageVisitor($team, $who))
            ->get(route($routeName, [$team->workspace, $team]))
            ->status();

        expect($status)->toBe(in_array($who, $allowed, true) ? 200 : 403, "{$routeName} for {$who}");
    }
})->with([
    'team page' => ['teams.show', ['manager', 'owner', 'facilitator', 'member', 'observer']],
    'sessions' => ['teams.sessions.index', ['manager', 'owner', 'facilitator', 'member', 'observer']],
    'General' => ['teams.settings.show', ['manager', 'owner']],
    'Members & rituals' => ['teams.members.index', ['manager', 'owner', 'facilitator']],
    'Data & export' => ['teams.data.show', ['manager', 'owner']],
]);

it('sends a signed-out visitor of a team page to sign in', function (string $routeName) {
    $team = Team::factory()->create();

    $this->get(route($routeName, [$team->workspace, $team]))->assertRedirect(route('login'));
})->with(['teams.show', 'teams.sessions.index', 'teams.settings.show', 'teams.members.index', 'teams.data.show']);

it('answers 404 for a team of another workspace under the address of the manager\'s workspace', function (string $routeName) {
    $workspace = Team::factory()->create()->workspace;
    $manager = workspaceManager($workspace);
    $foreignTeam = Team::factory()->create();

    $this->actingAs($manager)
        ->get(route($routeName, [$workspace, $foreignTeam]))
        ->assertNotFound();
})->with(['teams.sessions.index', 'teams.settings.show', 'teams.members.index', 'teams.data.show']);

it('lets an observer read the sessions page without any form of the "New session" dialog', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team, TeamRole::Observer))
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('canCreateRetro', false)
            ->where('canCreatePokerGame', false)
            ->where('canCreateWhiteboard', false)
            ->where('canCreateSurvey', false));
});
