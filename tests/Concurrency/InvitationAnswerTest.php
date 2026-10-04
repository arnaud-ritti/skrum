<?php

use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Actions\Workspaces\DeclineWorkspaceInvitation;
use App\Exceptions\InvitationUnavailable;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Tests\Concurrency\Support\Race;

it('lets one answer win when an invitation is accepted and declined at the same instant', function () {
    $user = User::factory()->create(['email' => 'nadia@example.com']);
    $invitation = WorkspaceInvitation::factory()->create(['email' => 'nadia@example.com']);
    $invitationId = $invitation->id;
    $userId = $user->id;

    $outcomes = Race::run([
        static fn (): string => tap('accepted', fn () => resolve(AcceptWorkspaceInvitation::class)->handle(WorkspaceInvitation::query()->findOrFail($invitationId), User::query()->findOrFail($userId))),
        static fn (): string => tap('declined', fn () => resolve(DeclineWorkspaceInvitation::class)->handle(WorkspaceInvitation::query()->findOrFail($invitationId))),
    ]);

    $fresh = $invitation->fresh();

    expect(array_column($outcomes, 'ok'))->toContain(true)
        ->and(collect($outcomes)->where('ok', false)->pluck('error')->all())->each->toBe(InvitationUnavailable::class)
        ->and(($fresh->accepted_at !== null) xor ($fresh->declined_at !== null))->toBeTrue()
        ->and($user->belongsToWorkspace($fresh->workspace))->toBe($fresh->accepted_at !== null);
});

it('declines once when one invitation is declined twice at the same instant', function () {
    $invitation = WorkspaceInvitation::factory()->create();
    $invitationId = $invitation->id;

    $outcomes = Race::run(array_fill(0, 2, static fn (): string => resolve(DeclineWorkspaceInvitation::class)
        ->handle(WorkspaceInvitation::query()->findOrFail($invitationId))->id));

    expect(collect($outcomes)->where('ok', true)->count())->toBe(1)
        ->and(collect($outcomes)->where('ok', false)->pluck('error')->all())->each->toBe(InvitationUnavailable::class)
        ->and($invitation->fresh()->isDeclined())->toBeTrue();
});
