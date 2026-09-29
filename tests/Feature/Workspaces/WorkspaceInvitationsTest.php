<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Support\Facades\Notification;

it('invites someone by email', function () {
    Notification::fake();
    $admin = User::factory()->create(['locale' => 'fr']);
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();

    $this->actingAs($admin)
        ->post(route('workspaces.invitations.store', $workspace), ['email' => 'new@example.com', 'role' => 'member'])
        ->assertRedirect()
        ->assertInertiaFlashMissing('invitationUrl');

    expect($workspace->invitations()->sole()->email)->toBe('new@example.com');
    Notification::assertSentOnDemand(
        WorkspaceInvitationNotification::class,
        fn (WorkspaceInvitationNotification $notification, array $channels, object $notifiable) => $notifiable->routes['mail'] === 'new@example.com'
            && $notification->locale === 'fr',
    );
});

it('uses the recipient language when the recipient already has an account', function () {
    Notification::fake();
    $admin = User::factory()->create(['locale' => 'fr']);
    User::factory()->create(['email' => 'known@example.com', 'locale' => 'de']);
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();

    $this->actingAs($admin)->post(route('workspaces.invitations.store', $workspace), ['email' => 'known@example.com', 'role' => 'member']);

    Notification::assertSentOnDemand(
        WorkspaceInvitationNotification::class,
        fn (WorkspaceInvitationNotification $notification) => $notification->locale === 'de',
    );
});

it('flashes a copyable link when mail is only logged', function () {
    Notification::fake();
    config(['mail.default' => 'log']);
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();

    $this->actingAs($admin)
        ->post(route('workspaces.invitations.store', $workspace), ['email' => 'new@example.com', 'role' => 'member'])
        ->assertInertiaFlash('invitationUrl');
});

it('refuses ownership invitations and existing members', function (array $payload, string $errorField) {
    $admin = User::factory()->create(['email' => 'admin@example.com']);
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();

    $this->actingAs($admin)
        ->post(route('workspaces.invitations.store', $workspace), $payload)
        ->assertSessionHasErrors($errorField);
})->with([
    'owner role' => [['email' => 'new@example.com', 'role' => 'owner'], 'role'],
    'existing member' => [['email' => 'ADMIN@example.com', 'role' => 'member'], 'email'],
    'invalid email' => [['email' => 'not-an-email', 'role' => 'member'], 'email'],
]);

it('forbids members from inviting', function () {
    $member = User::factory()->create();
    $workspace = Workspace::factory()->withMember($member)->create();

    $this->actingAs($member)
        ->post(route('workspaces.invitations.store', $workspace), ['email' => 'new@example.com', 'role' => 'member'])
        ->assertForbidden();
});

it('lets managers revoke an invitation', function () {
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();
    $invitation = WorkspaceInvitation::factory()->for($workspace)->create();

    $this->actingAs($admin)->delete(route('workspaces.invitations.destroy', [$workspace, $invitation]));

    expect(WorkspaceInvitation::query()->whereKey($invitation->id)->exists())->toBeFalse();
});
