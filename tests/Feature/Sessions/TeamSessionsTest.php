<?php

use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the live sessions of the team by default', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 42 retro']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Old retro']);

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/sessions')
            ->where('tab', 'live')
            ->where('total', 1)
            ->where('nextCursor', null)
            ->where('sessions.0.title', 'Sprint 42 retro')
            ->where('team.id', $team->id)
            ->has('canCreatePokerGame'));
});

it('opens the tab named in the query and pages with before', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->count(21)->create();

    $first = $this->actingAs($member)->get(route('teams.sessions.index', [$team->workspace, $team, 'tab' => 'finished']));
    $cursor = $first->viewData('page')['props']['nextCursor'];

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'tab' => 'finished', 'before' => $cursor]))
        ->assertInertia(fn (Assert $page) => $page->where('tab', 'finished')->has('sessions', 1)->where('total', 21));
});

it('refuses an unknown tab and an outsider', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'tab' => 'scheduled']))
        ->assertSessionHasErrors('tab');

    $this->actingAs(User::factory()->create())
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->assertForbidden();
});

it('ignores a malformed cursor and starts from the first page', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->started()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'before' => 'nonsense']))
        ->assertInertia(fn (Assert $page) => $page->has('sessions', 1));
});
