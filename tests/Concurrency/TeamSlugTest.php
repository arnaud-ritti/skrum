<?php

use App\Actions\Teams\CreateTeam;
use App\Models\Workspace;
use Tests\Concurrency\Support\Race;

it('creates both teams when two of one name are created at the same instant in one workspace', function () {
    $workspaceId = Workspace::factory()->create()->id;

    $outcomes = Race::run(array_fill(0, 2, static fn (): string => resolve(CreateTeam::class)
        ->handle(Workspace::query()->findOrFail($workspaceId), ['name' => 'Atlas'])->slug));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(Workspace::query()->findOrFail($workspaceId)->teams()->pluck('slug')->sort()->values()->all())->toBe(['atlas', 'atlas-2']);
});
