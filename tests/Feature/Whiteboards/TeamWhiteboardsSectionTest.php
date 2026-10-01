<?php

use App\Models\Team;
use App\Models\Whiteboard;
use Inertia\Testing\AssertableInertia as Assert;

it('lists the team boards, most recently changed first', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->travelTo(now()->subDay());
    $older = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'Older']);
    $this->travelBack();

    $newer = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'Newer']);
    [$facilitator] = whiteboardFacilitator($newer);
    Whiteboard::factory()->create();

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/show')
            ->where('canCreateWhiteboard', true)
            ->has('whiteboards', 2)
            ->where('whiteboards.0.id', $newer->id)
            ->where('whiteboards.0.title', 'Newer')
            ->where('whiteboards.0.facilitatorName', $facilitator->name)
            ->where('whiteboards.0.updatedAt', $newer->updated_at->toIso8601String())
            ->where('whiteboards.1.id', $older->id)
            ->where('whiteboards.1.facilitatorName', null));
});
