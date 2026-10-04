<?php

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\WorkspaceInvitation;
use Inertia\Testing\AssertableInertia as Assert;

it('lists each invitation with its team and status, and offers the teams to invite to', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $manager = workspaceManager($team->workspace);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Observer)->declined()->create(['email' => 'a@example.com']);
    WorkspaceInvitation::factory()->for($team->workspace)->expired()->create(['email' => 'b@example.com']);

    $this->actingAs($manager)
        ->get(route('workspaces.members.index', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('teams', [['id' => $team->id, 'name' => 'Atlas']])
            ->where('teamRoles', ['facilitator', 'member', 'observer'])
            ->where('invitations', fn ($invitations) => collect($invitations)->keyBy('email')->map(fn ($row) => [$row['status'], $row['team']['name'] ?? null, $row['teamRole']])->all() === [
                'a@example.com' => ['declined', 'Atlas', 'observer'],
                'b@example.com' => ['expired', null, null],
            ]));
});
