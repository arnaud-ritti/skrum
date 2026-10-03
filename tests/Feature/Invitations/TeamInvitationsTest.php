<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Support\Facades\Notification;

beforeEach(fn () => Notification::fake());

it('lets a team inviter invite several addresses to the team at once', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);

    $this->actingAs($inviter)
        ->post(route('teams.invitations.store', [$team->workspace, $team]), [
            'emails' => ['camille@example.com', ' Theo@Example.com', 'camille@example.com'],
            'role' => 'observer',
            'message' => 'Welcome!',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $invitations = $team->invitations()->orderBy('email')->get();

    expect($invitations->pluck('email')->all())->toBe(['camille@example.com', 'theo@example.com'])
        ->and($invitations->pluck('team_role')->unique()->all())->toBe([TeamRole::Observer])
        ->and($invitations->pluck('role')->unique()->all())->toBe([WorkspaceRole::Member])
        ->and($invitations->pluck('message')->unique()->all())->toBe(['Welcome!']);
    Notification::assertSentOnDemandTimes(WorkspaceInvitationNotification::class, 2);
});

it('names the address that cannot be invited and sends nothing', function (array $emails, string $errorKey) {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $inTeam = teamMember($team);

    $this->actingAs($inviter)
        ->post(route('teams.invitations.store', [$team->workspace, $team]), [
            'emails' => array_map(fn (string $email): string => $email === 'IN_TEAM' ? $inTeam->email : $email, $emails),
            'role' => 'member',
        ])
        ->assertSessionHasErrors($errorKey);

    expect(WorkspaceInvitation::query()->count())->toBe(0);
    Notification::assertNothingSent();
})->with([
    'invalid' => [['ok@example.com', 'malik@nordlys'], 'emails.1'],
    'already in the team' => [['ok@example.com', 'IN_TEAM'], 'emails.1'],
    'more than twenty' => [array_map(fn (int $i): string => "p{$i}@example.com", range(1, 21)), 'emails'],
    'none' => [[], 'emails'],
]);

it('invites a member of the workspace who is not in the team', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $colleague = User::factory()->create();
    $team->workspace->members()->attach($colleague, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($inviter)
        ->post(route('teams.invitations.store', [$team->workspace, $team]), ['emails' => [$colleague->email], 'role' => 'member'])
        ->assertSessionHasNoErrors();

    expect($team->invitations()->count())->toBe(1);
});

it('lets a facilitator of the team invite, with any role but owner', function (string $role) {
    $team = Team::factory()->create();

    $this->actingAs(teamFacilitator($team))
        ->post(route('teams.invitations.store', [$team->workspace, $team]), ['emails' => ['a@example.com'], 'role' => $role])
        ->assertSessionHasNoErrors();

    expect($team->invitations()->sole()->team_role->value)->toBe($role);
})->with(['facilitator', 'member', 'observer']);

it('refuses the owner role', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamInviter($team))
        ->post(route('teams.invitations.store', [$team->workspace, $team]), ['emails' => ['a@example.com'], 'role' => 'owner'])
        ->assertSessionHasErrors('role');
});

it('refuses people who may not invite to the team', function (string $who) {
    $team = Team::factory()->create();
    $other = Team::factory()->for($team->workspace)->create();
    $user = match ($who) {
        'member' => teamMember($team, TeamRole::Member),
        'observer' => teamMember($team, TeamRole::Observer),
        'facilitator of another team' => teamFacilitator($other),
        'workspace member outside the team' => tap(User::factory()->create(), fn (User $user) => $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value])),
    };

    $this->actingAs($user)
        ->post(route('teams.invitations.store', [$team->workspace, $team]), ['emails' => ['a@example.com'], 'role' => 'member'])
        ->assertForbidden();

    expect(WorkspaceInvitation::query()->count())->toBe(0);
})->with(['member', 'observer', 'facilitator of another team', 'workspace member outside the team']);

it('lets a team inviter resend and revoke the invitations of the team and of no other', function (string $who) {
    $team = Team::factory()->create();
    $other = Team::factory()->for($team->workspace)->create();
    $inviter = $who === 'owner' ? teamInviter($team) : teamFacilitator($team);
    $own = WorkspaceInvitation::factory()->forTeam($team)->create(['email' => 'own@example.com']);
    $foreign = WorkspaceInvitation::factory()->forTeam($other)->create();
    $workspaceOnly = WorkspaceInvitation::factory()->for($team->workspace)->create();

    $this->actingAs($inviter)->post(route('workspaces.invitations.resend.store', [$team->workspace, $own]))->assertRedirect();
    $this->actingAs($inviter)->post(route('workspaces.invitations.resend.store', [$team->workspace, $foreign]))->assertForbidden();
    $this->actingAs($inviter)->delete(route('workspaces.invitations.destroy', [$team->workspace, $workspaceOnly]))->assertForbidden();

    $resent = $team->invitations()->sole();

    expect($resent->email)->toBe('own@example.com')
        ->and($resent->is($own))->toBeFalse()
        ->and($resent->invited_by_id)->toBe($inviter->id);
    Notification::assertSentOnDemandTimes(WorkspaceInvitationNotification::class, 1);

    $this->actingAs($inviter)->delete(route('workspaces.invitations.destroy', [$team->workspace, $resent]))->assertRedirect();
    expect($team->invitations()->count())->toBe(0);
})->with(['owner', 'facilitator']);
