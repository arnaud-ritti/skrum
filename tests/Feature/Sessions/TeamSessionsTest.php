<?php

use App\Enums\RetroPhase;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSprint;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows live sessions apart, the rest below, and the counts by kind', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 42 retro']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Old retro']);

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/sessions')
            ->where('kind', null)
            ->has('live', 1)
            ->where('live.0.title', 'Sprint 42 retro')
            ->has('sessions', 1)
            ->where('sessions.0.title', 'Old retro')
            ->where('counts.all', 2)
            ->where('counts.retro', 2)
            ->where('total', 1)
            ->where('nextCursor', null)
            ->where('hasSprints', false)
            ->where('team.id', $team->id)
            ->missing('tab')
            ->has('canCreatePokerGame'));
});

it('filters on a kind, refuses an unknown one, and ignores the tab of an old link', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create();
    PokerGame::factory()->for($team)->ended()->create(['title' => 'Planning']);

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'poker']))
        ->assertInertia(fn (Assert $page) => $page->where('kind', 'poker')->has('sessions', 1)->where('sessions.0.title', 'Planning')->where('counts.all', 2));

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'meeting']))
        ->assertSessionHasErrors('kind');

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'tab' => 'finished']))
        ->assertOk()
        ->assertSessionHasNoErrors()
        ->assertInertia(fn (Assert $page) => $page->has('sessions', 2));
});

it('says whether the team has sprints', function () {
    $team = Team::factory()->create();
    TeamSprint::factory()->for($team)->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('hasSprints', true));
});

it('pages the sessions that are not live with before', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->count(21)->create();

    $first = $this->actingAs($member)->get(route('teams.sessions.index', [$team->workspace, $team]));
    $cursor = $first->viewData('page')['props']['nextCursor'];

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'before' => $cursor]))
        ->assertInertia(fn (Assert $page) => $page->has('sessions', 1)->where('total', 21)->where('nextCursor', null));
});

it('merges each next page into the sessions already loaded, so the history keeps every row', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->started()->create();

    $page = $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->viewData('page');

    expect($page['mergeProps'])->toBe(['sessions'])
        ->and($page['matchPropsOn'])->toBe(['sessions.id']);
});

it('ignores an unknown tab and refuses an outsider', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'tab' => 'scheduled']))
        ->assertOk()
        ->assertSessionHasNoErrors();

    $this->actingAs(User::factory()->create())
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->assertForbidden();
});

it('ignores a malformed cursor and starts from the first page', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'before' => 'nonsense']))
        ->assertInertia(fn (Assert $page) => $page->has('sessions', 1));
});

it('searches the sessions, live or not, by their title and gives the search back', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 42 retro']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Release review']);
    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 43 retro']);
    Retro::factory()->for($team)->started()->create(['title' => 'Release party']);

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'q' => '  sprint ']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('q', 'sprint')
            ->where('total', 1)
            ->where('sessions.0.title', 'Sprint 42 retro')
            ->has('live', 1)
            ->where('live.0.title', 'Sprint 43 retro')
            ->where('counts.all', 2));

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('q', null)->where('total', 2));
});

it('refuses a search longer than a title', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'q' => str_repeat('a', 256)]))
        ->assertSessionHasErrors('q');
});
