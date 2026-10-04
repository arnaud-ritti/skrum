<?php

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

it('sends users without a workspace to the onboarding', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('dashboard'))
        ->assertRedirect(route('onboarding.show'));
});

it('creates a workspace and opens it', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('workspaces.store'), ['name' => 'Acme']);

    $workspace = $user->workspaces()->sole();

    $response->assertRedirect(route('workspaces.show', $workspace));
    expect($workspace->name)->toBe('Acme');
});

it('requires a workspace name', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('workspaces.store'), ['name' => ''])
        ->assertSessionHasErrors('name');
});

it('sends users to their current workspace', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user)->create();
    $user->forceFill(['current_workspace_id' => $workspace->id])->save();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('workspaces.show', $workspace));
});

it('ignores a current workspace the user no longer belongs to', function () {
    $user = User::factory()->create();
    $formerWorkspace = Workspace::factory()->create();
    $otherWorkspace = Workspace::factory()->withMember($user)->create();
    $user->forceFill(['current_workspace_id' => $formerWorkspace->id])->save();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('workspaces.show', $otherWorkspace));
});

it('remembers the last visited workspace', function () {
    $user = User::factory()->create();
    $first = Workspace::factory()->withMember($user)->create();
    $second = Workspace::factory()->withMember($user)->create();
    $user->forceFill(['current_workspace_id' => $first->id])->save();

    $this->actingAs($user)->get(route('workspaces.show', $second))->assertOk();

    expect($user->fresh()->current_workspace_id)->toBe($second->id);
});

it('shares the workspace list and current workspace', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspaces/show')
            ->where('currentWorkspace.slug', $workspace->slug)
            ->where('currentWorkspace.role', 'admin')
            ->has('workspaces', 1));
});

it('forbids opening a workspace the user does not belong to', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('workspaces.show', Workspace::factory()->create()))
        ->assertForbidden();
});

it('lets only owners delete a workspace', function (WorkspaceRole $role, int $expectedStatus) {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();

    $response = $this->actingAs($user)->delete(route('workspaces.destroy', $workspace));

    $expectedStatus === 302
        ? $response->assertRedirect(route('dashboard'))
        : $response->assertStatus($expectedStatus);
    expect(Workspace::query()->whereKey($workspace->id)->exists())->toBe($expectedStatus !== 302);
})->with([
    'owner' => [WorkspaceRole::Owner, 302],
    'admin' => [WorkspaceRole::Admin, 403],
    'member' => [WorkspaceRole::Member, 403],
]);

it('shows the member and admin counts of a workspace and the counts of each team', function () {
    $workspace = Workspace::factory()->create();
    $owner = workspaceManager($workspace, WorkspaceRole::Owner);
    workspaceManager($workspace, WorkspaceRole::Admin);
    workspaceManager($workspace, WorkspaceRole::Member);
    workspaceManager($workspace, WorkspaceRole::Member);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    Team::factory()->for($workspace)->create(['name' => 'Beta']);
    $alpha->members()->attach($owner);

    $this->actingAs($owner)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('membersCount', 4)
            ->where('adminsCount', 2)
            ->has('teams', 2)
            ->where('teams.0.membersCount', 1)
            ->where('teams.1.membersCount', 0)
            ->where('teams.1.members', []));
});

it('lists the first five members of each team by name next to its total', function () {
    $workspace = Workspace::factory()->create();
    $owner = workspaceManager($workspace, WorkspaceRole::Owner);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $beta = Team::factory()->for($workspace)->create(['name' => 'Beta']);
    foreach (['Gina', 'Alice', 'Frank', 'Bob', 'Eve', 'Dan', 'Carol'] as $name) {
        $alpha->members()->attach(User::factory()->create(['name' => $name]));
    }
    foreach (['Zoe', 'Uma', 'Yan', 'Vic', 'Xav', 'Wes'] as $name) {
        $beta->members()->attach(User::factory()->create(['name' => $name]));
    }

    $this->actingAs($owner)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('teams.0.name', 'Alpha')
            ->where('teams.0.membersCount', 7)
            ->has('teams.0.members', 5)
            ->where('teams.0.members.0.name', 'Alice')
            ->where('teams.0.members.4.name', 'Eve')
            ->has('teams.0.members.0.avatarUrl')
            ->where('teams.1.name', 'Beta')
            ->where('teams.1.membersCount', 6)
            ->has('teams.1.members', 5)
            ->where('teams.1.members.0.name', 'Uma')
            ->where('teams.1.members.4.name', 'Yan'));
});

it('leaves out of the workspace page a team the user cannot see', function () {
    $workspace = Workspace::factory()->create();
    $member = workspaceManager($workspace, WorkspaceRole::Member);
    $visible = Team::factory()->for($workspace)->create(['name' => 'Visible']);
    Team::factory()->for($workspace)->create(['name' => 'Hidden']);
    $visible->members()->attach($member);

    $this->actingAs($member)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->has('teams', 1)
            ->where('teams.0.name', 'Visible'));
});

it('sends the open retro, the open poker games and the open and overdue action items of each team', function () {
    $this->travelTo(now()->startOfSecond());
    $workspace = Workspace::factory()->create();
    $owner = workspaceManager($workspace, WorkspaceRole::Owner);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $beta = Team::factory()->for($workspace)->create(['name' => 'Beta']);
    Team::factory()->for($workspace)->create(['name' => 'Gamma']);

    Retro::factory()->for($alpha)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subDays(9)]);
    Retro::factory()->for($alpha)->inPhase(RetroPhase::Voting)->create(['title' => 'Sprint 41', 'created_at' => now()->subDays(2)]);
    Retro::factory()->for($alpha)->inPhase(RetroPhase::Writing)->create(['title' => 'Sprint 42', 'created_at' => now()->subDay()]);
    PokerGame::factory()->for($alpha)->count(2)->create();
    PokerGame::factory()->for($alpha)->ended()->create();
    ActionItem::factory()->withoutRetro($alpha, $owner)->count(2)->create();
    ActionItem::factory()->withoutRetro($alpha, $owner)->overdue()->create();
    ActionItem::factory()->withoutRetro($alpha, $owner)->overdue()->completed()->create();

    Retro::factory()->for($beta)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subDays(20)]);
    Retro::factory()->for($beta)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subDays(3)]);

    $this->actingAs($owner)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('teams.0.activity.openRetroTitle', 'Sprint 42')
            ->where('teams.0.activity.lastRetroAt', now()->subDays(9)->toIso8601String())
            ->where('teams.0.activity.openPokerGames', 2)
            ->where('teams.0.activity.openActionItems', 3)
            ->where('teams.0.activity.overdueActionItems', 1)
            ->where('teams.1.activity.openRetroTitle', null)
            ->where('teams.1.activity.lastRetroAt', now()->subDays(3)->toIso8601String())
            ->where('teams.1.activity.openPokerGames', 0)
            ->where('teams.1.activity.openActionItems', 0)
            ->where('teams.1.activity.overdueActionItems', 0)
            ->where('teams.2.activity', [
                'openRetroTitle' => null,
                'openRetroSprint' => null,
                'lastRetroAt' => null,
                'openPokerGames' => 0,
                'openActionItems' => 0,
                'overdueActionItems' => 0,
                'whiteboardsEditedToday' => 0,
            ]));
});

it('says which teams of the workspace page the user belongs to', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace, WorkspaceRole::Admin);
    $joined = Team::factory()->for($workspace)->create(['name' => 'Joined']);
    Team::factory()->for($workspace)->create(['name' => 'Managed only']);
    $joined->members()->attach($admin);

    $this->actingAs($admin)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('teams.0.isMember', true)
            ->where('teams.1.isMember', false));
});

it('names one other admin of the workspace to a manager only', function () {
    $workspace = Workspace::factory()->create();
    $owner = workspaceManager($workspace, WorkspaceRole::Owner);
    $zoe = workspaceManager($workspace, WorkspaceRole::Admin);
    $zoe->update(['name' => 'Zoe']);
    $camille = workspaceManager($workspace, WorkspaceRole::Admin);
    $camille->update(['name' => 'Camille']);
    $member = workspaceManager($workspace, WorkspaceRole::Member);
    $member->update(['name' => 'Aaron']);

    $this->actingAs($owner)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page->where('otherAdminName', 'Camille'));

    $this->actingAs($member)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page->where('otherAdminName', null));
});

it('names no other admin to the only manager of a workspace', function () {
    $workspace = Workspace::factory()->create();
    $owner = workspaceManager($workspace, WorkspaceRole::Owner);
    workspaceManager($workspace, WorkspaceRole::Member);

    $this->actingAs($owner)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('adminsCount', 1)
            ->where('otherAdminName', null));
});

it('reads the activity of the teams with the same number of queries for one team and for four', function () {
    $workspace = Workspace::factory()->create();
    $owner = workspaceManager($workspace, WorkspaceRole::Owner);
    $countQueries = function () use ($owner, $workspace): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($owner)->get(route('workspaces.show', $workspace))->assertOk();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    };
    $busyTeam = function () use ($workspace, $owner): void {
        $team = Team::factory()->for($workspace)->create();
        $team->members()->attach($owner);
        Retro::factory()->for($team)->create();
        PokerGame::factory()->for($team)->create();
        ActionItem::factory()->withoutRetro($team, $owner)->create();
    };

    $busyTeam();
    $this->actingAs($owner)->get(route('workspaces.show', $workspace))->assertOk();
    $withOne = $countQueries();
    $busyTeam();
    $busyTeam();
    $busyTeam();

    expect($countQueries())->toBe($withOne);
});
