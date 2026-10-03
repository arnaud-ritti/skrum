<?php

use App\Enums\TeamRole;
use App\Models\Team;
use Tests\Concurrency\Support\Race;

it('keeps one whole list when two people save it at the same moment (the team row lock)', function () {
    $team = Team::factory()->create();
    $ownerId = teamMember($team, TeamRole::Owner)->id;
    $a = teamMember($team, TeamRole::Facilitator)->id;
    $b = teamMember($team, TeamRole::Facilitator)->id;
    $uri = route('teams.facilitators.update', [$team->workspace, $team], false);

    $results = Race::run([
        static fn (): int => Race::request($ownerId, 'PUT', $uri, ['user_ids' => [$a, $b], 'rotation' => true]),
        static fn (): int => Race::request($ownerId, 'PUT', $uri, ['user_ids' => [$b, $a], 'rotation' => true]),
    ]);

    $positions = $team->defaultFacilitators()->get()->map(fn ($user): int => (int) $user->pivot->position)->all();

    expect(array_column($results, 'value'))->toEqual([302, 302])
        ->and($positions)->toBe([0, 1])
        ->and($team->defaultFacilitators()->count())->toBe(2);
});
