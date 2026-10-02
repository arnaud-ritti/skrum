<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

it('lists members and pending invitations for managers', function () {
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();
    $workspace->invitations()->create([
        'email' => 'pending@example.com',
        'role' => WorkspaceRole::Member,
        'token_hash' => str_repeat('a', 64),
        'expires_at' => now()->addDay(),
    ]);

    $this->actingAs($admin)
        ->get(route('workspaces.members.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspaces/members')
            ->has('members', 1)
            ->has('invitations', 1)
            ->where('canManage', true));
});

it('sends the avatar of each member and the day of each invitation', function () {
    $this->travelTo('2026-09-26 10:00:00');

    $admin = User::factory()->create();
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();
    $workspace->invitations()->create([
        'email' => 'pending@example.com',
        'role' => WorkspaceRole::Member,
        'token_hash' => str_repeat('a', 64),
        'expires_at' => now()->addDay(),
    ]);
    $workspace->invitations()->create([
        'email' => 'late@example.com',
        'role' => WorkspaceRole::Admin,
        'token_hash' => str_repeat('b', 64),
        'expires_at' => now()->subDay(),
    ]);

    $this->actingAs($admin)
        ->get(route('workspaces.members.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('members.0.avatarUrl', $admin->avatarUrl())
            ->where('members.0.role', 'admin')
            ->has('invitations', 2)
            ->where('invitations', fn ($invitations) => collect($invitations)->every(
                fn (array $invitation): bool => $invitation['invitedAt'] === now()->toIso8601String(),
            ))
            ->where('invitations', fn ($invitations) => collect($invitations)->pluck('isExpired', 'email')->all() === [
                'pending@example.com' => false,
                'late@example.com' => true,
            ]));
});

it('forbids members from the members page', function () {
    $member = User::factory()->create();
    $workspace = Workspace::factory()->withMember($member)->create();

    $this->actingAs($member)->get(route('workspaces.members.index', $workspace))->assertForbidden();
});

it('lets admins change a member role but not grant ownership', function () {
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($admin, WorkspaceRole::Admin)
        ->withMember($member, WorkspaceRole::Member)
        ->create();

    $this->actingAs($admin)->patch(route('workspaces.members.update', [$workspace, $member]), ['role' => 'admin']);
    expect($member->roleIn($workspace))->toBe(WorkspaceRole::Admin);

    $this->actingAs($admin)
        ->patch(route('workspaces.members.update', [$workspace, $member]), ['role' => 'owner'])
        ->assertForbidden();
});

it('forbids admins from changing an owner', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($owner, WorkspaceRole::Owner)
        ->withMember($admin, WorkspaceRole::Admin)
        ->create();

    $this->actingAs($admin)
        ->patch(route('workspaces.members.update', [$workspace, $owner]), ['role' => 'member'])
        ->assertForbidden();
    $this->actingAs($admin)
        ->delete(route('workspaces.members.destroy', [$workspace, $owner]))
        ->assertForbidden();
});

it('lets an owner transfer ownership then step down', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($owner, WorkspaceRole::Owner)
        ->withMember($admin, WorkspaceRole::Admin)
        ->create();

    $this->actingAs($owner)->patch(route('workspaces.members.update', [$workspace, $admin]), ['role' => 'owner']);
    $this->actingAs($owner)->patch(route('workspaces.members.update', [$workspace, $owner]), ['role' => 'admin']);

    expect($admin->roleIn($workspace))->toBe(WorkspaceRole::Owner)
        ->and($owner->roleIn($workspace))->toBe(WorkspaceRole::Admin);
});

it('protects the last owner from demotion and removal', function () {
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->withMember($owner, WorkspaceRole::Owner)->create();

    $this->actingAs($owner)
        ->patch(route('workspaces.members.update', [$workspace, $owner]), ['role' => 'admin'])
        ->assertSessionHasErrors('role');
    $this->actingAs($owner)
        ->delete(route('workspaces.members.destroy', [$workspace, $owner]))
        ->assertSessionHasErrors('member');

    expect($owner->roleIn($workspace))->toBe(WorkspaceRole::Owner);
});

it('lets a member leave and cleans up teams and current workspace', function () {
    $member = User::factory()->create();
    $workspace = Workspace::factory()->withMember($member)->create();
    $team = Team::factory()->for($workspace)->withMember($member)->create();
    $member->forceFill(['current_workspace_id' => $workspace->id])->save();

    $this->actingAs($member)
        ->delete(route('workspaces.members.destroy', [$workspace, $member]))
        ->assertRedirect(route('dashboard'));

    expect($member->belongsToWorkspace($workspace))->toBeFalse()
        ->and($team->hasMember($member))->toBeFalse()
        ->and($member->fresh()->current_workspace_id)->toBeNull();

    $this->actingAs($member->fresh())->get(route('dashboard'))->assertRedirect(route('workspaces.create'));
});

it('forbids members from removing others', function () {
    $member = User::factory()->create();
    $other = User::factory()->create();
    $workspace = Workspace::factory()->withMember($member)->withMember($other)->create();

    $this->actingAs($member)
        ->delete(route('workspaces.members.destroy', [$workspace, $other]))
        ->assertForbidden();
});

it('returns 404 for a malformed member id', function () {
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->withMember($owner, WorkspaceRole::Owner)->create();

    $this->actingAs($owner)
        ->patch("/w/{$workspace->slug}/members/not-a-uuid", ['role' => 'admin'])
        ->assertNotFound();
});
