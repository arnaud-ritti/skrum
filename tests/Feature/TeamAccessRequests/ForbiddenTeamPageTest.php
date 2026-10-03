<?php

use App\Enums\WorkspaceRole;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use Inertia\Testing\AssertableInertia as Assert;

function outsiderOf(Team $team): User
{
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);

    return $user;
}

it('offers access to the team behind every denied page of a workspace member', function (Closure $url) {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $manager = workspaceManager($team->workspace);
    $manager->update(['name' => 'Camille Roux']);

    $this->actingAs(outsiderOf($team))->get($url($team))
        ->assertForbidden()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('accessRequest.team.name', 'Atlas')
            ->where('accessRequest.managers.0.name', 'Camille Roux')
            ->where('accessRequest.pending', false)
            ->where('accessRequest.storeUrl', route('teams.accessRequests.store', [$team->workspace, $team])));
})->with([
    'team page' => [fn (Team $team) => route('teams.show', [$team->workspace, $team])],
    'retro' => [fn (Team $team) => route('retros.show', Retro::factory()->for($team)->create())],
    'poker' => [fn (Team $team) => route('poker.show', PokerGame::factory()->for($team)->create())],
    'whiteboard' => [fn (Team $team) => route('whiteboards.show', Whiteboard::factory()->for($team)->create())],
    'survey' => [fn (Team $team) => route('surveys.show', TeamSurvey::factory()->for($team)->create())],
    'game room' => [fn (Team $team) => route('games.show', GameRoom::factory()->for($team)->create())],
]);

it('opens in the sent state when a request is pending', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    $this->actingAs($request->user)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('accessRequest.pending', true));
});

it('names no team and nobody to a stranger to the workspace', function () {
    $team = Team::factory()->create(['name' => 'Secret team']);
    $retro = Retro::factory()->for($team)->create();

    foreach ([route('teams.show', [$team->workspace, $team]), route('retros.show', $retro)] as $url) {
        $response = $this->actingAs(User::factory()->create())->get($url)->assertForbidden();

        $response->assertInertia(fn (Assert $page) => $page->missing('accessRequest'));
        expect($response->getContent())->not->toContain('Secret team');
    }
});

it('offers nothing on a 403 that is not about a team', function () {
    config(['skrum.signup_mode' => 'invite']);
    User::factory()->create();

    $this->get(route('register'))->assertForbidden()->assertInertia(fn (Assert $page) => $page->missing('accessRequest'));
});
