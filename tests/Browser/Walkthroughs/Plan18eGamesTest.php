<?php

use App\Enums\GameKind;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Team;
use App\Models\User;

function p18eGamesMember(Team $team, string $name): User
{
    $user = teamMember($team);
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

function p18eGamesPlayer(GameRoom $room, User $user): GamePlayer
{
    return GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $user->id]);
}

function p18eGamesPath(Team $team): string
{
    return route('teams.games.index', [$team->workspace, $team], false);
}

function p18eGamesRoomNames(): string
{
    return "[...document.querySelectorAll('[data-slot=\"game-room\"] a')].map((link) => link.getAttribute('aria-label')).join(' | ')";
}

it('[P18e-06-01] shows the podium with a streak on a top-three player and marks the current user', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $room = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Friday fun', 'game' => GameKind::Hangman]);
    $players = [];

    foreach (['Ada', 'Bob', 'Cy', 'Di'] as $name) {
        $players[$name] = p18eGamesPlayer($room, p18eGamesMember($team, $name));
    }

    awardGamePoints($room, $players['Bob'], 5, true, ['created_at' => now()->subWeek()]);
    awardGamePoints($room, $players['Bob'], 4, false, ['created_at' => now()]);
    awardGamePoints($room, $players['Ada'], 6, false, ['created_at' => now()]);
    awardGamePoints($room, $players['Cy'], 3, false, ['created_at' => now()]);
    awardGamePoints($room, $players['Di'], 1, false, ['created_at' => now()]);

    $page = $this->signIn($players['Ada']->user, p18eGamesPath($team));

    $page->assertSeeIn('[data-slot="games-leaderboard"] h1', 'Games')
        ->assertSee('Short games to warm up Platform.')
        ->assertSeeIn('[data-slot="podium-place"][data-place="1"]', 'Bob')
        ->assertSeeIn('[data-slot="podium-place"][data-place="1"]', '2-week streak')
        ->assertSeeIn('[data-slot="podium-place"][data-place="1"] [data-slot="podium-points"]', '9')
        ->assertPresent('[data-slot="podium-place"][data-place="1"] [data-slot="podium-crown"]')
        ->assertSeeIn('[data-slot="podium-place"][data-place="2"][data-me]', 'Ada')
        ->assertDontSeeIn('[data-slot="podium-place"][data-place="2"]', 'streak')
        ->assertSeeIn('[data-slot="podium-place"][data-place="3"]', 'Cy')
        ->assertCount('[data-slot="podium-place"][data-me]', 1)
        ->assertSeeIn('[data-slot="leaderboard-row"]', 'Di')
        ->assertNotPresent('[data-slot="leaderboard-row"][data-me]')
        ->assertCount('[data-realtime]', 1);
});

it('[P18e-06-02] lists the rooms as links, a room in play first, then the latest changed', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $ada = p18eGamesMember($team, 'Ada');
    $old = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Old room', 'game' => GameKind::Hangman, 'updated_at' => now()->subDays(2)]);
    $playing = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id, 'name' => 'In play', 'game' => GameKind::DrawAndGuess, 'updated_at' => now()->subDay()]);
    GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'New room here', 'game' => GameKind::Decoded, 'updated_at' => now()]);
    p18eGamesPlayer($playing, $ada);
    activeGameRound($playing);

    $page = $this->signIn($ada, p18eGamesPath($team));

    $page->assertScript(p18eGamesRoomNames(), 'In play, Draw & Guess, Live, 1 player | New room here, Decoded, Waiting for players, 0 players | Old room, Hangman, Waiting for players, 0 players')
        ->assertSeeIn("a[href$=\"/games/{$playing->id}\"]", 'Open by link')
        ->assertSeeIn("a[href$=\"/games/{$old->id}\"]", 'Team only')
        ->assertSeeIn("a[href$=\"/games/{$old->id}\"]", '0 rounds')
        ->click("a[href$=\"/games/{$old->id}\"]")
        ->assertPathIs("/games/{$old->id}");
});

it('[P18e-06-07] shows a room with a round in play as live with its players and when it started, and a room without a round as waiting', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $ada = p18eGamesMember($team, 'Ada');
    $playing = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Daily warm-up', 'game' => GameKind::Hangman]);
    $waiting = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Sprint kick-off', 'game' => GameKind::Hangman, 'updated_at' => now()->subDay()]);
    p18eGamesPlayer($playing, $ada);

    foreach (['Bob', 'Cy', 'Di', 'Ed', 'Flo', 'Gus'] as $name) {
        p18eGamesPlayer($playing, p18eGamesMember($team, $name));
    }

    activeGameRound($playing, ['started_at' => now()->subMinutes(4)]);

    $page = $this->signIn($ada, p18eGamesPath($team));
    $live = "a[href$=\"/games/{$playing->id}\"]";
    $idle = "a[href$=\"/games/{$waiting->id}\"]";

    $page->assertSeeIn("{$live} [data-status=\"live\"]", 'Live')
        ->assertSeeIn($live, 'started 4 min ago')
        ->assertSeeIn($live, '7 players')
        ->assertCount("{$live} [data-slot=\"avatar-stack\"] [data-slot=\"person-avatar\"]", 3)
        ->assertSeeIn("{$live} [data-slot=\"avatar-stack-more\"]", '+4')
        ->assertSeeIn("{$idle} [data-status=\"waiting\"]", 'Waiting for players')
        ->assertDontSeeIn($idle, 'started')
        ->assertNotPresent("{$idle} [data-slot=\"avatar-stack\"]")
        ->assertSeeIn('[data-slot="game-rooms"]', '1 live');
});

it('[P18e-06-11] shows a room created, renamed, started and deleted in one browser to the other without a reload', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $ada = p18eGamesMember($team, 'Ada');
    $bob = p18eGamesMember($team, 'Bob');
    $path = p18eGamesPath($team);

    $a = $this->awaitRealtime($this->signIn($ada, $path));
    $b = $this->awaitRealtime($this->signIn($bob, $path));

    $b->assertSee('No game rooms yet.');
    $b->script('() => { window.p18eStayed = true; }');

    $a->click('[data-slot="games-leaderboard"] > div:first-child button:has-text("New room")')
        ->assertVisible('#new-room-name')
        ->fill('#new-room-name', 'Lunch')
        ->click('#new-room-game')
        ->click('[role="option"]:has-text("Hangman")')
        ->assertSeeIn('#new-room-game', 'Hangman')
        ->click('Create room')
        ->assertPathBeginsWith('/games/');

    $room = GameRoom::query()->sole();
    $link = "a[href$=\"/games/{$room->id}\"]";

    $b->assertScript(p18eGamesRoomNames(), 'Lunch, Hangman, Waiting for players, 1 player')
        ->assertDontSee('No game rooms yet.');

    $this->awaitRealtime($a)
        ->click('[aria-label="Room menu"]')
        ->click('[role="menuitem"]:has-text("Room settings")')
        ->fill('#room-name', 'Lunch break')
        ->click('Save')
        ->assertNotPresent('[role="dialog"]');

    $b->assertScript(p18eGamesRoomNames(), 'Lunch break, Hangman, Waiting for players, 1 player');

    $a->click('Start');

    $b->assertSeeIn("{$link} [data-status=\"live\"]", 'Live')
        ->assertSeeIn($link, 'started just now')
        ->assertSeeIn('[data-slot="game-rooms"]', '1 live');

    $a->click('[aria-label="Room menu"]')
        ->click('[role="menuitem"]:has-text("Delete room")')
        ->click('[role="dialog"] button:has-text("Delete")');

    $b->assertNotPresent($link)
        ->assertSee('No game rooms yet.')
        ->assertScript('window.p18eStayed === true', true);
});
