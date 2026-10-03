<?php

use App\Enums\TeamRole;
use App\Models\Team;
use Tests\Concurrency\Support\Race;

it('creates one sprint when two people start the next sprint at the same moment (the team row lock)', function () {
    $team = Team::factory()->create();
    teamSprint($team, 42, now()->subDays(9)->toDateString(), now()->addDays(4)->toDateString());
    $ownerId = teamMember($team, TeamRole::Owner)->id;
    $facilitatorId = teamMember($team, TeamRole::Facilitator)->id;
    $uri = route('teams.sprintStarts.store', [$team->workspace, $team], false);

    $results = Race::run([
        static fn (): int => Race::request($ownerId, 'POST', $uri),
        static fn (): int => Race::request($facilitatorId, 'POST', $uri),
    ]);

    expect(array_count_values(array_column($results, 'value')))->toEqual([302 => 1, 422 => 1])
        ->and($team->sprints()->pluck('number')->all())->toBe([42, 43])
        ->and($team->sprints()->where('number', 42)->sole()->ends_on->toDateString())->toBe(now()->subDay()->toDateString());
});
