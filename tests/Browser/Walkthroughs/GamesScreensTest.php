<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Pest\Browser\Execution;

function gamesScreensGamesPlayer(GameRoom $room, User $user): GamePlayer
{
    return GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $user->id]);
}

function gamesScreensGamesRoomNames(): string
{
    return "[...document.querySelectorAll('[data-slot=\"sessions-page\"] [data-slot=\"session-row\"][data-kind=\"icebreaker\"]')].map((link) => link.getAttribute('aria-label').replace(/, [A-Z][a-z]{2} \\d+, \\d{4}$/, '')).join(' | ')";
}

it('shows the podium with a streak on a top-three player and marks the current user', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $room = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Friday fun', 'game' => GameKind::Hangman]);
    $players = [];

    foreach (['Ada', 'Bob', 'Cy', 'Di'] as $name) {
        $players[$name] = gamesScreensGamesPlayer($room, renamedUser(teamMember($team), $name));
    }

    awardGamePoints($room, $players['Bob'], 5, true, ['created_at' => now()->subWeek()]);
    awardGamePoints($room, $players['Bob'], 4, false, ['created_at' => now()]);
    awardGamePoints($room, $players['Ada'], 6, false, ['created_at' => now()]);
    awardGamePoints($room, $players['Cy'], 3, false, ['created_at' => now()]);
    awardGamePoints($room, $players['Di'], 1, false, ['created_at' => now()]);

    $page = $this->signIn($players['Ada']->user, teamPath('teams.games.index', $team));

    $page->assertSeeIn('[data-slot="insights-tabs"] nav a[aria-current="page"]', 'Games')
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

it('lists the rooms as links, a room in play first, then the latest changed', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $ada = renamedUser(teamMember($team), 'Ada');
    $old = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Old room', 'game' => GameKind::Hangman, 'updated_at' => now()->subDays(2)]);
    $playing = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id, 'name' => 'In play', 'game' => GameKind::DrawAndGuess, 'updated_at' => now()->subDay()]);
    GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'New room here', 'game' => GameKind::Decoded, 'updated_at' => now()]);
    gamesScreensGamesPlayer($playing, $ada);
    activeGameRound($playing);

    $page = $this->signIn($ada, route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'icebreaker'], false));

    $page->assertScript(gamesScreensGamesRoomNames(), 'In play, Icebreaker · Draw & Guess, 1 player, Now, Live | New room here, Not started, Icebreaker · Decoded | Old room, Not started, Icebreaker · Hangman')
        ->assertPresent("[data-slot=\"sessions-page\"] > section a[href$=\"/games/{$playing->id}\"]")
        ->click("a[data-slot=\"session-row\"][href$=\"/games/{$old->id}\"]")
        ->assertPathIs("/games/{$old->id}");
});

it('shows a room with a round in play as live with its players, and a room without a round as not started', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $ada = renamedUser(teamMember($team), 'Ada');
    $playing = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Daily warm-up', 'game' => GameKind::Hangman]);
    $waiting = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Sprint kick-off', 'game' => GameKind::Hangman, 'updated_at' => now()->subDay()]);
    gamesScreensGamesPlayer($playing, $ada);

    foreach (['Bob', 'Cy', 'Di', 'Ed', 'Flo', 'Gus'] as $name) {
        gamesScreensGamesPlayer($playing, renamedUser(teamMember($team), $name));
    }

    activeGameRound($playing, ['started_at' => now()->subMinutes(4)]);

    $page = $this->signIn($ada, route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'icebreaker'], false));
    $live = "a[data-slot=\"session-row\"][href$=\"/games/{$playing->id}\"]";
    $idle = "a[data-slot=\"session-row\"][href$=\"/games/{$waiting->id}\"]";

    $page->assertPresent("[data-slot=\"sessions-page\"] > section {$live}")
        ->assertSeeIn($live, 'Live')
        ->assertSeeIn("{$live} [data-slot=\"session-row-outcome\"]", '7 players')
        ->assertPresent("[data-slot=\"card\"]:has({$live}) a:text-is(\"Join\")")
        ->assertSeeIn("{$idle} [data-slot=\"badge\"]", 'Not started')
        ->assertNotPresent("{$idle} [data-slot=\"session-row-outcome\"]")
        ->assertNotPresent("[data-slot=\"card\"]:has({$idle}) a:text-is(\"Join\")")
        ->assertPresent('[data-sidebar="content"] a[data-sidebar="menu-button"][aria-label="Sessions, 1 live"]');
});

it('shows the notice of an invalid guest link with HTTP 404', function () {
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Friday fun']);
    $path = route('games.join.show', $room->guest_token, false);

    $guest = browserVisit($path);

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
function gamesScreensGamesRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Lunch', 'game' => GameKind::Hangman, ...$attributes]);
    [$ada] = gameRoomHost($room);

    $room->forceFill(['created_by_user_id' => $ada->id])->save();
    $ada->forceFill(['name' => 'Ada Host', 'locale' => 'en'])->save();

    return [$room, $ada];
}

function gamesScreensGamesKey(string $letter): string
{
    return "[data-layout] button:has-text(\"{$letter}\")";
}

function gamesScreensGamesRows(): string
{
    return "[...document.querySelectorAll('[data-layout] [data-slot=\"keyboard-row\"]')].map((row) => row.textContent).join(' ')";
}

/** True when the bottom of the first element is above the top of the second. */
function gamesScreensGamesAbove(string $first, string $second): string
{
    return "document.querySelector('{$first}').getBoundingClientRect().bottom <= document.querySelector('{$second}').getBoundingClientRect().top";
}

it('lets the host pick a game from the cards, shows a non-host its badge and says why a game is not available', function () {
    [$room, $ada] = gamesScreensGamesRoom();

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertCount('[role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]', 8)
        ->assertAriaAttribute(icebreakerCard('Hangman'), 'checked', 'true')
        ->assertSeeIn(icebreakerCard('Hangman'), 'In play')
        ->assertDontSeeIn(icebreakerCard('Decoded'), 'In play')
        ->assertNotPresent('[role="tab"]')
        ->assertSeeIn('[data-slot="game-right"] section[aria-labelledby="game-players"] h2', 'Scores')
        ->assertAriaAttribute(icebreakerCard('Sprint in one GIF'), 'disabled', 'true')
        ->assertSeeIn(icebreakerCard('Sprint in one GIF'), 'Not available')
        ->assertSeeIn('header [data-slot="room-game"]', 'Hangman');

    $guest->assertNotPresent('[role="radiogroup"]')
        ->assertNotPresent('[data-slot="game-left"]')
        ->assertSeeIn('header [data-slot="room-game"]', 'Hangman');

    $host->click(icebreakerCard('Decoded'))
        ->assertAriaAttribute(icebreakerCard('Decoded'), 'checked', 'true')
        ->assertAriaAttribute(icebreakerCard('Hangman'), 'checked', 'false')
        ->assertSeeIn('#game-stage-title', 'Decoded');

    $guest->assertSeeIn('header [data-slot="room-game"]', 'Decoded')
        ->assertSeeIn('#game-stage-title', 'Decoded');

    expect($room->fresh()->game)->toBe(GameKind::Decoded);

    $offCentre = "(() => { const box = (selector) => document.querySelector(selector).getBoundingClientRect(); const header = box('header:has([data-slot=\"room-game\"])'); const badge = box('header [data-slot=\"room-game\"]'); return Math.abs(badge.left + badge.width / 2 - header.left - header.width / 2); })()";

    expect($host->resize(1920, 900)->script($offCentre))->toBeLessThanOrEqual(2);

    $host->assertScript('document.querySelector(\'header [data-slot="session-bar-start"] [data-slot="room-game"]\') === null', true)
        ->resize(390, 800)
        ->assertVisible('header [data-slot="room-game"]')
        ->assertScript('document.documentElement.scrollWidth <= document.documentElement.clientWidth', true);

    $host->resize(1440, 900)
        ->keys(icebreakerCard('Draw & Guess'), 'Enter')
        ->assertSeeIn('#game-stage-title', 'Draw & Guess')
        ->assertNotPresent('[data-slot="game-left"] [role="radio"]')
        ->assertPresent('[data-slot="game-left"] [data-slot="game-chooser"]:focus')
        ->keys('[data-slot="game-chooser"]', 'Enter')
        ->keys('[role="dialog"] '.icebreakerCard('Hangman'), 'Enter')
        ->assertSeeIn('#game-stage-title', 'Hangman')
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent('[data-slot="game-left"] [role="radio"][aria-checked="true"]:focus')
        ->assertSeeIn('[data-slot="game-left"] [role="radio"]:focus', 'Hangman');

    expect($room->fresh()->game)->toBe(GameKind::Hangman);
});

it('lays the hangman keyboard out for the language of the player, plays at 390 pixels, and freezes under one banner when the session expires', function () {
    [$room, $ada] = gamesScreensGamesRoom();
    $ada->forceFill(['locale' => 'fr'])->save();
    activeGameRound($room, ['word' => 'quartz']);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertScript(gamesScreensGamesRows(), 'azertyuiop qsdfghjklm wxcvbn')
        ->assertCount('[data-realtime]', 1);
    $guest->assertScript(gamesScreensGamesRows(), 'qwertyuiop asdfghjkl zxcvbnm')
        ->assertCount('[data-realtime]', 1);

    $host->resize(390, 844)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->assertNotPresent('[data-slot="game-right"]')
        ->assertVisible('[data-slot="player-chips"]')
        ->assertScript("[...document.querySelectorAll('[data-layout] button')].every((key) => key.getBoundingClientRect().height >= 44 && key.getBoundingClientRect().right <= window.innerWidth)", true)
        ->click(gamesScreensGamesKey('q'))
        ->assertAttribute(gamesScreensGamesKey('q'), 'data-state', 'hit')
        ->click(gamesScreensGamesKey('x'))
        ->assertAttribute(gamesScreensGamesKey('x'), 'data-state', 'miss')
        ->assertSeeIn('[data-slot="hangman-missed"]', 'X')
        ->assertVisible('[data-slot="hangman-board"] ul[aria-label="Derniers coups"]')
        ->assertSeeIn('[data-slot="hangman-board"] ul[aria-label="Derniers coups"]', 'X')
        ->assertPresent('[data-slot="game-footer"] [data-layout]')
        ->assertNotPresent('[data-slot="hangman-board"] [data-layout]')
        ->assertScript("Math.abs(document.querySelector('[data-slot=\"game-footer\"]').getBoundingClientRect().bottom - window.innerHeight) <= 1", true)
        ->assertScript(gamesScreensGamesAbove('[data-slot="hangman-figure"]', '[data-layout]'), true)
        ->assertScript(gamesScreensGamesAbove('[data-slot="word-mask"]', '[data-layout]'), true)
        ->assertScript("document.querySelector('[data-slot=\"hangman-figure\"]').getBoundingClientRect().top >= 0", true)
        ->resize(375, 667)
        ->assertScript(gamesScreensGamesAbove('[data-slot="game-bar"]', '[data-slot="word-mask"]'), true)
        ->assertScript(gamesScreensGamesAbove('[data-slot="word-mask"]', '[data-slot="game-dock"]'), true)
        ->resize(390, 844)
        ->assertAriaAttribute(gamesScreensGamesKey('q'), 'label', 'q, dans le mot')
        ->assertAriaAttribute(gamesScreensGamesKey('x'), 'label', 'x, pas dans le mot')
        ->click('[aria-label="Joueurs et scores"]')
        ->assertSeeIn('[role="dialog"] section[aria-labelledby="game-players"]', 'Visitor')
        ->assertCount('ul[aria-label="Derniers coups"]', 1)
        ->assertNotPresent('[role="dialog"] ul[aria-label="Derniers coups"]');

    $guest->assertAttribute(gamesScreensGamesKey('q'), 'data-state', 'hit')
        ->assertAttribute(gamesScreensGamesKey('x'), 'data-state', 'miss')
        ->assertSeeIn('[data-slot="game-right"] ul[aria-label="Last moves"]', 'Ada Host picked X')
        ->assertCount('ul[aria-label="Last moves"]', 1);

    $host->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    expect($this->sendFromPage($host, 'POST', '/logout')['status'])->toBe(204);

    $host->click(gamesScreensGamesKey('u'))
        ->assertCount('[data-slot="connection-state"][data-status="expired"]', 1)
        ->assertScript("document.querySelector('[data-realtime] > div[inert]') !== null", true)
        ->assertCount('[data-realtime]', 1)
        ->assertNotPresent('[data-sonner-toast]');
});

it('flies a reaction of a guest on the screen of the host, never over the keyboard, and takes the bar away for both when the host turns reactions off', function () {
    [$room, $ada] = gamesScreensGamesRoom();
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

    $host->resize(1440, 900)
        ->assertVisible($bar)
        ->assertScript(gamesScreensGamesAbove($keyboard, $bar), true)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);

    $host->resize(390, 844)
        ->assertVisible($bar)
        ->assertPresent("[data-slot=\"game-footer\"] {$keyboard}")
        ->assertScript(gamesScreensGamesAbove($bar, $keyboard), true)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);

    $host->resize(1440, 900);
    $host->script("() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true })); return true; }");
    $host->click(gamesScreensGamesKey('q'))
        ->assertAttribute(gamesScreensGamesKey('q'), 'data-state', 'hit');

    $guest->assertAttribute(gamesScreensGamesKey('q'), 'data-state', 'hit')
        ->assertScript("(document.querySelector('.lr-overlay')?.textContent ?? '').includes('👍')", false);

    $guest->script('() => { window.testStayed = true; }');

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

    $guest->assertScript('window.testStayed === true', true);

    expect($room->fresh()->reactions_enabled)->toBeFalse();
});

it('docks the guess field of a drawing under the reaction bar at 390 pixels, and opens the guesses in a drawer', function () {
    [$room, $ada] = gamesScreensGamesDrawing();
    $bar = '[role="toolbar"][aria-label="Reactions"]';
    $field = 'input[aria-label="Your guess"]';

    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $guesser->resize(390, 844)
        ->assertVisible($bar)
        ->assertVisible("[data-slot=\"game-footer\"] {$field}")
        ->assertScript(gamesScreensGamesAbove($bar, $field), true)
        ->assertScript(gamesScreensGamesAbove('canvas[aria-label="The drawing"]', $field), true)
        ->assertScript("Math.abs(document.querySelector('[data-slot=\"game-footer\"]').getBoundingClientRect().bottom - window.innerHeight) <= 1", true)
        ->assertNotPresent('[role="log"]')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->fill($field, 'zebra')
        ->click('[data-slot="guess-dock"] button[type="submit"]')
        ->assertSeeIn('[data-slot="last-guess"]', 'zebra')
        ->click('[data-slot="guess-dock"] button[aria-haspopup="dialog"]')
        ->assertSeeIn('[role="dialog"] [role="log"]', 'zebra')
        ->assertNotPresent('[role="dialog"] input')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->assertVisible($field);

    $guesser->resize(1440, 900)
        ->assertNotPresent('[data-slot="game-footer"]')
        ->assertSeeIn('[data-slot="game-right"] [role="log"]', 'zebra');
});

it('opens the Share dialog from "Invite": the guest switch, the link, its QR code, and a new link after a confirmation', function () {
    [$room, $ada] = gamesScreensGamesRoom();
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
        ->click("{$dialog} button:has-text(\"Regenerate link\")")
        ->assertSeeIn('[role="alertdialog"]', 'Regenerate the invite link?')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]');

    expect($room->fresh()->guest_token)->toBe($oldToken);

    $host->click('#room-guests')
        ->assertSeeIn('[role="alertdialog"]', 'Turn off guest access?')
        ->assertSeeIn('[role="alertdialog"]', 'Guests in this room lose access.')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertAriaAttribute('#room-guests', 'checked', 'true');

    expect($room->fresh()->access)->toBe(GameRoomAccess::Link);

    $guest->assertDontSee('Your access to this room has ended.');

    $host->click("{$dialog} button:has-text(\"Regenerate link\")")
        ->click('[role="alertdialog"] button:text-is("Regenerate")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSee('A new guest link was created. The old one no longer works.');

    $newToken = $room->fresh()->guest_token;

    expect($newToken)->not->toBe($oldToken);

    $host->assertValue("{$dialog} input[aria-label=\"Guest link\"]", url("/play/{$newToken}"));

    $guest->assertSee('Your access to this room has ended.');

    $host->click('#room-guests')
        ->click('[role="alertdialog"] button:has-text("Turn off guest access")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertAriaAttribute('#room-guests', 'checked', 'false')
        ->assertSeeIn($dialog, 'Guest link is off')
        ->assertNotPresent("{$dialog} input[aria-label=\"Guest link\"]")
        ->assertNotPresent("{$dialog} [data-slot=\"share-qr\"]");

    expect($room->fresh()->access)->toBe(GameRoomAccess::Team);

    browserVisit("/play/{$newToken}")->assertSee('This guest link is no longer valid.');
});

/**
 * A Draw & Guess round in play: Bob draws, Ada (the host) guesses.
 *
 * @return array{0: GameRoom, 1: User, 2: User, 3: GameRound}
 */
function gamesScreensGamesDrawing(): array
{
    [$room, $ada] = gamesScreensGamesRoom(['game' => GameKind::DrawAndGuess]);
    $bob = renamedUser(teamMember($room->team), 'Bob Leader');
    $round = activeGameRound($room, ['word' => 'lantern', 'leader_player_id' => gamesScreensGamesPlayer($room, $bob)->id]);

    return [$room, $ada, $bob, $round];
}

/**
 * The inks the toolbar offers, as the canvas paints them: read from the palette, never copied.
 *
 * @return array<string, string> colour name => "r g b 255"
 */
function gamesScreensGamesInks(): array
{
    $source = (string) file_get_contents(resource_path('js/lib/games/drawing.ts'));

    expect(preg_match('/export const DrawingColors: DrawingColor\[\] = \[(.*?)\];/s', $source, $offered))->toBe(1, 'DrawingColors is no longer found in drawing.ts.');

    preg_match_all("/'([a-z]+)'/", $offered[1], $names);
    preg_match_all("/\['([a-z]+)', \[(\d+), (\d+), (\d+)\]\]/", $source, $palette, PREG_SET_ORDER);

    $inks = [];

    foreach ($palette as [, $name, $red, $green, $blue]) {
        if (in_array($name, $names[1], true)) {
            $inks[$name] = "{$red} {$green} {$blue} 255";
        }
    }

    expect($inks)->not->toBeEmpty()->toHaveCount(count($names[1]), 'The palette of drawing.ts no longer gives a colour to every offered ink.');

    return $inks;
}

/**
 * @param  array<int, array<int, float>>  $points  fractions of the sheet
 */
function gamesScreensGamesStroke(mixed $page, array $points): void
{
    $path = json_encode($points);

    $page->script(<<<JS
        () => {
            const canvas = document.querySelector('canvas[aria-label="Your drawing"]');
            const box = canvas.getBoundingClientRect();
            const path = {$path};
            canvas.setPointerCapture = () => {};
            path.forEach(([x, y], index) => {
                const type = index === 0 ? "pointerdown" : "pointermove";
                canvas.dispatchEvent(new PointerEvent(type, {
                    bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1,
                    clientX: box.left + box.width * x, clientY: box.top + box.height * y,
                }));
            });
            const [x, y] = path[path.length - 1];
            canvas.dispatchEvent(new PointerEvent("pointerup", {
                bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 0,
                clientX: box.left + box.width * x, clientY: box.top + box.height * y,
            }));
            return true;
        }
        JS);
}

/** The largest gap, over the channels, between the colour a swatch shows and an ink. */
function gamesScreensGamesSwatchDistance(string $color, string $rgba): string
{
    $ink = json_encode(array_map(intval(...), explode(' ', $rgba)));

    return <<<JS
        (() => {
            const swatch = document.querySelector('[role="toolbar"][aria-label="Drawing tools"] [data-color="{$color}"] span:last-child');
            const context = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d');

            context.fillStyle = getComputedStyle(swatch).backgroundColor;
            context.fillRect(0, 0, 1, 1);

            return Math.max(...Array.from(context.getImageData(0, 0, 1, 1).data).map((channel, index) => Math.abs(channel - {$ink}[index])));
        })()
        JS;
}

/**
 * @param  array<string, bool>  $modifiers
 */
function gamesScreensGamesPress(mixed $page, string $key, array $modifiers = []): void
{
    $init = json_encode(['key' => $key, 'bubbles' => true, 'cancelable' => true, ...$modifiers]);

    $page->script("() => { document.body.dispatchEvent(new KeyboardEvent('keydown', {$init})); return true; }");
}

it('keeps the colours of the drawing toolbar in a popover at phone width, and the toolbar inside the screen', function () {
    [$room, $ada, $bob] = gamesScreensGamesDrawing();
    $toolbar = '[role="toolbar"][aria-label="Drawing tools"]';
    $coral = gamesScreensGamesInks()['coral'];

    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $drawer->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertVisible("{$toolbar} [aria-label=\"Coral\"]")
        ->assertNotPresent("{$toolbar} [aria-label^=\"Ink colour\"]")
        ->resize(390, 844)
        ->assertVisible($toolbar)
        ->assertNotPresent("{$toolbar} [aria-label=\"Coral\"]")
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->assertScript("[...document.querySelectorAll('{$toolbar} button')].every((key) => key.getBoundingClientRect().height >= 44 && key.getBoundingClientRect().left >= 0 && key.getBoundingClientRect().right <= window.innerWidth)", true)
        ->assertScript(gamesScreensGamesAbove('canvas[aria-label="Your drawing"]', $toolbar), true)
        ->click("{$toolbar} [aria-label=\"Ink colour: Ink\"]")
        ->assertCount('[role="dialog"] [data-color]', 9)
        ->assertAriaAttribute('[role="dialog"] [aria-label="Ink"]', 'pressed', 'true')
        ->click('[role="dialog"] [aria-label="Coral"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertAttribute("{$toolbar} [aria-label=\"Ink colour: Coral\"]", 'data-color', 'coral')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);

    gamesScreensGamesStroke($drawer, [[0.25, 0.5], [0.5, 0.5], [0.75, 0.5]]);

    $drawer->assertScript(canvasPixelScript('Your drawing', 400, 300), $coral);
    $guesser->assertScript(canvasPixelScript('The drawing', 400, 300), $coral)
        ->assertScript(canvasPixelScript('The drawing', 400, 100), '255 255 255 255');
});

it('draws each of the eight colours with its own ink on the canvas of the guesser, erases after E and undoes with the undo keys', function () {
    [$room, $ada, $bob, $round] = gamesScreensGamesDrawing();
    $inks = gamesScreensGamesInks();
    $themeInks = array_diff_key($inks, ['black' => true]);

    expect(array_keys($themeInks))->toBe(['sun', 'apricot', 'coral', 'plum', 'iris', 'sky', 'lagoon', 'moss'])
        ->and(array_unique($inks))->toHaveCount(9);

    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $drawer->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertAriaAttribute('[aria-label="Pencil"]', 'pressed', 'true')
        ->assertAriaAttribute('[aria-label="Ink"]', 'pressed', 'true');

    $drawer->script("() => { document.documentElement.classList.add('dark'); return true; }");

    foreach ($inks as $name => $rgb) {
        $drawer->assertScript(gamesScreensGamesSwatchDistance($name, $rgb).' <= 12', true);
    }

    $drawer->assertScript(gamesScreensGamesSwatchDistance('black', '255 255 255 255').' > 200', true);
    $drawer->script("() => { document.documentElement.classList.remove('dark'); return true; }");

    $row = 0;

    foreach ($themeInks as $name => $rgb) {
        $row++;
        $label = ucfirst($name);

        $drawer->click("[aria-label=\"{$label}\"]")
            ->assertAriaAttribute("[aria-label=\"{$label}\"]", 'pressed', 'true');

        gamesScreensGamesStroke($drawer, [[0.25, $row / 10], [0.5, $row / 10], [0.75, $row / 10]]);

        $guesser->assertScript(canvasPixelScript('The drawing', 400, $row * 60), $rgb);
    }

    $guesser->assertScript(canvasPixelScript('The drawing', 400, 570), '255 255 255 255');

    Execution::instance()->waitForExpectation(fn () => expect(array_column($round->fresh()->drawing, 'color'))->toBe(array_keys($themeInks)));

    gamesScreensGamesPress($drawer, 'e');

    $drawer->assertAriaAttribute('[aria-label="Eraser"]', 'pressed', 'true')
        ->assertAriaAttribute('[aria-label="Pencil"]', 'pressed', 'false');

    gamesScreensGamesStroke($drawer, [[0.4, 0.1], [0.5, 0.1], [0.6, 0.1]]);

    $guesser->assertScript(canvasPixelScript('The drawing', 400, 60), '255 255 255 255')
        ->assertScript(canvasPixelScript('The drawing', 240, 60), $themeInks['sun']);

    gamesScreensGamesPress($drawer, 'z', ['metaKey' => true]);

    $guesser->assertScript(canvasPixelScript('The drawing', 400, 60), $themeInks['sun']);

    gamesScreensGamesPress($drawer, 'z', ['ctrlKey' => true]);

    $guesser->assertScript(canvasPixelScript('The drawing', 400, 480), '255 255 255 255')
        ->assertScript(canvasPixelScript('The drawing', 400, 420), $themeInks['lagoon']);

    gamesScreensGamesPress($drawer, 'p');

    $drawer->assertAriaAttribute('[aria-label="Pencil"]', 'pressed', 'true');

    gamesScreensGamesPress($guesser, 'e');
    $guesser->assertNotPresent('[role="toolbar"][aria-label="Drawing tools"]');

    Execution::instance()->waitForExpectation(fn () => expect($round->fresh()->drawing)->toHaveCount(7));
});

it('replays a round drawn in red before the eight theme colours with its old colour, in the results of the retro', function () {
    $retro = Retro::factory()
        ->withIcebreaker()
        ->inPhase(RetroPhase::Completed)
        ->create(['title' => 'Sprint 13 retro', 'icebreaker_game' => GameKind::DrawAndGuess, 'completed_at' => now()]);
    [$ada, $adaParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro->fresh())->game(GameKind::DrawAndGuess)->create();
    $adaPlayer = GamePlayer::factory()->forParticipant($adaParticipant)->create(['game_room_id' => $room->id]);
    $bobPlayer = GamePlayer::factory()->forParticipant($bobParticipant)->create(['game_room_id' => $room->id]);
    $round = GameRound::factory()->game(GameKind::DrawAndGuess)->ended(GameRoundOutcome::Guessed)->create([
        'game_room_id' => $room->id,
        'word' => 'rocket',
        'leader_player_id' => $adaPlayer->id,
        'winner_player_id' => $bobPlayer->id,
        'drawing' => [
            ['type' => 'stroke', 'color' => 'red', 'size' => 10, 'points' => [[250, 375], [750, 375]]],
            ['type' => 'stroke', 'color' => 'black', 'size' => 10, 'points' => [[250, 125], [750, 125]]],
        ],
    ]);
    $room->forceFill(['current_round_id' => $round->id])->save();
    awardGamePoints($room, $bobPlayer, 10, true, ['game_round_id' => $round->id, 'game' => GameKind::DrawAndGuess]);
    $bob->forceFill(['locale' => 'en'])->save();

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->click('section:has(> h2:has-text("Games we played")) button:has-text("Replay")')
        ->assertVisible('[role="dialog"] canvas[aria-label="Drawing of rocket"]')
        ->assertScript(canvasPixelScript('Drawing of rocket', 400, 300), '220 38 38 255')
        ->assertScript(canvasPixelScript('Drawing of rocket', 400, 100), '23 23 23 255')
        ->assertScript(canvasPixelScript('Drawing of rocket', 400, 200), '255 255 255 255')
        ->assertNotPresent('[role="dialog"] [role="toolbar"]');
});

it('writes "team · Games" above the name of the room, shows "Synced" and the viewer at the end of the header, and keeps the name on a phone', function () {
    [$room, $ada] = gamesScreensGamesRoom();
    $room->team->update(['name' => 'Atlas']);
    $hidden = fn (string $selector): string => "getComputedStyle(document.querySelector('{$selector}')).display";
    $titleKeepsItsRoom = "(({ scrollWidth, clientWidth }) => clientWidth > 0 && (scrollWidth <= clientWidth || clientWidth / parseFloat(getComputedStyle(document.documentElement).fontSize) >= 6))(document.querySelector('header h1'))";

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"))->resize(1700, 900);

    $host->assertSeeIn('header [data-slot="session-overline"]', 'Atlas · Games')
        ->assertSeeIn('header span > h1', 'Lunch')
        ->assertSeeIn('header [data-slot="session-synced"]', 'Synced')
        ->assertVisible('header > :last-child > [data-slot="session-self"]:last-child [aria-label="Ada Host"]')
        ->assertCount('[data-realtime]', 1);

    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'))->resize(1700, 900);

    $guest->assertSeeIn('header [data-slot="session-overline"]', 'Games')
        ->assertVisible('header > :first-child > span[data-slot="session-logo"]:first-child [role="img"][aria-label="Skrüm"]')
        ->assertNotPresent('header a')
        ->assertDontSeeIn('header', 'Atlas')
        ->assertVisible('header [data-slot="session-self"] [aria-label="Visitor (Guest)"]')
        ->resize(390, 844)
        ->assertScript($hidden('header [data-slot="session-overline"]'), 'none')
        ->assertScript($hidden('header [data-slot="session-synced"]'), 'none')
        ->assertScript($hidden('header [data-slot="session-self"]'), 'none')
        ->assertScript($titleKeepsItsRoom, true)
        ->assertCount('[data-realtime]', 1);
});
