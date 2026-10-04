<?php

use App\Actions\Workspaces\InvitationTerms;
use App\Actions\Workspaces\SendInvitation;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Mail\WorkspaceInvitationMail;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\WorkspaceInvitationNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;

it('issues a team invitation with its role and message, mails it and tells the bell', function () {
    Notification::fake();
    $team = Team::factory()->create(['name' => 'Atlas']);
    $inviter = workspaceManager($team->workspace);
    $known = User::factory()->create(['email' => 'nadia@example.com', 'email_verified_at' => now()]);

    $issued = resolve(SendInvitation::class)->handle($team->workspace, $inviter, new InvitationTerms(
        'Nadia@Example.com ', WorkspaceRole::Member, $team, TeamRole::Facilitator, '  See you Thursday.  ',
    ));

    expect($issued->invitation->email)->toBe('nadia@example.com')
        ->and($issued->invitation->team_id)->toBe($team->id)
        ->and($issued->invitation->team_role)->toBe(TeamRole::Facilitator)
        ->and($issued->invitation->message)->toBe('See you Thursday.')
        ->and($issued->url())->toBe(route('invitations.show', $issued->token));
    Notification::assertSentOnDemand(WorkspaceInvitationNotification::class);
    Notification::assertSentTo($known, WorkspaceInvitationReceivedNotification::class);
});

it('writes to an address without an account in the language of the workspace', function () {
    Notification::fake();
    $workspace = Workspace::factory()->create(['locale' => 'es']);
    $inviter = workspaceManager($workspace);

    resolve(SendInvitation::class)->handle($workspace, $inviter, new InvitationTerms('new@example.com', WorkspaceRole::Member));

    Notification::assertSentOnDemand(
        WorkspaceInvitationNotification::class,
        fn (WorkspaceInvitationNotification $notification) => $notification->locale === 'es',
    );
});

it('shows the team, its colour and the message in the mail, as plain text', function () {
    $team = Team::factory()->create(['name' => 'Atlas', 'color' => 'lagoon']);
    $inviter = workspaceManager($team->workspace);
    $issued = resolve(SendInvitation::class)->handle($team->workspace, $inviter, new InvitationTerms(
        'new@example.com', WorkspaceRole::Member, $team, TeamRole::Member, '<b>Hi</b> [click](https://evil.test)',
    ));

    $mail = new WorkspaceInvitationNotification($team->workspace->name, $inviter->name, $issued->url(), $issued->invitation->expires_at, $issued->invitation->id)
        ->toMail((new AnonymousNotifiable)->route('mail', 'new@example.com'));
    $html = (string) $mail->render();

    expect($mail)->toBeInstanceOf(WorkspaceInvitationMail::class)
        ->and($mail->subject)->toBe("{$inviter->name} invited you to join Atlas on {$team->workspace->name}")
        ->and($html)->toContain('Atlas')
        ->toContain('&lt;b&gt;Hi&lt;/b&gt;')
        ->not->toContain('href="https://evil.test"');
    $mail->assertSeeInText('[click](https://evil.test)');
});

it('invites to a team of the workspace from the workspace dialog', function () {
    Notification::fake();
    $team = Team::factory()->create(['name' => 'Atlas']);
    $inviter = workspaceManager($team->workspace);

    $this->actingAs($inviter)
        ->post(route('workspaces.invitations.store', $team->workspace), [
            'email' => 'new@example.com',
            'role' => 'member',
            'team_id' => $team->id,
            'team_role' => 'observer',
            'message' => 'Welcome aboard.',
        ])
        ->assertSessionHasNoErrors();

    $invitation = $team->workspace->invitations()->sole();
    expect($invitation->team_id)->toBe($team->id)
        ->and($invitation->team_role)->toBe(TeamRole::Observer)
        ->and($invitation->message)->toBe('Welcome aboard.');
});

it('refuses a team of another workspace, an owner role and someone already in the team', function (Closure $payload, string $field) {
    Notification::fake();
    $team = Team::factory()->create(['name' => 'Atlas']);
    $inviter = workspaceManager($team->workspace);

    $this->actingAs($inviter)
        ->post(route('workspaces.invitations.store', $team->workspace), ['email' => 'new@example.com', 'role' => 'member', ...$payload($team)])
        ->assertSessionHasErrors($field);

    expect($team->workspace->invitations()->count())->toBe(0);
})->with([
    'another workspace' => [fn (Team $team): array => ['team_id' => Team::factory()->create()->id, 'team_role' => 'member'], 'team_id'],
    'owner role' => [fn (Team $team): array => ['team_id' => $team->id, 'team_role' => 'owner'], 'team_role'],
    'no team role' => [fn (Team $team): array => ['team_id' => $team->id], 'team_role'],
    'already in the team' => [fn (Team $team): array => ['email' => teamMember($team)->email, 'team_id' => $team->id, 'team_role' => 'member'], 'email'],
]);
