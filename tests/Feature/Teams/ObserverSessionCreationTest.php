<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\TeamRole;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;

it('refuses an observer of the team the creation of a session of each kind', function (string $routeName, array $body, string $model) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team, TeamRole::Observer))
        ->post(route($routeName, [$team->workspace, $team]), $body)
        ->assertForbidden();

    expect($model::query()->count())->toBe(0);
})->with([
    'retro' => ['teams.retros.store', ['title' => 'Sprint 42 retro', 'template' => 'start_stop_continue'], Retro::class],
    'poker game' => ['teams.pokerGames.store', ['title' => 'Refinement', 'deck' => 'fibonacci'], PokerGame::class],
    'whiteboard' => ['teams.whiteboards.store', ['title' => 'Map'], Whiteboard::class],
    'icebreaker room' => ['teams.games.store', ['name' => 'Friday', 'game' => GameKind::DrawAndGuess->value, 'access' => GameRoomAccess::Team->value], GameRoom::class],
    'poll' => ['teams.surveys.store', ['title' => 'Team pulse — sprint 42'], TeamSurvey::class],
]);

it('lets a manager whose team row says observer create a retro', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $team->members()->attach($manager, ['role' => TeamRole::Observer->value]);

    $this->actingAs($manager)
        ->post(route('teams.retros.store', [$team->workspace, $team]), ['title' => 'Sprint 42 retro', 'template' => 'start_stop_continue'])
        ->assertRedirect();

    expect(Retro::query()->sole()->title)->toBe('Sprint 42 retro');
});
