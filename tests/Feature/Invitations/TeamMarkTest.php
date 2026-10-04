<?php

use App\Enums\ColumnColor;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Teams\TeamMark;

it('derives the colour of an id as lib/mark-color.ts does', function (string $id, ColumnColor $expected) {
    expect(TeamMark::derived($id))->toBe($expected);
})->with([
    ['00000000-0000-0000-0000-000000000000', ColumnColor::Apricot],
    ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', ColumnColor::Iris],
    ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c', ColumnColor::Moss],
    ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e', ColumnColor::Sky],
    ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60', ColumnColor::Lagoon],
]);

it('prefers the colour the team chose', function () {
    $team = Team::factory()->create(['color' => ColumnColor::Plum])->fresh();

    expect($team->color)->toBe(ColumnColor::Plum)
        ->and(TeamMark::colorFor($team))->toBe(ColumnColor::Plum);
});

it('keeps an existing team without a colour on its derived one', function () {
    $team = Team::factory()->create()->fresh();

    expect($team->color)->toBeNull()
        ->and(TeamMark::colorFor($team))->toBe(TeamMark::derived($team->id));
});

it('stores the default language of a workspace', function () {
    expect(Workspace::factory()->create(['locale' => 'de'])->fresh()->locale)->toBe('de')
        ->and(Workspace::factory()->create()->fresh()->locale)->toBeNull();
});
