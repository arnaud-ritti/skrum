<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;

it('gives a member added without a role the member role', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);

    $team->members()->attach($user);

    expect($team->roleOf($user))->toBe(TeamRole::Member)
        ->and($team->members()->first()->teamMembership->role)->toBe(TeamRole::Member);
});

it('reads the role of a member, and none for someone outside the team', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);

    expect($team->roleOf($facilitator))->toBe(TeamRole::Facilitator)
        ->and($team->roleOf(User::factory()->create()))->toBeNull();
});

it('says what each role may do', function (TeamRole $role, bool $managesTeam, bool $managesRituals, bool $isObserver) {
    $team = Team::factory()->create();
    $user = teamMember($team, $role);

    expect($user->managesTeam($team))->toBe($managesTeam)
        ->and($user->managesRitualsOf($team))->toBe($managesRituals)
        ->and($user->isObserverOf($team))->toBe($isObserver)
        ->and($role->contributes())->toBe(! $isObserver);
})->with([
    'owner' => [TeamRole::Owner, true, true, false],
    'facilitator' => [TeamRole::Facilitator, false, true, false],
    'member' => [TeamRole::Member, false, false, false],
    'observer' => [TeamRole::Observer, false, false, true],
]);

it('never restricts a workspace manager, whatever their team row says', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin, ['role' => TeamRole::Observer->value]);

    expect($admin->isObserverOf($team))->toBeFalse()
        ->and($admin->managesTeam($team))->toBeTrue()
        ->and($admin->managesRitualsOf($team))->toBeTrue();
});

it('lists the four roles in order, labelled', function () {
    expect(array_column(TeamRole::options(), 'value'))->toBe(['owner', 'facilitator', 'member', 'observer'])
        ->and(TeamRole::options()[1]['label'])->toBe('Facilitator');
});
