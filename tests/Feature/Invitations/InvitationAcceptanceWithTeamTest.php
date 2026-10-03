<?php

use App\Actions\Notifications\PresentInvitationNotifications;
use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Exceptions\InvitationUnavailable;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

it('joins the workspace and the team with their roles and opens the team page', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create(['email' => 'nadia@example.com']);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Facilitator)->withToken('team-token')->create(['email' => 'nadia@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'team-token'))
        ->assertRedirect(route('teams.show', [$team->workspace, $team]));

    expect($user->roleIn($team->workspace))->toBe(WorkspaceRole::Member)
        ->and($team->roleOf($user))->toBe(TeamRole::Facilitator);
});

it('never changes a role the account already has', function () {
    $team = Team::factory()->create();
    $user = workspaceManager($team->workspace);
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Observer)->withToken('team-token')->create(['email' => $user->email]);

    $this->actingAs($user)->post(route('invitations.acceptance.store', 'team-token'));

    expect($user->roleIn($team->workspace))->toBe(WorkspaceRole::Admin)
        ->and($team->roleOf($user))->toBe(TeamRole::Owner);
});

it('joins the team when the account is created on the card', function () {
    config(['skrum.signup_mode' => 'invite']);
    $team = Team::factory()->create();
    WorkspaceInvitation::factory()->forTeam($team)->withToken('team-token')->create(['email' => 'new@example.com']);

    $this->post(route('invitations.account.store', 'team-token'), ['name' => 'Nadia Benali', 'password' => 'a-long-enough-password-42'])
        ->assertRedirect(route('teams.show', [$team->workspace, $team]));

    expect($team->members()->where('email', 'new@example.com')->exists())->toBeTrue();
});

it('joins the team and opens the team page when the account is created through single sign-on', function () {
    config([
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'skrum.signup_mode' => 'invite',
    ]);
    User::factory()->instanceAdmin()->create();
    $team = Team::factory()->create();
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Facilitator)->withToken('team-token')->create(['email' => 'nadia@example.com']);
    $this->get(route('invitations.show', 'team-token'))->assertOk();
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-1', 'email' => 'nadia@example.com', 'email_verified' => true]));

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('teams.show', [$team->workspace, $team]));

    $user = User::query()->whereAddress('nadia@example.com')->sole();
    expect($team->roleOf($user))->toBe(TeamRole::Facilitator);
});

it('keeps accepting an invitation issued before the team columns as before', function () {
    $invitation = WorkspaceInvitation::factory()->withToken('old-token')->create(['email' => 'old@example.com']);
    $user = User::factory()->create(['email' => 'old@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'old-token'))
        ->assertRedirect(route('workspaces.show', $invitation->workspace));
});

it('shows the team, its mark, the role and the message on the invitation page', function () {
    $team = Team::factory()->create(['name' => 'Atlas', 'color' => 'lagoon']);
    teamMember($team);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Facilitator)->withMessage('See you Thursday.')->withToken('team-token')->create();

    $this->get(route('invitations.show', 'team-token'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('invitations/show')
            ->where('team', ['name' => 'Atlas', 'initial' => 'A', 'color' => 'lagoon'])
            ->where('teamRole', 'facilitator')
            ->where('message', 'See you Thursday.')
            ->where('membersCount', 1)
            ->where('isDeclined', false));
});

it('shows a team invitation to a workspace member who is not yet in the team', function () {
    $team = Team::factory()->create();
    $user = workspaceManager($team->workspace, WorkspaceRole::Member);
    WorkspaceInvitation::factory()->forTeam($team)->withToken('team-token')->create(['email' => $user->email]);

    $this->actingAs($user)
        ->get(route('invitations.show', 'team-token'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('invitations/show')->where('emailMatches', true));
});

it('sends a member of the team to the team page', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    WorkspaceInvitation::factory()->forTeam($team)->withToken('team-token')->create(['email' => $user->email]);

    $this->actingAs($user)
        ->get(route('invitations.show', 'team-token'))
        ->assertRedirect(route('teams.show', [$team->workspace, $team]));
});

it('tells a declined invitation apart on the invitation page', function () {
    WorkspaceInvitation::factory()->declined()->withToken('gone')->create();

    $this->get(route('invitations.show', 'gone'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('isExpired', true)
            ->where('isDeclined', true));
});

it('names the team in the invitee bell item', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $user = User::factory()->create(['email' => 'nadia@example.com']);
    $invitation = WorkspaceInvitation::factory()->forTeam($team)->withToken('team-token')->create(['email' => 'nadia@example.com']);
    $user->notify(new WorkspaceInvitationReceivedNotification($invitation->id, 'team-token'));

    $presented = resolve(PresentInvitationNotifications::class)->handle($user, $user->notifications()->get());

    expect(array_values($presented)[0]['team'])->toBe('Atlas');
});

it('refuses with 410 an invitation that stopped being pending under the lock', function () {
    $invitation = WorkspaceInvitation::factory()->declined()->withToken('gone')->create(['email' => 'x@example.com']);

    $this->actingAs(User::factory()->create(['email' => 'x@example.com']))
        ->post(route('invitations.acceptance.store', 'gone'))
        ->assertStatus(410);

    expect($invitation->fresh()->accepted_at)->toBeNull();
});

it('refuses to accept an invitation read before it was declined', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create(['email' => 'x@example.com']);
    $staleInvitation = WorkspaceInvitation::factory()->forTeam($team)->create(['email' => 'x@example.com']);
    WorkspaceInvitation::query()->findOrFail($staleInvitation->id)->update(['declined_at' => now()]);

    expect(fn () => resolve(AcceptWorkspaceInvitation::class)->handle($staleInvitation, $user))
        ->toThrow(InvitationUnavailable::class);

    expect($staleInvitation->fresh()->accepted_at)->toBeNull()
        ->and($team->hasMember($user))->toBeFalse()
        ->and($user->belongsToWorkspace($team->workspace))->toBeFalse();
});
