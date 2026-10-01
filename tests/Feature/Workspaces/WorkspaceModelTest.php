<?php

use App\Actions\Workspaces\CreateWorkspace;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;

it('creates a workspace owned by its creator', function () {
    $user = User::factory()->create();

    $workspace = resolve(CreateWorkspace::class)->handle($user, 'Acme Corp');

    expect($workspace->name)->toBe('Acme Corp')
        ->and($workspace->slug)->toMatch('/^acme-corp-[a-z0-9]{6}$/')
        ->and($user->roleIn($workspace))->toBe(WorkspaceRole::Owner)
        ->and($user->fresh()->current_workspace_id)->toBe($workspace->id);
});

it('falls back to a generic slug when the name has no latin characters', function () {
    $workspace = resolve(CreateWorkspace::class)->handle(User::factory()->create(), '!!!');

    expect($workspace->slug)->toMatch('/^workspace-[a-z0-9]{6}$/');
});

it('returns no role for non members', function () {
    $workspace = Workspace::factory()->create();

    expect(User::factory()->create()->roleIn($workspace))->toBeNull();
});

it('authorizes workspace abilities by role', function (WorkspaceRole $role, bool $canManage, bool $canDelete) {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();

    expect($user->can('view', $workspace))->toBeTrue()
        ->and($user->can('manageMembers', $workspace))->toBe($canManage)
        ->and($user->can('delete', $workspace))->toBe($canDelete);
})->with([
    'owner' => [WorkspaceRole::Owner, true, true],
    'admin' => [WorkspaceRole::Admin, true, false],
    'member' => [WorkspaceRole::Member, false, false],
]);

it('denies every workspace ability to outsiders', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();

    expect($user->can('view', $workspace))->toBeFalse()
        ->and($user->can('manageMembers', $workspace))->toBeFalse()
        ->and($user->can('delete', $workspace))->toBeFalse();
});
