<?php

use App\Enums\TeamRole;
use App\Models\Retro;
use App\Models\Team;
use Tests\Concurrency\Support\Race;

it('moves the rotation once when two retros follow the same suggestion at the same moment (the team row lock)', function () {
    $team = Team::factory()->create(['facilitator_rotation_enabled' => true]);
    $camille = teamMember($team, TeamRole::Facilitator);
    $ines = teamMember($team, TeamRole::Facilitator);
    $team->defaultFacilitators()->attach([$camille->id => ['position' => 0], $ines->id => ['position' => 1]]);
    $creatorId = teamMember($team)->id;
    $camilleId = $camille->id;
    $uri = route('teams.retros.store', [$team->workspace, $team], false);

    $results = Race::run([
        static fn (): int => Race::request($creatorId, 'POST', $uri, ['title' => 'One', 'template' => 'start_stop_continue', 'facilitator_user_id' => $camilleId]),
        static fn (): int => Race::request($creatorId, 'POST', $uri, ['title' => 'Two', 'template' => 'start_stop_continue', 'facilitator_user_id' => $camilleId]),
    ]);

    $facilitators = Retro::query()->where('team_id', $team->id)->with('facilitator')->get()
        ->map(fn (Retro $retro): string => (string) $retro->facilitator?->user_id)
        ->all();

    expect(array_column($results, 'value'))->toEqual([302, 302])
        ->and($facilitators)->toEqual([$camilleId, $camilleId])
        ->and($team->fresh()->rotation_position)->toBe(1);
});
