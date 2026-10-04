<?php

use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Actions\Workspaces\InvitationTerms;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Tests\Concurrency\Support\Race;

it('leaves one pending invitation when one address is invited twice at the same instant', function () {
    $workspace = Workspace::factory()->create();
    $inviter = workspaceManager($workspace);
    $workspaceId = $workspace->id;
    $inviterId = $inviter->id;

    $outcomes = Race::run(array_fill(0, 2, static fn (): string => resolve(CreateWorkspaceInvitation::class)->handle(
        Workspace::query()->findOrFail($workspaceId),
        User::query()->findOrFail($inviterId),
        new InvitationTerms('same@example.com', WorkspaceRole::Member),
    )->invitation->id));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(WorkspaceInvitation::query()->where('email', 'same@example.com')->whereNull('accepted_at')->count())->toBe(1);
});
