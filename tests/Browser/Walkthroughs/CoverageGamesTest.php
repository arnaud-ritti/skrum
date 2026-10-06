<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{room: GameRoom, ada: User}
 */
function cvgRoom(array $attributes = []): array
{
    $team = Team::factory()->create(['name' => 'Atlas']);
    $room = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Lunch', 'game' => GameKind::Hangman, ...$attributes]);
    [$ada] = gameRoomHost($room);
    $ada->forceFill(['name' => 'Ada Host', 'locale' => 'en'])->save();
    $room->forceFill(['created_by_user_id' => $ada->id])->save();

    return ['room' => $room->fresh(), 'ada' => $ada];
}

function cvgStranger(): User
{
    $stranger = User::factory()->create(['name' => 'Sam Stranger', 'locale' => 'en']);
    Workspace::factory()->withMember($stranger, WorkspaceRole::Owner)->create();

    return $stranger;
}

it('refuses a room to a workspace member outside its team and to someone of another workspace, and sends a visitor to the login', function () {
    ['room' => $room] = cvgRoom();
    $roomPath = route('games.show', $room, false);

    $this->signIn(workspaceOutsider($room->team), $roomPath)
        ->assertPresent(forbiddenPage())
        ->assertNotPresent('[data-slot="hangman-board"]')
        ->assertDontSee('Lunch');

    $this->signIn(cvgStranger(), $roomPath)
        ->assertPresent(forbiddenPage())
        ->assertDontSee('Lunch');

    visit($roomPath)->assertPathIs('/login');
});

it('tells a visitor without a guest cookie of a link room that the session has ended', function () {
    ['room' => $room] = cvgRoom(['access' => GameRoomAccess::Link]);

    visit(route('games.show', $room, false))
        ->assertSee('Your session has ended.')
        ->assertSee('Guests: ask the facilitator for the guest link.')
        ->assertNotPresent('[data-slot="hangman-board"]');
});

it('shows an observer of the team a round in play read only, with the observer line and no letters, no word field and no Start', function () {
    ['room' => $room, 'ada' => $ada] = cvgRoom();
    $olga = renamedUser(teamMember($room->team, TeamRole::Observer), 'Olga Observer');
    activeGameRound($room, ['word' => 'sprint', 'leader_player_id' => null]);

    $host = $this->awaitRealtime($this->signIn($ada, route('games.show', $room, false)));
    $observer = $this->awaitRealtime($this->signIn($olga, route('games.show', $room, false)));

    $observer->assertSeeIn('[data-slot="observer-notice"]', 'You are observing this session.')
        ->assertPresent('[data-slot="hangman-board"]')
        ->assertNotPresent('[role="group"][aria-label="Letters"]')
        ->assertNotPresent('[data-slot="hangman-word-guess"]')
        ->assertNotPresent('[data-slot="game-settings-card"]')
        ->assertDontSee('Give up');

    $host->assertPresent('[role="group"][aria-label="Letters"]')
        ->assertNotPresent('[data-slot="observer-notice"]');
});

it('refuses the team games page to a workspace member outside the team and to someone of another workspace, sends a visitor to the login, and offers an observer no "New session"', function () {
    ['room' => $room, 'ada' => $ada] = cvgRoom();
    $team = $room->team;
    $olga = renamedUser(teamMember($team, TeamRole::Observer), 'Olga Observer');

    $this->signIn(workspaceOutsider($team), teamPath('teams.games.index', $team))
        ->assertPresent(forbiddenPage())
        ->assertNotPresent('[data-slot="team-games"]');

    $this->signIn(cvgStranger(), teamPath('teams.games.index', $team))
        ->assertPresent(forbiddenPage())
        ->assertNotPresent('[data-slot="team-games"]');

    visit(teamPath('teams.games.index', $team))->assertPathIs('/login');

    $this->signIn($olga, teamPath('teams.games.index', $team))
        ->assertPresent('[data-slot="team-games"] [data-slot="leaderboard"]')
        ->assertNotPresent('[data-sidebar="header"] a:has-text("New session")');

    $this->signIn($ada, teamPath('teams.games.index', $team))
        ->assertPresent('[data-sidebar="header"] a:has-text("New session")');
});

it('sends a team member who opens the guest link straight to the room, and the room of an icebreaker to its retro', function () {
    ['room' => $room, 'ada' => $ada] = cvgRoom(['access' => GameRoomAccess::Link]);
    $retro = Retro::factory()->for($room->team)->inPhase(RetroPhase::Icebreaker)->create(['title' => 'Sprint 42 retro']);
    [$facilitator] = retroFacilitator($retro);
    $icebreakerRoom = GameRoom::factory()->icebreaker($retro)->create();

    $this->signIn($ada, route('games.join.show', $room->guest_token, false))
        ->assertPathIs(route('games.show', $room, false))
        ->assertSeeIn('header:has(h1) h1', 'Lunch');

    $this->signIn($facilitator, route('games.show', $icebreakerRoom, false))
        ->assertPathIs(route('retros.show', $retro, false));
});
