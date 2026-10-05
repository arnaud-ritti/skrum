<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Support\SessionKey;

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

    $url = session(SessionKey::FLASH_DATA)['invitationUrl'];
    $token = Str::afterLast($url, '/');

    expect($url)->toBe(route('invitations.show', $token))
        ->and(WorkspaceInvitation::findByToken($token)?->is($workspace->invitations()->sole()))->toBeTrue();
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

    $this->actingAs($admin)->delete(route('workspaces.invitations.destroy', [$workspace, $invitation]))->assertRedirect();

    expect(WorkspaceInvitation::query()->whereKey($invitation->id)->exists())->toBeFalse();
});

it('keeps an invitation that a member, or an admin through another workspace, tries to revoke', function () {
    $workspace = Workspace::factory()->create();
    $invitation = WorkspaceInvitation::factory()->for($workspace)->create();
    $elsewhere = Workspace::factory()->create();

    $this->actingAs(workspaceMember($workspace))
        ->delete(route('workspaces.invitations.destroy', [$workspace, $invitation]))
        ->assertForbidden();
    $this->actingAs(workspaceManager($elsewhere))
        ->delete(route('workspaces.invitations.destroy', [$elsewhere, $invitation]))
        ->assertNotFound();

    expect(WorkspaceInvitation::query()->whereKey($invitation->id)->exists())->toBeTrue();
});

it('encrypts the queued invitation so the token never sits in plain text in the jobs table', function () {
    $notification = new WorkspaceInvitationNotification('Acme', 'Ann', 'https://example.com/invitations/token', now()->addDay());

    expect($notification)->toBeInstanceOf(ShouldBeEncrypted::class);
});

it('does not render markdown links injected through the workspace name', function () {
    $notification = new WorkspaceInvitationNotification(
        '[x](https://evil.test)',
        '[y](https://evil.test)',
        'https://skrum.test/invitations/token',
        now()->addDays(7),
    );

    $html = (string) $notification->toMail(new User)->render();

    expect($html)->not->toContain('href="https://evil.test"');
});

it('rate limits invitations per user', function () {
    Notification::fake();
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();

    foreach (range(1, 20) as $number) {
        $this->actingAs($admin)
            ->post(route('workspaces.invitations.store', $workspace), ['email' => "person{$number}@example.com", 'role' => 'member'])
            ->assertRedirect();
    }

    $this->actingAs($admin)
        ->post(route('workspaces.invitations.store', $workspace), ['email' => 'one-too-many@example.com', 'role' => 'member'])
        ->assertStatus(429);

    $this->actingAs(workspaceManager($workspace))
        ->post(route('workspaces.invitations.store', $workspace), ['email' => 'from-another-admin@example.com', 'role' => 'member'])
        ->assertRedirect();
});
