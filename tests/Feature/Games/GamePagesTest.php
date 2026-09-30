<?php

use App\Enums\GameKind;
use App\Models\GameRoom;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\FakeGameRules;

it('renders the games pages', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman));
    $team = Team::factory()->create();
    $user = teamMember($team);
    $room = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id]);

    $this->actingAs($user)
        ->get(route('teams.games.index', ['workspace' => $team->workspace->slug, 'team' => $team->id]))
        ->assertInertia(fn (Assert $page) => $page->component('games/index'));

    $this->actingAs($user)
        ->get(route('games.show', $room))
        ->assertInertia(fn (Assert $page) => $page->component('games/show'));

    app('auth')->forgetGuards();

    $this->get(route('games.join.show', $room->guest_token))
        ->assertInertia(fn (Assert $page) => $page->component('games/join'));
});

it('links the team page to its games', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertOk();

    expect(file_get_contents(resource_path('js/pages/teams/show.tsx')))->toContain('TeamGameRoomsController.index');
});
