<?php

use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;

it('issues an invitation that can be found by its plain token only', function () {
    $inviter = User::factory()->create();
    $workspace = Workspace::factory()->withMember($inviter, WorkspaceRole::Owner)->create();

    $issued = resolve(CreateWorkspaceInvitation::class)->handle($workspace, $inviter, 'new@example.com', WorkspaceRole::Admin);

    expect($issued->invitation->token_hash)->not->toBe($issued->token)
        ->and(WorkspaceInvitation::findByToken($issued->token)?->id)->toBe($issued->invitation->id)
        ->and(WorkspaceInvitation::findByToken('wrong'))->toBeNull()
        ->and(WorkspaceInvitation::findByToken(null))->toBeNull()
        ->and($issued->invitation->role)->toBe(WorkspaceRole::Admin)
        ->and($issued->invitation->expires_at->isFuture())->toBeTrue();
});

it('replaces a previous pending invitation for the same email', function () {
    $inviter = User::factory()->create();
    $workspace = Workspace::factory()->withMember($inviter, WorkspaceRole::Owner)->create();
    $createInvitation = resolve(CreateWorkspaceInvitation::class);

    $first = $createInvitation->handle($workspace, $inviter, 'new@example.com', WorkspaceRole::Member);
    $second = $createInvitation->handle($workspace, $inviter, 'NEW@example.com', WorkspaceRole::Admin);

    expect($workspace->invitations()->count())->toBe(1)
        ->and(WorkspaceInvitation::findByToken($first->token))->toBeNull()
        ->and(WorkspaceInvitation::findByToken($second->token))->not->toBeNull();
});

it('matches emails case-insensitively', function () {
    $invitation = WorkspaceInvitation::factory()->create(['email' => 'Bob@Example.com']);

    expect($invitation->matchesEmail('bob@example.com'))->toBeTrue()
        ->and($invitation->matchesEmail('alice@example.com'))->toBeFalse();
});

it('is only pending while unexpired and unaccepted', function () {
    expect(WorkspaceInvitation::factory()->create()->isPending())->toBeTrue()
        ->and(WorkspaceInvitation::factory()->expired()->create()->isPending())->toBeFalse()
        ->and(WorkspaceInvitation::factory()->accepted()->create()->isPending())->toBeFalse();
});

it('adds the invitee with the invited role and marks the invitation accepted', function () {
    $user = User::factory()->create();
    $invitation = WorkspaceInvitation::factory()->create(['role' => WorkspaceRole::Admin, 'email' => $user->email]);

    resolve(AcceptWorkspaceInvitation::class)->handle($invitation, $user);

    expect($user->roleIn($invitation->workspace))->toBe(WorkspaceRole::Admin)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and($user->fresh()->current_workspace_id)->toBe($invitation->workspace_id);
});

it('never changes the role of an existing member', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Owner)->create();
    $invitation = WorkspaceInvitation::factory()->for($workspace)->create(['role' => WorkspaceRole::Member, 'email' => $user->email]);

    resolve(AcceptWorkspaceInvitation::class)->handle($invitation, $user);

    expect($user->roleIn($workspace))->toBe(WorkspaceRole::Owner);
});

it('refuses to accept an expired invitation', function () {
    $user = User::factory()->create();
    $invitation = WorkspaceInvitation::factory()->expired()->create(['email' => $user->email]);

    expect(fn () => resolve(AcceptWorkspaceInvitation::class)->handle($invitation, $user))
        ->toThrow(InvalidArgumentException::class)
        ->and($user->belongsToWorkspace($invitation->workspace))->toBeFalse();
});

it('refuses to accept an already accepted invitation', function () {
    $user = User::factory()->create();
    $invitation = WorkspaceInvitation::factory()->accepted()->create(['email' => $user->email]);

    expect(fn () => resolve(AcceptWorkspaceInvitation::class)->handle($invitation, $user))
        ->toThrow(InvalidArgumentException::class);
});

it('refuses to accept an invitation sent to another email address', function () {
    $user = User::factory()->create();
    $invitation = WorkspaceInvitation::factory()->create(['email' => 'someone-else@example.com']);

    expect(fn () => resolve(AcceptWorkspaceInvitation::class)->handle($invitation, $user))
        ->toThrow(InvalidArgumentException::class)
        ->and($user->belongsToWorkspace($invitation->workspace))->toBeFalse();
});
