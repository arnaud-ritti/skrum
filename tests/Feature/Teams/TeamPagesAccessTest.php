<?php

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia;

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
    'Insights' => ['teams.insights.show', ['manager', 'owner', 'facilitator', 'member', 'observer']],
    'eNPS' => ['teams.enps.show', ['manager', 'owner', 'facilitator', 'member', 'observer']],
    'Activity' => ['teams.activity.index', ['manager', 'owner', 'facilitator', 'member', 'observer']],
    'General' => ['teams.settings.show', ['manager', 'owner']],
    'Members' => ['teams.members.index', ['manager', 'owner', 'facilitator', 'member', 'observer']],
    'Sprints' => ['teams.sprints.index', ['manager', 'owner', 'facilitator']],
    'Retrospectives' => ['teams.retroSettings.show', ['manager', 'owner', 'facilitator']],
    'Health check' => ['teams.healthStatements.index', ['manager', 'owner', 'facilitator']],
    'Data & export' => ['teams.data.show', ['manager', 'owner']],
]);

it('sends a signed-out visitor of a team page to sign in', function (string $routeName) {
    $team = Team::factory()->create();

    $this->get(route($routeName, [$team->workspace, $team]))->assertRedirect(route('login'));
})->with(['teams.show', 'teams.sessions.index', 'teams.insights.show', 'teams.enps.show', 'teams.activity.index', 'teams.settings.show', 'teams.members.index', 'teams.sprints.index', 'teams.retroSettings.show', 'teams.healthStatements.index', 'teams.data.show']);

it('answers 404 for a team of another workspace under the address of the manager\'s workspace', function (string $routeName) {
    $workspace = Team::factory()->create()->workspace;
    $manager = workspaceManager($workspace);
    $foreignTeam = Team::factory()->create();

    $this->actingAs($manager)
        ->get(route($routeName, [$workspace, $foreignTeam]))
        ->assertNotFound();
})->with(['teams.sessions.index', 'teams.insights.show', 'teams.enps.show', 'teams.activity.index', 'teams.settings.show', 'teams.members.index', 'teams.sprints.index', 'teams.retroSettings.show', 'teams.healthStatements.index', 'teams.data.show']);

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

it('shows a plain member the people of the team and nothing about invitations', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)
        ->get(route('teams.members.index', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('teams/members')
            ->has('members', 1)
            ->where('members.0.isViewer', true)
            ->where('canInvite', false)
            ->where('canManageMembers', false)
            ->where('pendingInvitations', [])
            ->where('roleOptions', [])
            ->missing('sprints')
            ->missing('sections')
            ->reloadOnly('inviteLink', fn (AssertableInertia $reload) => $reload->where('inviteLink', null)));
});

it('sends the sprints page the sprints and the defaults, and nothing of the retros or of the health check', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamFacilitator($team))
        ->get(route('teams.sprints.index', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('teams/sprints')
            ->has('sprints')
            ->has('rituals')
            ->where('sections.sprints', true)
            ->missing('nextRetro')
            ->missing('facilitators')
            ->missing('templates')
            ->missing('categories')
            ->missing('defaultRetroTemplate')
            ->missing('healthStatements')
            ->missing('canManageHealthStatements')
            ->missing('members')
            ->missing('pendingInvitations'));
});

it('sends the retrospectives page the facilitators, the next retro and the templates, and nothing of the sprints or of the health check', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamFacilitator($team))
        ->get(route('teams.retroSettings.show', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('teams/retro-settings')
            ->has('facilitators')
            ->has('templates')
            ->has('categories')
            ->where('nextRetro', null)
            ->where('defaultRetroTemplateUnavailable', false)
            ->where('sections.retros', true)
            ->missing('sprints')
            ->missing('rituals')
            ->missing('healthStatements')
            ->missing('canManageHealthStatements')
            ->missing('members')
            ->missing('pendingInvitations'));
});

it('sends the health check page the statements, read-only for a facilitator, and nothing of the sprints or of the retros', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamFacilitator($team))
        ->get(route('teams.healthStatements.index', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('teams/health-statements')
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
            ->where('sections.health', true)
            ->missing('sprints')
            ->missing('rituals')
            ->missing('nextRetro')
            ->missing('facilitators')
            ->missing('templates')
            ->missing('members')
            ->missing('pendingInvitations'));
});

it('lets a workspace admin manage the statements from the health check page, archived ones listed', function () {
    $team = Team::factory()->create();
    resolve(ManageTeamHealthStatements::class)->archive($team, 'vision');
    $vision = $team->healthStatements()->where('builtin', 'vision')->sole();

    $this->actingAs(workspaceManager($team->workspace))
        ->get(route('teams.healthStatements.index', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('healthStatements.3.id', $vision->id)
            ->where('healthStatements.3.isArchived', true)
            ->where('canManageHealthStatements', true));
});

it('has no route named teams.rituals.show, and keeps the one that saves the rituals', function () {
    expect(Route::has('teams.rituals.show'))->toBeFalse()
        ->and(Route::has('teams.rituals.update'))->toBeTrue();
});
