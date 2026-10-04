<?php

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

it('keeps the token encrypted and finds the link by its hash', function () {
    $link = TeamInviteLink::factory()->withToken('link-token-0123456789abcdefghijklmnopqrstu')->create();

    expect(DB::table('team_invite_links')->value('token'))->not->toContain('link-token')
        ->and($link->fresh()->token)->toBe('link-token-0123456789abcdefghijklmnopqrstu')
        ->and(TeamInviteLink::findByToken('link-token-0123456789abcdefghijklmnopqrstu')?->is($link))->toBeTrue()
        ->and(TeamInviteLink::findByToken('other'))->toBeNull()
        ->and($link->toArray())->not->toHaveKeys(['token', 'token_hash']);
});

it('is usable until it expires or is turned off', function (string $state, bool $usable) {
    $factory = TeamInviteLink::factory();
    $link = ($state === 'fresh' ? $factory : $factory->{$state}())->create();

    expect($link->isUsable())->toBe($usable);
})->with([
    ['fresh', true],
    ['expired', false],
    ['revoked', false],
]);

it('stays usable however many people joined through it', function () {
    expect(TeamInviteLink::factory()->joinedBy(10_000)->create()->isUsable())->toBeTrue();
});

it('gives a team its one usable link', function () {
    $team = Team::factory()->create();
    TeamInviteLink::factory()->for($team)->revoked()->create();
    $usable = TeamInviteLink::factory()->for($team)->create();

    expect($team->usableInviteLink()?->is($usable))->toBeTrue()
        ->and(Team::factory()->create()->usableInviteLink())->toBeNull();
});

it('goes with its team', function () {
    $link = TeamInviteLink::factory()->create();

    $link->team->delete();

    expect(TeamInviteLink::query()->count())->toBe(0);
});

it('creates the link, replaces it, and turns it off', function (string $who) {
    $team = Team::factory()->create();
    $inviter = $who === 'owner' ? teamInviter($team) : teamFacilitator($team);

    $this->actingAs($inviter)->post(route('teams.inviteLink.store', [$team->workspace, $team]))->assertRedirect();
    $first = $team->usableInviteLink();

    $this->actingAs($inviter)->post(route('teams.inviteLink.store', [$team->workspace, $team]));
    $second = $team->usableInviteLink();

    expect($first?->fresh()->revoked_at)->not->toBeNull()
        ->and($second?->is($first))->toBeFalse()
        ->and($second?->created_by_id)->toBe($inviter->id)
        ->and($second?->uses_count)->toBe(0)
        ->and($second?->expires_at->diffInDays(now(), true))->toBeGreaterThan(6.9);

    $this->actingAs($inviter)->delete(route('teams.inviteLink.destroy', [$team->workspace, $team]))->assertRedirect();
    expect($team->usableInviteLink())->toBeNull();
})->with(['owner', 'facilitator']);

it('refuses the link to someone who may not invite', function (TeamRole $role) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team, $role))->post(route('teams.inviteLink.store', [$team->workspace, $team]))->assertForbidden();
    $this->actingAs(teamMember($team, $role))->delete(route('teams.inviteLink.destroy', [$team->workspace, $team]))->assertForbidden();
})->with([TeamRole::Member, TeamRole::Observer]);

it('gives the team page the link and the pending invitations of the team to its inviters only', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    TeamInviteLink::factory()->for($team)->joinedBy(3)->withToken('page-token-0123456789abcdefghijklmnopqrstu')->create();
    WorkspaceInvitation::factory()->forTeam($team)->create(['email' => 'b@example.com']);
    WorkspaceInvitation::factory()->forTeam($team)->declined()->create(['email' => 'a@example.com']);

    $this->actingAs($inviter)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canInvite', true)
            ->where('inviteRoles', ['facilitator', 'member', 'observer'])
            ->where('pendingInvitations.0.email', 'a@example.com')
            ->where('pendingInvitations.0.status', 'declined')
            ->where('pendingInvitations.1.status', 'pending')
            ->missing('inviteLink')
            ->reloadOnly('inviteLink', fn (Assert $reload) => $reload
                ->where('inviteLink.url', route('inviteLinks.show', 'page-token-0123456789abcdefghijklmnopqrstu'))
                ->where('inviteLink.usesCount', 3)
                ->missing('inviteLink.maxUses')));

    $this->actingAs(teamFacilitator($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('canInvite', true)->has('pendingInvitations', 2));

    $this->actingAs(teamMember($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('canInvite', false)->where('pendingInvitations', []));
});

it('gives Members & rituals the link and the pending invitations of the team to its inviters, facilitators included', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    TeamInviteLink::factory()->for($team)->joinedBy(2)->create();
    WorkspaceInvitation::factory()->forTeam($team)->create(['email' => 'b@example.com']);
    $route = route('teams.members.index', [$team->workspace, $team]);

    foreach ([teamInviter($team), teamFacilitator($team)] as $inviter) {
        $this->actingAs($inviter)->get($route)
            ->assertInertia(fn (Assert $page) => $page
                ->component('teams/members')
                ->where('canInvite', true)
                ->where('inviteRoles', ['facilitator', 'member', 'observer'])
                ->where('pendingInvitations.0.email', 'b@example.com')
                ->where('team.slug', $team->slug)
                ->has('team.color')
                ->missing('inviteLink')
                ->reloadOnly('inviteLink', fn (Assert $reload) => $reload->where('inviteLink.usesCount', 2)));
    }
});
