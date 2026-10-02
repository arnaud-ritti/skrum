<?php

namespace Tests\Feature;

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page(): void
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_users_without_workspace_are_sent_to_workspace_creation(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('workspaces.create'));
    }

    public function test_a_remembered_team_is_the_redirect_target(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();
        Team::factory()->for($workspace)->create(['name' => 'Alpha']);
        $remembered = Team::factory()->for($workspace)->create(['name' => 'Bravo']);

        $this->actingAs($user)
            ->withSession(['current_team_id' => $remembered->id])
            ->get(route('dashboard'))
            ->assertRedirect(route('teams.show', [$workspace, $remembered]));
    }

    public function test_without_a_remembered_team_the_first_visible_team_by_name_is_the_target(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();
        Team::factory()->for($workspace)->create(['name' => 'Bravo']);
        $first = Team::factory()->for($workspace)->create(['name' => 'Alpha']);

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertRedirect(route('teams.show', [$workspace, $first]));
    }

    public function test_a_remembered_team_of_another_workspace_is_ignored(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();
        $first = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
        $foreign = Team::factory()->create(['name' => 'Aardvark']);

        $this->actingAs($user)
            ->withSession(['current_team_id' => $foreign->id])
            ->get(route('dashboard'))
            ->assertRedirect(route('teams.show', [$workspace, $first]));
    }

    public function test_a_remembered_team_the_member_can_no_longer_see_is_ignored(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::factory()->withMember($user)->create();
        $visible = Team::factory()->for($workspace)->withMember($user)->create(['name' => 'Bravo']);
        $hidden = Team::factory()->for($workspace)->create(['name' => 'Alpha']);

        $this->actingAs($user)
            ->withSession(['current_team_id' => $hidden->id])
            ->get(route('dashboard'))
            ->assertRedirect(route('teams.show', [$workspace, $visible]));
    }

    public function test_a_workspace_without_a_visible_team_lands_on_the_workspace_page_without_a_loop(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::factory()->withMember($user)->create();
        Team::factory()->for($workspace)->create();

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertRedirect(route('workspaces.show', $workspace));

        $this->actingAs($user)
            ->followingRedirects()
            ->get(route('dashboard'))
            ->assertOk();
    }

    public function test_a_user_without_a_workspace_lands_on_creation_without_a_loop(): void
    {
        $this->actingAs(User::factory()->create())
            ->followingRedirects()
            ->get(route('dashboard'))
            ->assertOk();
    }

    public function test_a_team_page_reached_through_the_dashboard_is_openable(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();
        Team::factory()->for($workspace)->create();

        $this->actingAs($user)
            ->followingRedirects()
            ->get(route('dashboard'))
            ->assertOk();
    }
}
