<?php

use App\Enums\TeamRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

it('offers the session in progress after accepting a team invitation', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->started()->create(['title' => 'Sprint 24']);
    $user = User::factory()->create(['email' => 'nadia@example.com']);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Member)->withToken('team-token')->create(['email' => 'nadia@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'team-token'))
        ->assertRedirect(route('teams.show', [$team->workspace, $team]))
        ->assertInertiaFlash('liveSession.kind', 'retro')
        ->assertInertiaFlash('liveSession.title', 'Sprint 24')
        ->assertInertiaFlash('liveSession.url', route('retros.show', $retro));
});

it('offers it after creating the account on the card', function () {
    config(['skrum.signup_mode' => 'invite']);
    $team = Team::factory()->create();
    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 24']);
    WorkspaceInvitation::factory()->forTeam($team)->withToken('team-token')->create(['email' => 'new@example.com']);

    $this->post(route('invitations.account.store', 'team-token'), ['name' => 'Nadia Benali', 'password' => 'a-long-enough-password-42'])
        ->assertInertiaFlash('liveSession.title', 'Sprint 24');
});

it('offers it after joining by the team link', function () {
    $link = TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    Retro::factory()->for($link->team)->started()->create(['title' => 'Sprint 24']);

    $this->actingAs(User::factory()->create())
        ->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertInertiaFlash('liveSession.title', 'Sprint 24');
});

it('offers it after a single sign-on that accepted a team invitation', function () {
    config([
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'skrum.signup_mode' => 'invite',
    ]);
    User::factory()->instanceAdmin()->create();
    $team = Team::factory()->create();
    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 24']);
    WorkspaceInvitation::factory()->forTeam($team)->withToken('team-token')->create(['email' => 'nadia@example.com']);
    $this->get(route('invitations.show', 'team-token'))->assertOk();
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-1', 'email' => 'nadia@example.com', 'email_verified' => true]));

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('teams.show', [$team->workspace, $team]))
        ->assertInertiaFlash('liveSession.title', 'Sprint 24');
});

it('offers nothing when no session of the team is in progress', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->create(['title' => 'Not started']);
    Retro::factory()->for(Team::factory()->for($team->workspace))->started()->create(['title' => 'Another team']);
    $user = User::factory()->create(['email' => 'nadia@example.com']);
    WorkspaceInvitation::factory()->forTeam($team)->withToken('team-token')->create(['email' => 'nadia@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'team-token'))
        ->assertInertiaFlashMissing('liveSession');
});

it('offers nothing after accepting a workspace invitation without a team', function () {
    $invitation = WorkspaceInvitation::factory()->withToken('ws-token')->create(['email' => 'nadia@example.com']);

    $this->actingAs(User::factory()->create(['email' => 'nadia@example.com']))
        ->post(route('invitations.acceptance.store', 'ws-token'))
        ->assertRedirect(route('workspaces.show', $invitation->workspace))
        ->assertInertiaFlashMissing('liveSession');
});

it('offers nothing to a member who opens the link of a team they are already in', function () {
    $link = TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    Retro::factory()->for($link->team)->started()->create();

    $this->actingAs(teamMember($link->team))
        ->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertInertiaFlashMissing('liveSession');
});

it('does not offer it again on the next visit of the team page', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 24']);
    $user = User::factory()->create(['email' => 'nadia@example.com']);
    WorkspaceInvitation::factory()->forTeam($team)->withToken('team-token')->create(['email' => 'nadia@example.com']);

    $this->actingAs($user)->post(route('invitations.acceptance.store', 'team-token'));
    $this->actingAs($user)->get(route('teams.show', [$team->workspace, $team]))->assertOk();

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertiaFlashMissing('liveSession');
});
