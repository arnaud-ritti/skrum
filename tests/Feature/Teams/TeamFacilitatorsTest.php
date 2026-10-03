<?php

use App\Actions\Teams\PresentNewSessionOptions;
use App\Enums\TeamRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;

/**
 * @return array{0: Team, 1: User, 2: User}
 */
function rotatingTeam(): array
{
    $team = Team::factory()->create();
    $camille = teamMember($team, TeamRole::Facilitator);
    $ines = teamMember($team, TeamRole::Owner);

    test()->actingAs($ines)
        ->put(route('teams.facilitators.update', [$team->workspace, $team]), ['user_ids' => [$camille->id, $ines->id], 'rotation' => true])
        ->assertRedirect();

    return [$team->fresh(), $camille, $ines];
}

function createRetroAs(Team $team, User $user, string $title, ?User $facilitator = null): Retro
{
    test()->actingAs($user)
        ->post(route('teams.retros.store', [$team->workspace, $team]), array_filter([
            'title' => $title,
            'template' => 'start_stop_continue',
            'facilitator_user_id' => $facilitator?->id,
        ]))
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    return Retro::query()->where('team_id', $team->id)->where('title', $title)->with('facilitator')->firstOrFail();
}

function suggestedFor(Team $team, User $viewer): ?string
{
    return resolve(PresentNewSessionOptions::class)->handle($viewer, $team->workspace, $team->fresh())['suggestedFacilitatorId'];
}

it('saves the list in order with the rotation', function () {
    [$team, $camille, $ines] = rotatingTeam();

    expect($team->defaultFacilitators()->pluck('users.id')->all())->toBe([$camille->id, $ines->id])
        ->and($team->facilitator_rotation_enabled)->toBeTrue();
});

it('suggests the next person of the rotation and moves on only when the suggestion is followed', function () {
    [$team, $camille, $ines] = rotatingTeam();
    $creator = teamMember($team);

    expect(suggestedFor($team, $creator))->toBe($camille->id)
        ->and(createRetroAs($team, $creator, 'One', $camille)->facilitator->user_id)->toBe($camille->id)
        ->and(suggestedFor($team, $creator))->toBe($ines->id)
        ->and(createRetroAs($team, $creator, 'Two', $creator)->facilitator->user_id)->toBe($creator->id)
        ->and(suggestedFor($team, $creator))->toBe($ines->id)
        ->and($team->fresh()->rotation_position)->toBe(1);
});

it('suggests the first of the list without the rotation, and nobody with an empty list', function () {
    [$team, $camille] = rotatingTeam();
    $creator = teamMember($team);
    $team->update(['facilitator_rotation_enabled' => false]);

    expect(suggestedFor($team, $creator))->toBe($camille->id);

    $team->defaultFacilitators()->detach();

    expect(suggestedFor($team, $creator))->toBeNull();
});

it('lets the creator facilitate when nobody is chosen, and never assigns the suggestion', function () {
    [$team] = rotatingTeam();
    $creator = teamMember($team);

    expect(createRetroAs($team, $creator, 'Mine')->facilitator->user_id)->toBe($creator->id)
        ->and($team->fresh()->rotation_position)->toBe(0);
});

it('refuses as facilitator an observer and someone outside the team', function (Closure $who) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.retros.store', [$team->workspace, $team]), ['title' => 'X', 'template' => 'start_stop_continue', 'facilitator_user_id' => $who($team)->id])
        ->assertSessionHasErrors('facilitator_user_id');

    expect(Retro::query()->count())->toBe(0);
})->with([
    'an observer' => [fn (Team $team): User => teamMember($team, TeamRole::Observer)],
    'an outsider' => [fn (Team $team): User => teamMember(Team::factory()->for($team->workspace)->create())],
]);

it('lists in the dialog the members who take part, without observers', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $observer = teamMember($team, TeamRole::Observer);
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin, ['role' => TeamRole::Observer->value]);

    $ids = collect(resolve(PresentNewSessionOptions::class)->handle($member, $team->workspace, $team)['retroFacilitators'])->pluck('id');

    expect($ids)->toContain($member->id)->toContain($admin->id)->not->toContain($observer->id);
});

it('refuses a member, an observer, duplicates, more than ten people and a rotation without anyone', function (Closure $body, string $field) {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);

    $this->actingAs($owner)
        ->put(route('teams.facilitators.update', [$team->workspace, $team]), $body($team, $owner))
        ->assertSessionHasErrors($field);
})->with([
    'a member' => [fn (Team $team): array => ['user_ids' => [teamMember($team)->id], 'rotation' => false], 'user_ids'],
    'an observer' => [fn (Team $team): array => ['user_ids' => [teamMember($team, TeamRole::Observer)->id], 'rotation' => false], 'user_ids'],
    'a duplicate' => [fn (Team $team, User $owner): array => ['user_ids' => [$owner->id, $owner->id], 'rotation' => false], 'user_ids.0'],
    'eleven people' => [fn (Team $team): array => ['user_ids' => collect(range(1, 11))->map(fn (): string => teamMember($team, TeamRole::Facilitator)->id)->all(), 'rotation' => false], 'user_ids'],
    'a rotation without anyone' => [fn (): array => ['user_ids' => [], 'rotation' => true], 'rotation'],
]);

it('refuses the list to a member', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->put(route('teams.facilitators.update', [$team->workspace, $team]), ['user_ids' => [], 'rotation' => false])
        ->assertForbidden();
});

it('takes a person out of the list when they become a member or leave the team', function () {
    [$team, $camille, $ines] = rotatingTeam();

    $this->actingAs($ines)->put(route('teams.members.role.update', [$team->workspace, $team, $camille]), ['role' => 'member'])->assertRedirect();

    expect($team->defaultFacilitators()->pluck('users.id')->all())->toBe([$ines->id])
        ->and($team->fresh()->rotation_position)->toBe(0);

    $this->actingAs(workspaceManager($team->workspace))->delete(route('teams.members.destroy', [$team->workspace, $team, $ines]))->assertRedirect();

    expect($team->defaultFacilitators()->count())->toBe(0);
});

it('starts the rotation over when a person on the list leaves the team or the workspace', function (string $leaves) {
    $team = Team::factory()->create();
    $camille = teamMember($team, TeamRole::Facilitator);
    $ines = teamMember($team, TeamRole::Owner);
    $noor = teamMember($team, TeamRole::Facilitator);
    $admin = workspaceManager($team->workspace);

    $this->actingAs($ines)
        ->put(route('teams.facilitators.update', [$team->workspace, $team]), ['user_ids' => [$camille->id, $ines->id, $noor->id], 'rotation' => true])
        ->assertRedirect();

    $team->update(['rotation_position' => 1]);

    $route = $leaves === 'team'
        ? route('teams.members.destroy', [$team->workspace, $team, $camille])
        : route('workspaces.members.destroy', [$team->workspace, $camille]);

    $this->actingAs($admin)->delete($route)->assertRedirect();

    expect($team->defaultFacilitators()->pluck('users.id')->all())->toBe([$ines->id, $noor->id])
        ->and($team->fresh()->rotation_position)->toBe(0);
})->with(['team', 'workspace']);
