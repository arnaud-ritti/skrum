<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
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
        ->click('[role="alertdialog"] button:has-text("Delete")');

    $b->assertNotPresent($link)
        ->assertSee('No game rooms yet.')
        ->assertScript('window.p18eStayed === true', true);
});

it('[P18e-06-03] shows the notice of an invalid guest link with HTTP 404', function () {
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Friday fun']);
    $path = route('games.join.show', $room->guest_token, false);

    $guest = visit($path);

    $guest->assertSeeIn('[data-slot="guest-join-session"]', 'Friday fun')
        ->assertVisible('#name');

    $room->update(['access' => GameRoomAccess::Team]);

    $guest->navigate($path)
        ->assertSee('Join a game')
        ->assertSee('This guest link is no longer valid.')
        ->assertNotPresent('#name')
        ->assertNotPresent('[data-slot="guest-join"]');

    expect((int) $guest->script('() => fetch(window.location.href).then((response) => response.status)'))->toBe(404);
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: GameRoom, 1: User}
 */
function p18eGamesRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Lunch', 'game' => GameKind::Hangman, ...$attributes]);
    [$ada] = gameRoomHost($room);

    $room->forceFill(['created_by_user_id' => $ada->id])->save();
    $ada->forceFill(['name' => 'Ada Host', 'locale' => 'en'])->save();

    return [$room, $ada];
}

function p18eGamesCard(string $game): string
{
    return "[role=\"radiogroup\"][aria-label=\"Choose an icebreaker\"] [role=\"radio\"]:has-text(\"{$game}\")";
}

function p18eGamesKey(string $letter): string
{
    return "[data-layout] button:has-text(\"{$letter}\")";
}

function p18eGamesRows(): string
{
    return "[...document.querySelectorAll('[data-layout] [data-slot=\"keyboard-row\"]')].map((row) => row.textContent).join(' ')";
}

/** True when the bottom of the first element is above the top of the second. */
function p18eGamesAbove(string $first, string $second): string
{
    return "document.querySelector('{$first}').getBoundingClientRect().bottom <= document.querySelector('{$second}').getBoundingClientRect().top";
}

function p18eGamesSignOutElsewhere(mixed $page): void
{
    $status = $page->script(<<<'JS'
        () => {
            const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN=')).slice('XSRF-TOKEN='.length);

            return fetch('/logout', {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) },
            }).then((response) => response.status);
        }
        JS);

    expect($status)->toBe(204);
}

it('[P18e-06-04] lets the host pick a game from the cards, shows a non-host its badge and says why a game is not available', function () {
    [$room, $ada] = p18eGamesRoom();

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertCount('[role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]', 4)
        ->assertAriaAttribute(p18eGamesCard('Hangman'), 'checked', 'true')
        ->assertAriaAttribute(p18eGamesCard('Sprint in one GIF'), 'disabled', 'true')
        ->assertSeeIn(p18eGamesCard('Sprint in one GIF'), 'Not available')
        ->assertSeeIn('header [data-slot="room-game"]', 'Hangman');

    $guest->assertNotPresent('[role="radiogroup"]')
        ->assertNotPresent('[data-slot="game-left"]')
        ->assertSeeIn('header [data-slot="room-game"]', 'Hangman');

    $host->click(p18eGamesCard('Decoded'))
        ->assertAriaAttribute(p18eGamesCard('Decoded'), 'checked', 'true')
        ->assertAriaAttribute(p18eGamesCard('Hangman'), 'checked', 'false')
        ->assertSeeIn('#game-stage-title', 'Decoded');

    $guest->assertSeeIn('header [data-slot="room-game"]', 'Decoded')
        ->assertSeeIn('#game-stage-title', 'Decoded');

    expect($room->fresh()->game)->toBe(GameKind::Decoded);
});

it('[P18e-06-05] lays the hangman keyboard out for the language of the player, plays at 390 pixels, and freezes under one banner when the session expires', function () {
    [$room, $ada] = p18eGamesRoom();
    $ada->forceFill(['locale' => 'fr'])->save();
    activeGameRound($room, ['word' => 'quartz']);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertScript(p18eGamesRows(), 'azertyuiop qsdfghjklm wxcvbn')
        ->assertCount('[data-realtime]', 1);
    $guest->assertScript(p18eGamesRows(), 'qwertyuiop asdfghjkl zxcvbnm')
        ->assertCount('[data-realtime]', 1);

    $host->resize(390, 844)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->assertNotPresent('[data-slot="game-right"]')
        ->assertVisible('[data-slot="player-chips"]')
        ->assertScript("[...document.querySelectorAll('[data-layout] button')].every((key) => key.getBoundingClientRect().height >= 44 && key.getBoundingClientRect().right <= window.innerWidth)", true)
        ->click(p18eGamesKey('q'))
        ->assertAttribute(p18eGamesKey('q'), 'data-state', 'hit')
        ->click(p18eGamesKey('x'))
        ->assertAttribute(p18eGamesKey('x'), 'data-state', 'miss')
        ->assertSeeIn('[data-slot="hangman-missed"]', 'X')
        ->click('[aria-label="Joueurs et scores"]')
        ->assertSeeIn('[role="dialog"] section[aria-labelledby="game-players"]', 'Visitor')
        ->assertSeeIn('[role="dialog"] ul[aria-label="Dernières lettres"]', 'X');

    $guest->assertAttribute(p18eGamesKey('q'), 'data-state', 'hit')
        ->assertAttribute(p18eGamesKey('x'), 'data-state', 'miss')
        ->assertSeeIn('ul[aria-label="Last letters"]', 'Ada Host picked X');

    $host->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    p18eGamesSignOutElsewhere($host);

    $host->click(p18eGamesKey('u'))
        ->assertCount('[data-slot="connection-state"][data-status="expired"]', 1)
        ->assertScript("document.querySelector('[data-realtime] > div[inert]') !== null", true)
        ->assertCount('[data-realtime]', 1)
        ->assertNotPresent('[data-sonner-toast]');
});

it('[P18e-06-08] flies a reaction of a guest on the screen of the host, never over the keyboard, and takes the bar away for both when the host turns reactions off', function () {
    [$room, $ada] = p18eGamesRoom();
    activeGameRound($room, ['word' => 'quartz']);
    $bar = '[role="toolbar"][aria-label="Reactions"]';
    $keyboard = '[role="group"][aria-label="Letters"]';

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    foreach ([$host, $guest] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertVisible($bar);
    }

    $guest->click('[aria-label="Send a reaction ❤️"]');

    $host->assertSeeIn('.lr-overlay', '❤️')
        ->assertSeeIn('.lr-overlay', 'Visitor');

    foreach ([[1440, 900], [390, 844]] as [$width, $height]) {
        $host->resize($width, $height)
            ->assertVisible($bar)
            ->assertScript(p18eGamesAbove($keyboard, $bar), true)
            ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);
    }

    $host->resize(1440, 900);
    $host->script("() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true })); return true; }");
    $host->click(p18eGamesKey('q'))
        ->assertAttribute(p18eGamesKey('q'), 'data-state', 'hit');

    $guest->assertAttribute(p18eGamesKey('q'), 'data-state', 'hit')
        ->assertScript("(document.querySelector('.lr-overlay')?.textContent ?? '').includes('👍')", false);

    $host->click('[aria-label="Room menu"]')
        ->click('[role="menuitem"]:has-text("Room settings")')
        ->assertAriaAttribute('#room-reactions', 'checked', 'true')
        ->click('#room-reactions')
        ->assertAriaAttribute('#room-reactions', 'checked', 'false')
        ->click('Save')
        ->assertNotPresent('[role="dialog"]');

    foreach ([$host, $guest] as $page) {
        $page->assertNotPresent($bar)
            ->assertPresent($keyboard);
    }

    $guest->assertScript('performance.getEntriesByType("navigation").length', 1);

    expect($room->fresh()->reactions_enabled)->toBeFalse();
});

it('[P18e-06-09] opens the Share dialog from "Invite": the guest switch, the link, its QR code, and a new link after a confirmation', function () {
    [$room, $ada] = p18eGamesRoom();
    $oldToken = $room->guest_token;
    $dialog = '[data-slot="share-dialog"]';

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$oldToken}", 'Visitor'));

    $guest->assertNotPresent('[aria-label="Invite"]');

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('[aria-label="Invite"]')
        ->assertSeeIn($dialog, 'Invite to Lunch')
        ->assertValue("{$dialog} input[aria-label=\"Guest link\"]", url("/play/{$oldToken}"))
        ->assertVisible("{$dialog} [data-slot=\"share-qr\"] svg")
        ->assertVisible("{$dialog} button:has-text(\"Download the QR code\")")
        ->assertAriaAttribute('#room-guests', 'checked', 'true')
        ->click("{$dialog} button:has-text(\"Create a new link\")")
        ->assertSeeIn('[role="alertdialog"]', 'Create a new link?')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]');

    expect($room->fresh()->guest_token)->toBe($oldToken);

    $host->click("{$dialog} button:has-text(\"Create a new link\")")
        ->click('[role="alertdialog"] button:has-text("Create a new link")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSee('A new guest link was created. The old one no longer works.');

    $newToken = $room->fresh()->guest_token;

    expect($newToken)->not->toBe($oldToken);

    $host->assertValue("{$dialog} input[aria-label=\"Guest link\"]", url("/play/{$newToken}"));

    $guest->assertSee('Your access to this room has ended.');

    $host->click('#room-guests')
        ->assertAriaAttribute('#room-guests', 'checked', 'false')
        ->assertSeeIn($dialog, 'Guest link is off')
        ->assertNotPresent("{$dialog} input[aria-label=\"Guest link\"]")
        ->assertNotPresent("{$dialog} [data-slot=\"share-qr\"]");

    expect($room->fresh()->access)->toBe(GameRoomAccess::Team);

    visit("/play/{$newToken}")->assertSee('This guest link is no longer valid.');
});
