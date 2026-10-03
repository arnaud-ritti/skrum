<?php

use App\Actions\Teams\AccessRequestRecipients;
use App\Enums\TeamRole;
use App\Models\Team;

it('sends an access request to the workspace admins and the team owners only', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $owner = teamMember($team, TeamRole::Owner);
    teamMember($team, TeamRole::Facilitator);
    teamMember($team);
    teamMember($team, TeamRole::Observer);
    teamMember(Team::factory()->for($team->workspace)->create(), TeamRole::Owner);

    $ids = resolve(AccessRequestRecipients::class)->for($team)->pluck('id')->sort()->values()->all();

    expect($ids)->toBe(collect([$admin->id, $owner->id])->sort()->values()->all());
});
