<?php

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('is no longer pending once declined', function () {
    $invitation = WorkspaceInvitation::factory()->declined()->create();

    expect($invitation->isPending())->toBeFalse()
        ->and($invitation->isDeclined())->toBeTrue();
});

it('carries a team, a team role and a message', function () {
    $team = Team::factory()->create();
    $invitation = WorkspaceInvitation::factory()
        ->for($team->workspace)
        ->forTeam($team, TeamRole::Facilitator)
        ->withMessage("See you on Thursday.\nBring coffee.")
        ->create()
        ->fresh();

    expect($invitation->team->is($team))->toBeTrue()
        ->and($invitation->team_role)->toBe(TeamRole::Facilitator)
        ->and($invitation->message)->toBe("See you on Thursday.\nBring coffee.")
        ->and($team->invitations()->sole()->is($invitation))->toBeTrue();
});

it('goes with its team', function () {
    $team = Team::factory()->create();
    WorkspaceInvitation::factory()->for($team->workspace)->forTeam($team)->create();

    $team->delete();

    expect(WorkspaceInvitation::query()->count())->toBe(0);
});

it('reads a row written before the team columns as a pending workspace invitation', function () {
    $invitation = WorkspaceInvitation::factory()->create();
    $id = (string) Str::uuid7();
    DB::table('workspace_invitations')->insert([
        'id' => $id,
        'workspace_id' => $invitation->workspace_id,
        'email' => 'legacy@example.com',
        'role' => 'member',
        'token_hash' => WorkspaceInvitation::hashToken('legacy-token'),
        'expires_at' => now()->addDays(3),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $legacy = WorkspaceInvitation::query()->findOrFail($id);

    expect($legacy->isPending())->toBeTrue()
        ->and($legacy->team)->toBeNull()
        ->and($legacy->team_role)->toBeNull()
        ->and($legacy->message)->toBeNull();
});

it('offers every team role but owner to an invitation', function () {
    expect(TeamRole::invitable())->toBe([TeamRole::Facilitator, TeamRole::Member, TeamRole::Observer]);
});
