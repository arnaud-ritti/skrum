<?php

use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Notifications\InvitationDeclinedNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

it('declines a pending invitation without an account, and the link then says so', function () {
    Notification::fake();
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $invitation = WorkspaceInvitation::factory()->forTeam($team)->withToken('t')->create(['invited_by_id' => $inviter->id]);

    $this->post(route('invitations.decline.store', 't'))->assertRedirect(route('invitations.show', 't'));

    expect($invitation->fresh()->isDeclined())->toBeTrue();
    Notification::assertSentTo($inviter, InvitationDeclinedNotification::class);
    $this->get(route('invitations.show', 't'))
        ->assertInertia(fn (Assert $page) => $page->where('isDeclined', true)->where('inviter.name', $inviter->name));
    $this->actingAs(User::factory()->create(['email' => $invitation->email]))
        ->post(route('invitations.acceptance.store', 't'))
        ->assertStatus(410);
});

it('offers the decline link on a pending invitation', function () {
    WorkspaceInvitation::factory()->withToken('t')->create();

    $this->get(route('invitations.show', 't'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('isDeclined', false)
            ->where('declineUrl', route('invitations.decline.store', 't')));
});

it('removes the invitee bell item and tells nobody when the inviter left the workspace', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $invitee = User::factory()->create(['email_verified_at' => now()]);
    $invitation = WorkspaceInvitation::factory()->forTeam($team)->withToken('t')->create(['email' => $invitee->email, 'invited_by_id' => $inviter->id]);
    $invitee->notifyNow(new WorkspaceInvitationReceivedNotification($invitation->id, 't'));
    $team->workspace->members()->detach($inviter);

    $this->post(route('invitations.decline.store', 't'))->assertRedirect(route('invitations.show', 't'));

    expect($invitation->fresh()->isDeclined())->toBeTrue()
        ->and($invitee->notifications()->count())->toBe(0)
        ->and($inviter->notifications()->count())->toBe(0);
});

it('refuses to decline an invitation that is no longer pending', function (string $state) {
    WorkspaceInvitation::factory()->{$state}()->withToken('t')->create();

    $this->post(route('invitations.decline.store', 't'))->assertStatus(410);
})->with(['accepted', 'declined', 'expired']);

it('answers 404 to the decline of an unknown token', function () {
    $this->post(route('invitations.decline.store', 'unknown'))->assertNotFound();
});

it('presents the decline in the inviter bell, linking to the members of the team', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $inviter = teamInviter($team);
    $invitation = WorkspaceInvitation::factory()->forTeam($team)->create(['email' => 'nadia@example.com', 'invited_by_id' => $inviter->id]);
    $inviter->notifyNow(new InvitationDeclinedNotification($invitation->id, 'nadia@example.com', $team->workspace_id, $team->id));

    $this->actingAs($inviter)
        ->getJson(route('notifications.index'))
        ->assertJsonPath('notifications.0.kind', 'invitation_declined')
        ->assertJsonPath('notifications.0.email', 'nadia@example.com')
        ->assertJsonPath('notifications.0.team', 'Atlas')
        ->assertJsonPath('notifications.0.href', route('teams.members.index', [$team->workspace, $team]))
        ->assertJsonPath('notifications.0.target', 'team');
});

it('presents a workspace decline with the workspace name, and drops it once the inviter left', function () {
    $team = Team::factory()->create();
    $workspace = $team->workspace;
    $manager = workspaceManager($workspace);
    $invitation = WorkspaceInvitation::factory()->create(['workspace_id' => $workspace->id, 'email' => 'nadia@example.com', 'invited_by_id' => $manager->id]);
    $manager->notifyNow(new InvitationDeclinedNotification($invitation->id, 'nadia@example.com', $workspace->id, null));

    $this->actingAs($manager)
        ->getJson(route('notifications.index'))
        ->assertJsonPath('notifications.0.team', $workspace->name)
        ->assertJsonPath('notifications.0.href', route('workspaces.members.index', $workspace))
        ->assertJsonPath('notifications.0.target', 'members');

    $workspace->members()->detach($manager);

    $this->actingAs($manager)->getJson(route('notifications.index'))->assertJsonCount(0, 'notifications');
    expect($manager->notifications()->count())->toBe(0);
});
