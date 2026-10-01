# Plan 16d — Games walkthroughs (plans 13a to 13d) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the walkthroughs of plans 13a (games foundation, Hangman), 13b (Draw & Guess, Decoded), 13c (Sprint in one GIF) and 13d (icebreaker, scores, invites) as browser tests.

**Architecture:** Browser tests live in `tests/Browser/Walkthroughs`, one file per walkthrough, bound to `Tests\BrowserTestCase` (built assets, a Reverb server started by the suite, authentication reset after every request so several browser contexts act as different users). Each walkthrough step maps to a test whose title starts with the step's identifier; the mapping is recorded in `docs/superpowers/walkthroughs/coverage.md`, and what cannot be automated in `residual-manual-checklist.md`. Tests sign in and join through the real interface, wait on `data-realtime` instead of sleeping, and arrange their own state with factories.

**Tech Stack:** PHP 8.4, Laravel 13, Pest 5 with `pestphp/pest-plugin-browser` 5.x (Playwright, Chromium), Laravel Reverb, Inertia v3 with React 19, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (this plan is one of its "later slices", §1). Read it, and read `docs/superpowers/walkthroughs/harness-findings.md`: it holds the facts proven by running the browser plugin against this application, and it overrides this plan's text where they differ.

**Depends on:** Plan 16a merged, and plan 16b Task 1 (`$this->workQueue()` in `InteractsWithBrowser`).

## Global Constraints

- No new dependency and no new base folder.
- Browser tests never call `actingAs()`, `withCookie()`, `withCookies()` or `Event::fake()` without arguments (the Arch source scan fails the build). Members sign in with `$this->signIn(...)`; guests join with `$this->joinAsGuest(...)`. `Http::fake([...])`, `Mail::fake()`, `Notification::fake()`, `Queue::fake()` and `Event::fake([Specific::class])` are allowed and apply to browser requests.
- No fixed sleep for realtime: `$this->awaitRealtime($page)` after opening a live page, act on one page, assert on the other. Assert that an element is visible before acting on it or reading from it. Send one key per `keys()` call where order matters.
- Selectors: English text and aria-labels first, locale English. A string containing `( ) : , = [ ] > + ~ * | ^ #` is CSS and must match exactly one element (except in `assertCount()`, `assertPresent()`, `assertNotPresent()`, `assertDontSeeIn()`); a bare tag name is NOT CSS. After choosing a Radix menu item, assert the menu is gone before reopening it.
- Product code gains only `data-test` attributes and the `data-realtime` attribute (spec criterion 10). Anything else found wrong in the product follows the Defect rule.
- Each test arranges its own state; no test depends on another. No comments in test code. Do not redeclare the global helper functions of other walkthrough files.
- PHP style as in the project guidelines. After editing PHP: `vendor/bin/pint --dirty --format agent`, PHPStan, and `composer rector:check` (if Rector wants to rewrite code the task wrote, apply `composer rector`, re-run Pint and the tests, and say so).
- After editing a `.tsx` or `.ts` file: `npm run types:check`, `npm run check`, `npm run build` (the browser suite serves `public/build`).
- `composer test` must stay free of browser tests; `composer test:arch` and `composer test:browser` must stay green.
- Secret words and answers are fixed through factories (or a container binding where a factory cannot fix them); a test proves secrecy by their absence from the page source and from the snapshot fetched in the page.
- The canvas is driven with `script()` dispatching pointer events; this is unproven: the first drawing test is written and run alone before the others.
- The 12-player cap depends on the live Reverb roster and no configuration lowers it: the thirteenth-session step is residual.
- GIF providers and share channels are faked with `Http::fake()`.

## Environment

- With Sail in the primary checkout: prefix `composer`, `artisan`, `pest` and `npm` with `vendor/bin/sail`.
- In a worktree on host PHP: `export DB_HOST=127.0.0.1 DB_DATABASE=<a test database of its own>` and run Pest as `php -d memory_limit=2G vendor/bin/pest …`.
- The browser suite needs built assets (`npm run build`), no `public/hot`, and port 8097 free (it starts its own Reverb server; an orphan from a killed run must be stopped first: `lsof -i :8097`).
- Run one test: `vendor/bin/pest tests/Browser/Walkthroughs/<File> --filter='<id>'`. Watch it: `--headed`. Pause on failure: `--debug`. Screenshots of failed assertions: `tests/Browser/Screenshots`.

## Defect rule

None of the code in this plan was executed while it was written: it was derived from reading the components, controllers and factories. When a test fails:

1. If the interface text or structure differs from the selector and the behaviour is right, fix the selector (smallest change) and note it in the task report.
2. If the behaviour is wrong against the feature's spec: stop the task, write a failing feature test where the behaviour is server-side, fix the defect in its own commit (`fix(<area>): …`), then return. Record it under "Defects found" in `docs/superpowers/walkthroughs/coverage.md`.
3. If the walkthrough's text and the feature's spec disagree, the feature's spec wins; record the difference in the coverage table's Notes.
4. If a harness assumption is wrong, follow `docs/superpowers/walkthroughs/harness-findings.md`, or stop and report when it has no answer.
5. Coverage statuses in this plan are provisional until the tests run: a row is `auto` or `auto-substituted` only when its test passes.

Run each finished test file twice in a row before committing it.

## Tasks

| # | Task |
|---|---|
| 1 | Games foundation walkthrough, steps 1 to 5 (room, guest join, a Hangman round, secrecy of the word) |
| 2 | Games foundation walkthrough, steps 6 to 9 (timer, team-only access, player cap, delete) |
| 3 | Draw & Guess walkthrough, steps 1 to 10 (drawing, late joiner, guesses, hints, rotation) |
| 4 | Decoded walkthrough, steps 11 to 13 (emoji clue, pass and give up, history) |
| 5 | Sprint in one GIF walkthrough (plan 13c) |
| 6 | Icebreaker game inside a retro and "Games we played" (plan 13d, steps 6 and 11) |
| 7 | Guest play, scores, leaderboards, streaks and invites (plan 13d, steps 7 to 10 and 12) |
| 8 | Coverage table and residual checklist |
| 9 | Final verification |

## Review Focus

Conditions the spec implies that a happy-path reading could miss, each pinned by a test.

1. The secret word or GIF answer never reaches a guesser's browser before the round ends: absent from the page source and from the snapshot. Pinned by the secrecy tests of Tasks 1 and 5.
2. A round ends on the server when its timer expires, even if no browser is counting. Pinned by the timer tests of Tasks 2 and 5.
3. A late joiner sees the drawing made before they arrived. Pinned by the late-joiner test of Task 3.
4. A guest scores only in their room and never appears on the team leaderboard. Pinned by the leaderboard tests of Task 7.
5. An invite to a channel that needs reconnecting shows the failure instead of hiding the invite controls. Pinned by the invite tests of Task 7 (see the possible defect noted in the appendix).

---

### Task 1: Games foundation walkthrough, steps 1 to 5 (room, guest join, a Hangman round, secrecy of the word)

This task automates steps 1 to 5 of the plan 13a walkthrough (`docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md`, lines 10651 to 10655). Three steps use a substitution of spec §3.6:

- Step 2 asked to copy the guest link. The room header has no input that holds the link, only an icon button that writes it to the clipboard and shows a toast. The test replaces `navigator.clipboard.writeText` in the host's page with a function that records its argument, presses the real button, and reads the recorded link.
- Step 3 asked to search the page source and the network tab for the word. The test searches `content()` (the page source, which embeds the Inertia page data) and the JSON of `GET /games/{room}/snapshot` fetched from inside each page, with the existing helper `gamePayloadExposesWord()` of `tests/Pest.php`.
- Step 4 says "the same letter twice shows a toast". A picked letter's key is disabled for everyone as soon as the pick is broadcast, so the toast only appears when two players pick the same letter before the broadcast arrives. `[P13a-04b]` arranges that race by writing the first pick straight to the database (no broadcast), then lets the guest press the key.

Facts about the interface that the selectors rely on (all read from the current code):

- The team page links to the games page with `<a href="/w/{slug}/teams/{team}/games">Games</a>` (`resources/js/pages/teams/show.tsx`). The games page (`resources/js/pages/games/index.tsx`) has the button "New room"; its dialog (`new-room-dialog.tsx`) has `#new-room-name`, the Radix selects `#new-room-game` and `#new-room-access`, and the button "Create room". The first game offered is "Draw & Guess", so the test chooses "Hangman".
- The room page (`resources/js/components/games/game-room.tsx`) uses no layout: its only `<header>` is the room header, its only `<main>` holds the board or the end card, its only `<aside>` holds the players and scores.
- Room header (`room-header.tsx`): `<h1>` with the room name as a direct child of `<header>`; `button[aria-label="Copy guest link"]` for managers of a link room; the presence strip `[role="group"][aria-label="2 online"]` with `img[data-presence-id][alt="<name>"]`; `[aria-label="Language"]` for guests only; `[aria-label="Back to the team"]` for members only.
- Guest join page (`resources/js/pages/games/join.tsx`, URL `/play/{guest_token}`): heading = the room name, the sentence "You are invited to play Hangman. Choose the name other players will see.", `#name` prefilled with an "Adjective Animal" suggestion from `resources/games/guest-names/en.php`, and the button "Join". `$this->joinAsGuest()` works on it unchanged.
- Before a round: "Ready to play?" with the button "Start" for the host and "Waiting for the host to start." for everyone else (`round-end-card.tsx`, `start-round-controls.tsx`).
- Hangman board (`hangman-board.tsx`): the keyboard is `[role="group"][aria-label="Letters"]` with 26 buttons whose text is one lowercase letter (shown uppercase by CSS); a picked letter is `aria-pressed="true"` and disabled. The mask is `[role="img"][aria-label="<n> letters left to find"]` with one `<span>` per letter (empty while hidden). The figure is `svg[role="img"][aria-label="<n> of 6 misses"]` with four fixed lines plus one part per miss. The last picks are `ul[aria-label="Last letters"]` with items such as "Ada Host picked Q".
- End card (`round-end-card.tsx`): a badge with the outcome ("Solved"), the word, "<name> found it!", the list `[aria-label="Points of this round"]` with "+6 Visitor", and "Next round" for the host. The winner carries `[aria-label="Winner"]` in the players list.
- History (`history-drawer.tsx`, `round-detail.tsx`): the button "History" opens a sheet (`[role="dialog"]`) titled "Last rounds"; each round is a button showing its word and outcome; the detail of a Hangman round shows the full mask and "Letters tried: Q U A R T Z".
- Letter picks are limited to a burst of three per player, then one per second (`GameLettersController`). Every test keeps each player at three picks or fewer.
- The word of a round started through the interface comes from `App\Support\Games\GameWordBook`, which `DrawGameWord` receives from the container. `GameWordBook` accepts its word list as a constructor argument, so a test that presses "Start" binds an instance with one word: `app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => 'quartz', 'drawable' => true]]]))`. This is the product class with a one-word list, not a fake. Tests that begin in the middle of a round fix the word with the factory instead (`activeGameRound($room, ['word' => 'quartz'])`).
- The word is "quartz": it appears nowhere in the interface, the translations or the class names, so its absence from the page source is meaningful. ("sprint", the factory default, appears in the game label "Sprint in one GIF".)

No product file changes in this task: every target has a role, an aria-label, an id or English text.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php`
- Test: `tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime(mixed $page): mixed` (plan 16a).
  - `data-realtime` on the root of `games/show` (plan 16a, `resources/js/components/games/game-room.tsx`).
  - Existing helpers in `tests/Pest.php`: `teamMember(Team $team): User`, `gameRoomHost(GameRoom $room): array{0: User, 1: GamePlayer}`, `activeGameRound(GameRoom $room, array $attributes = []): GameRound`, `gamePayloadExposesWord(array|string $payload, string $word): bool`.
  - Factories: `GameRoomFactory::linkAccess()`, `GameRoundFactory` through `activeGameRound()`.
  - `App\Support\Games\GameWordBook::__construct(?array $words = null, ?array $questions = null)`.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php` (global functions; later files must not redeclare them): `p13aRenamed(User $user, string $name): User`, `p13aRoom(array $attributes = []): array{room: GameRoom, ada: User, adaPlayer: GamePlayer}`, `p13aOnlyWord(string $word): void`, `p13aRoomPath(GameRoom $room): string`, `p13aJoinPath(GameRoom $room): string`, `p13aGuestPlayer(GameRoom $room, string $name): GamePlayer`, `p13aLetter(string $letter): string`, `p13aMaskScript(): string`, `p13aSnapshotScript(GameRoom $room): string`.
  - Stable selectors that need no hook, for reuse by Tasks 2 to 4: letter key `[role="group"][aria-label="Letters"] button:has-text("<letter>")`; mask `[role="img"][aria-label="<n> letters left to find"]`; presence `[role="group"][aria-label="<n> online"]`; end-card outcome badge `main [data-slot="badge"]` (single only while the round awarded no points); room menu `[aria-label="Room menu"]`; timer menu `[aria-label="Timer"]`; game switcher `button[aria-label="Game"]`.

- [ ] **Step 1: Create the test file with its helpers and the tests of steps 1 to 3**

`php artisan make:test` only writes under `tests/Feature` or `tests/Unit`, so create `tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php` directly with this content:

```php
<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Team;
use App\Models\User;
use App\Support\Games\GameWordBook;

function p13aRenamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     room: GameRoom,
 *     ada: User,
 *     adaPlayer: GamePlayer
 * }
 */
function p13aRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Lunch', ...$attributes]);
    [$ada, $adaPlayer] = gameRoomHost($room);

    $room->forceFill(['created_by_user_id' => $ada->id])->save();

    return [
        'room' => $room,
        'ada' => p13aRenamed($ada, 'Ada Host'),
        'adaPlayer' => $adaPlayer,
    ];
}

function p13aOnlyWord(string $word): void
{
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => $word, 'drawable' => true]]]));
}

function p13aRoomPath(GameRoom $room): string
{
    return "/games/{$room->id}";
}

function p13aJoinPath(GameRoom $room): string
{
    return "/play/{$room->guest_token}";
}

function p13aGuestPlayer(GameRoom $room, string $name): GamePlayer
{
    return GamePlayer::query()
        ->where('game_room_id', $room->id)
        ->where('guest_name', $name)
        ->sole();
}

function p13aLetter(string $letter): string
{
    return "[role=\"group\"][aria-label=\"Letters\"] button:has-text(\"{$letter}\")";
}

function p13aMaskScript(): string
{
    return 'Array.from(document.querySelectorAll(\'[role="img"][aria-label$="letters left to find"] span\')).map((cell) => cell.textContent || "_").join("")';
}

function p13aSnapshotScript(GameRoom $room): string
{
    return "() => fetch(\"/games/{$room->id}/snapshot\", { headers: { Accept: \"application/json\" } }).then((response) => response.text())";
}

it('[P13a-01] creates a Hangman room open by link from the team games page', function () {
    $team = Team::factory()->create();
    $ada = p13aRenamed(teamMember($team), 'Ada Host');
    $gamesPath = route('teams.games.index', [$team->workspace, $team], false);

    $page = $this->signIn($ada, route('teams.show', [$team->workspace, $team], false));

    $page->assertVisible('a[href$="/games"]')
        ->click('a[href$="/games"]')
        ->assertPathIs($gamesPath)
        ->assertSee('No game rooms yet.')
        ->click('New room')
        ->assertVisible('#new-room-name')
        ->fill('#new-room-name', 'Lunch')
        ->click('#new-room-game')
        ->assertVisible('[role="option"]:has-text("Hangman")')
        ->click('[role="option"]:has-text("Hangman")')
        ->assertSeeIn('#new-room-game', 'Hangman')
        ->click('#new-room-access')
        ->assertVisible('[role="option"]:has-text("Anyone with the link")')
        ->click('[role="option"]:has-text("Anyone with the link")')
        ->assertSeeIn('#new-room-access', 'Anyone with the link')
        ->click('Create room')
        ->assertPathBeginsWith('/games/');

    $room = GameRoom::query()->sole();

    $page->assertPathIs(p13aRoomPath($room))
        ->assertSeeIn('header > h1', 'Lunch')
        ->assertSee('Ready to play?')
        ->assertButtonEnabled('Start')
        ->assertVisible('[aria-label="Copy guest link"]');

    expect($room->name)->toBe('Lunch')
        ->and($room->game)->toBe(GameKind::Hangman)
        ->and($room->access)->toBe(GameRoomAccess::Link)
        ->and($room->created_by_user_id)->toBe($ada->id)
        ->and($room->host->user_id)->toBe($ada->id);

    $page->navigate($gamesPath)
        ->assertSee('Lunch')
        ->assertSee('Hangman')
        ->assertSee('Open by link');
});

it('[P13a-02] copies the guest link and lets a guest join under a suggested name', function () {
    ['room' => $room, 'ada' => $ada] = p13aRoom();

    $host = $this->awaitRealtime($this->signIn($ada, p13aRoomPath($room)));

    $host->assertVisible('[aria-label="Copy guest link"]');
    $host->script('() => { navigator.clipboard.writeText = (text) => { window.copiedGuestLink = text; return Promise.resolve(); }; return true; }');
    $host->click('[aria-label="Copy guest link"]')
        ->assertSee('Link copied');

    $joinUrl = (string) $host->script('() => window.copiedGuestLink');

    expect($joinUrl)->toEndWith(p13aJoinPath($room));

    $guest = visit($joinUrl);

    $guest->assertSee('Lunch')
        ->assertSee('You are invited to play Hangman. Choose the name other players will see.')
        ->assertSee('Display name')
        ->assertVisible('#name');

    [$adjective, $animal] = explode(' ', $guest->value('#name'));
    $names = require resource_path('games/guest-names/en.php');

    expect(array_column($names['adjectives'], 'n'))->toContain($adjective)
        ->and(array_column($names['animals'], 'name'))->toContain($animal);

    $guest->fill('#name', 'Visitor')
        ->click('Join')
        ->assertPathIs(p13aRoomPath($room));
    $this->awaitRealtime($guest);

    $guest->assertSeeIn('header > h1', 'Lunch')
        ->assertSee('Waiting for the host to start.')
        ->assertSeeIn('section[aria-labelledby="game-players"]', 'Visitor')
        ->assertSeeIn('section[aria-labelledby="game-players"]', '(guest)')
        ->assertVisible('[aria-label="Language"]')
        ->assertNotPresent('[aria-label="Back to the team"]')
        ->assertNotPresent('[aria-label="Room menu"]')
        ->assertNotPresent('[aria-label="Copy guest link"]');

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertPresent('img[data-presence-id][alt="Visitor"]')
        ->assertSeeIn('section[aria-labelledby="game-players"]', 'Visitor')
        ->assertVisible('[aria-label="Back to the team"]')
        ->assertNotPresent('[aria-label="Language"]');

    expect(p13aGuestPlayer($room, 'Visitor')->user_id)->toBeNull();
});

it('[P13a-03] starts a round for both players and keeps the word out of the page source and the snapshot', function () {
    p13aOnlyWord('quartz');
    ['room' => $room, 'ada' => $ada] = p13aRoom();

    $host = $this->awaitRealtime($this->signIn($ada, p13aRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(p13aJoinPath($room), 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertSee('Ready to play?');
    $guest->assertSee('Waiting for the host to start.');

    $host->click('Start');

    foreach ([$host, $guest] as $page) {
        $page->assertCount('[role="group"][aria-label="Letters"] button', 26)
            ->assertPresent('[role="img"][aria-label="6 letters left to find"]')
            ->assertScript(p13aMaskScript(), '______')
            ->assertSee('0 of 6 misses');
    }

    expect(GameRound::query()->sole()->word)->toBe('quartz');

    foreach ([$host, $guest] as $page) {
        $snapshot = (string) $page->script(p13aSnapshotScript($room));

        expect($snapshot)->toContain('"pickedLetters"')
            ->and(gamePayloadExposesWord($snapshot, 'quartz'))->toBeFalse()
            ->and(gamePayloadExposesWord($page->content(), 'quartz'))->toBeFalse();

        $this->awaitRealtime($page->navigate(p13aRoomPath($room)));

        $page->assertScript(p13aMaskScript(), '______');

        expect(gamePayloadExposesWord($page->content(), 'quartz'))->toBeFalse();
    }
});
```

Each player's page is checked twice in `[P13a-03]`: once as it stands after the live `game.round.started` event, and once after a reload, when the page source embeds the snapshot of the running round.

- [ ] **Step 2: Run the tests of steps 1 to 3**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php --filter='P13a-0[1-3]'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `[P13a-02]` never sees "Link copied" or reads an empty link, the clipboard replacement did not take: read the link from the snapshot instead (`json_decode((string) $host->script(p13aSnapshotScript($room)), true)['room']['guestUrl']`) and keep the click and the toast assertion only if the toast appears. If `[P13a-03]` finds another word than "quartz" in the database, the `GameWordBook` instance was not used. If either happens, see the harness findings.

- [ ] **Step 3: Append the tests of steps 4 and 5**

Add this import to the top of `tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php`, after `use App\Enums\GameRoomAccess;`:

```php
use App\Enums\GameRoundOutcome;
```

Append to the file:

```php
it('[P13a-04a] shows hits, misses, the figure and the last picks live to both players', function () {
    ['room' => $room, 'ada' => $ada] = p13aRoom();
    $round = activeGameRound($room, ['word' => 'quartz']);

    $host = $this->awaitRealtime($this->signIn($ada, p13aRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(p13aJoinPath($room), 'Visitor'));

    $host->assertEnabled(p13aLetter('q'))
        ->click(p13aLetter('q'));

    foreach ([$host, $guest] as $page) {
        $page->assertScript(p13aMaskScript(), 'q_____')
            ->assertAriaAttribute(p13aLetter('q'), 'pressed', 'true')
            ->assertDisabled(p13aLetter('q'))
            ->assertSeeIn('[aria-label="Last letters"]', 'Ada Host picked Q')
            ->assertCount('svg[role="img"][aria-label="0 of 6 misses"] > *', 4);
    }

    $guest->assertEnabled(p13aLetter('x'))
        ->click(p13aLetter('x'));

    foreach ([$host, $guest] as $page) {
        $page->assertSee('1 of 6 misses')
            ->assertCount('svg[role="img"][aria-label="1 of 6 misses"] > *', 5)
            ->assertSeeIn('[aria-label="Last letters"]', 'Visitor picked X')
            ->assertDisabled(p13aLetter('x'))
            ->assertScript(p13aMaskScript(), 'q_____');
    }

    $guest->assertEnabled(p13aLetter('u'))
        ->click(p13aLetter('u'));

    foreach ([$host, $guest] as $page) {
        $page->assertScript(p13aMaskScript(), 'qu____')
            ->assertPresent('[role="img"][aria-label="4 letters left to find"]')
            ->assertSeeIn('[aria-label="Last letters"]', 'Visitor picked U')
            ->assertSee('1 of 6 misses');
    }

    expect($round->fresh()->picked_letters)->toBe(['q', 'x', 'u'])
        ->and($round->fresh()->misses)->toBe(1);
});

it('[P13a-04b] tells a player with a toast that a letter was already picked', function () {
    ['room' => $room, 'adaPlayer' => $adaPlayer] = p13aRoom();
    $round = activeGameRound($room, ['word' => 'quartz']);

    $guest = $this->awaitRealtime($this->joinAsGuest(p13aJoinPath($room), 'Visitor'));

    $guest->assertEnabled(p13aLetter('q'))
        ->assertScript(p13aMaskScript(), '______');

    $round->forceFill([
        'picked_letters' => ['q'],
        'picked_by' => [$adaPlayer->id],
        'revealed_positions' => [0],
    ])->save();

    $guest->click(p13aLetter('q'))
        ->assertSee('This letter was already picked.')
        ->assertScript(p13aMaskScript(), 'q_____')
        ->assertDisabled(p13aLetter('q'));

    expect($round->fresh()->picked_letters)->toBe(['q'])
        ->and($round->fresh()->misses)->toBe(0);
});

it('[P13a-05] shows the solved word, the winner and the round in the history to both players', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13aRoom();
    $round = activeGameRound($room, [
        'word' => 'quartz',
        'picked_letters' => ['q', 'u', 'a', 'r', 't'],
        'picked_by' => array_fill(0, 5, $adaPlayer->id),
        'revealed_positions' => [0, 1, 2, 3, 4],
    ]);

    $host = $this->awaitRealtime($this->signIn($ada, p13aRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(p13aJoinPath($room), 'Visitor'));

    $host->assertScript(p13aMaskScript(), 'quart_');

    $guest->assertScript(p13aMaskScript(), 'quart_')
        ->assertEnabled(p13aLetter('z'))
        ->click(p13aLetter('z'));

    foreach ([$host, $guest] as $page) {
        $page->assertSee('Solved')
            ->assertSee('quartz')
            ->assertSee('Visitor found it!')
            ->assertSeeIn('[aria-label="Points of this round"]', '+6 Visitor')
            ->assertSeeIn('[aria-label="Points of this round"]', '+5 Ada Host')
            ->assertPresent('aside li:has-text("Visitor") [aria-label="Winner"]')
            ->assertNotPresent('[role="group"][aria-label="Letters"]');
    }

    $host->assertSee('Next round');
    $guest->assertSee('Waiting for the host to start.');

    $host->click('History')
        ->assertSee('Last rounds')
        ->assertVisible('[role="dialog"] li button:has-text("quartz")')
        ->assertSeeIn('[role="dialog"] li button:has-text("quartz")', 'Solved')
        ->click('[role="dialog"] li button:has-text("quartz")')
        ->assertSeeIn('[role="dialog"]', 'Visitor found it!')
        ->assertPresent('[role="dialog"] [role="img"][aria-label="0 letters left to find"]')
        ->assertSeeIn('[role="dialog"]', 'Letters tried: Q U A R T Z');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Solved)
        ->and($round->fresh()->winner_player_id)->toBe(p13aGuestPlayer($room, 'Visitor')->id);
});
```

`[P13a-05]` starts with five letters already found by the host, so the guest solves the word with one pick and nobody runs into the limit of three picks per second. The points follow spec §4.6: one point per position revealed (five for the host, one for the guest) and five more for the player who completes the word.

- [ ] **Step 4: Run the tests of steps 4 and 5**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php --filter='P13a-0[45]'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. A toast "Slow down a little." means a player made more than three picks in one second: the test must be rearranged, not the product.

- [ ] **Step 5: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector` and keep the result.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php
git commit -m "test(browser): cover the games foundation walkthrough: room, guest join and a Hangman round"
```

### Task 2: Games foundation walkthrough, steps 6 to 9 (timer, team-only access, player cap, delete)

This task automates steps 6, 7 and 9 of the plan 13a walkthrough (`docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md`, lines 10656 to 10659) and classifies step 8.

- Step 6 (the timer) uses the timer substitution of spec §3.6. The server ends a round two ways (`app/Actions/Games/ExpireGameRound.php`): the delayed job `App\Jobs\CloseExpiredGameRound`, which `ScheduleRoundExpiry` dispatches when a round starts or a timer is set while a round is running, and a lazy check in the `ResolveGamePlayer` middleware on every request to the room. `[P13a-06a]` proves the job: `database` queue, the host chooses "1 min" and presses "Start" in the interface, the test travels 61 seconds and runs one queued job. `[P13a-06b]` proves the lazy check ("with the queue worker stopped, it still ends on the next refresh"): the timer and the round are arranged with factories so no job exists, the test travels 61 seconds, and the host reloads.
- Step 7: when the host switches the room to team-only, the server broadcasts `game.room.changed`; the guest's page fetches a fresh snapshot, receives 403 and shows "Your access to this room has ended." at once. The walkthrough said "after the next action"; the test asserts what the product does. It also proves the guest is signed out: reloading the room sends the guest to `/login`, and the old join link answers "This guest link is no longer valid."
- Step 8 (the 13th session) is `residual`. The cap is the constant `GameRoom::MaxOnlinePlayers = 12` (`app/Models/GameRoom.php`), read in `BroadcastAuthorizationsController::authorizeGameChannel()`; no configuration key lowers it. The count comes from the live Reverb roster (`app/Support/Games/ReverbGamePresenceRoster.php` asks Reverb for the members of `presence-game.{room}`), so players created with factories do not count: only thirteen real sockets do, and the suite opens at most four contexts per test. The refusal itself stays covered by `tests/Feature/Games/GameBroadcastAuthorizationTest.php`. This task writes no test for step 8.
- Step 9: only the room's creator or a workspace admin sees "Delete room"; `p13aRoom()` makes the host the creator.

Facts about the interface that the selectors rely on:

- Timer (`room-timer.tsx`): the host's `button[aria-label="Timer"]` opens a menu with "1 min", "2 min", "3 min", "5 min", "10 min" and "Stop timer". Everyone sees the remaining time as a badge in the header ("0:59"); the browser's clock is not moved by `travel()`, so the test only asserts that the countdown is shown before the travel.
- After a timed-out round the end card shows the badge "Time's up" (`outcomes.ts`). The header's timer badge shows the same words once a fresh snapshot arrives, so the test scopes the assertion to `main [data-slot="badge"]`, which is a single element because a round nobody played awards no points.
- Room menu (`room-menu.tsx`): `button[aria-label="Room menu"]` with the items "Room settings", "Regenerate guest link" and "Delete room". Settings dialog (`room-settings-dialog.tsx`): `#room-name`, the Radix select `#room-access` with "Team members only" and "Anyone with the link", the hint "Guests in this room lose access.", and "Save". Delete dialog (`delete-room-dialog.tsx`): "Delete this room?", "Its rounds and scores are deleted for everyone.", and the button "Delete"; the host is then sent to the team page.
- `room-gone.tsx` shows "Your access to this room has ended." or "This room was deleted.", with "Back to the team" for members only.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php`
- Test: `tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php`

**Interfaces:**
- Consumes:
  - Everything Task 1 consumes, and Task 1's helpers `p13aRoom()`, `p13aOnlyWord()`, `p13aRoomPath()`, `p13aJoinPath()`.
  - `$this->workQueue(): void` in `Tests\Browser\Support\InteractsWithBrowser` (plan 16b, Task 1): it rebinds a fresh request, then runs `queue:work --once`. If that task has not landed, add to this file the helper `p13aWorkQueue(TestCase $test): void` with the body of `p10bWorkQueueOutsideAnyRequest()` from `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php` (and its two imports, `Illuminate\Http\Request` and `Tests\TestCase`), and call `p13aWorkQueue($this)` instead.
- Produces: no helper and no hook.

- [ ] **Step 1: Append the timer tests (step 6)**

Add this import to the top of `tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php`, after `use App\Support\Games\GameWordBook;`:

```php
use Illuminate\Support\Facades\DB;
```

Append to the file:

```php
it('[P13a-06a] ends a round as "Time\'s up" when the one-minute timer of the host runs out', function () {
    config(['queue.default' => 'database']);
    p13aOnlyWord('quartz');
    ['room' => $room, 'ada' => $ada] = p13aRoom();

    $host = $this->awaitRealtime($this->signIn($ada, p13aRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(p13aJoinPath($room), 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('[aria-label="Timer"]')
        ->assertVisible('[role="menuitem"]:has-text("1 min")')
        ->click('[role="menuitem"]:has-text("1 min")');

    foreach ([$host, $guest] as $page) {
        $page->assertSee('0:5');
    }

    expect(DB::table('jobs')->count())->toBe(0);

    $host->assertNotPresent('[role="menu"]')
        ->click('Start');

    foreach ([$host, $guest] as $page) {
        $page->assertCount('[role="group"][aria-label="Letters"] button', 26);
    }

    $round = GameRound::query()->sole();

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($round->ended_at)->toBeNull();

    $this->travel(61)->seconds();
    $this->workQueue();

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('main [data-slot="badge"]', "Time's up")
            ->assertSee('quartz')
            ->assertNotPresent('[role="group"][aria-label="Letters"]');
    }

    $host->assertSee('Next round');
    $guest->assertSee('Waiting for the host to start.');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut)
        ->and(DB::table('jobs')->count())->toBe(0);
});

it('[P13a-06b] ends an expired round on the next request when no queue worker runs', function () {
    ['room' => $room, 'ada' => $ada] = p13aRoom(['timer_ends_at' => now()->addMinute()->startOfSecond()]);
    $round = activeGameRound($room, ['word' => 'quartz']);

    $host = $this->awaitRealtime($this->signIn($ada, p13aRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(p13aJoinPath($room), 'Visitor'));

    foreach ([$host, $guest] as $page) {
        $page->assertCount('[role="group"][aria-label="Letters"] button', 26);
    }

    $this->travel(61)->seconds();

    expect($round->fresh()->ended_at)->toBeNull();

    $this->awaitRealtime($host->navigate(p13aRoomPath($room)));

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('main [data-slot="badge"]', "Time's up")
            ->assertSee('quartz')
            ->assertNotPresent('[role="group"][aria-label="Letters"]');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
});
```

In `[P13a-06b]` only the host reloads. The guest's page is not touched: it learns of the end through the `game.round.ended` broadcast that the host's request triggers, which is the realtime half of the lazy check.

- [ ] **Step 2: Run the timer tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php --filter='P13a-06'`
Expected: PASS (2 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the pages of `[P13a-06a]` never show "Time's up" while the database says the round timed out, the job's broadcast skipped a page: see the note on `workQueue()` in the harness findings.

- [ ] **Step 3: Append the tests of steps 7 and 9**

Append to `tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php`:

```php
it('[P13a-07] renames the room and ends the access of guests when it becomes team-only', function () {
    ['room' => $room, 'ada' => $ada] = p13aRoom();

    $host = $this->awaitRealtime($this->signIn($ada, p13aRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(p13aJoinPath($room), 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('[aria-label="Room menu"]')
        ->assertVisible('[role="menuitem"]:has-text("Room settings")')
        ->click('[role="menuitem"]:has-text("Room settings")')
        ->assertVisible('#room-name')
        ->assertValue('#room-name', 'Lunch')
        ->fill('#room-name', 'Lunch break')
        ->click('#room-access')
        ->assertVisible('[role="option"]:has-text("Team members only")')
        ->click('[role="option"]:has-text("Team members only")')
        ->assertSee('Guests in this room lose access.')
        ->click('Save')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn('header > h1', 'Lunch break')
        ->assertNotPresent('[aria-label="Copy guest link"]');

    $guest->assertSee('Your access to this room has ended.')
        ->assertDontSee('Back to the team')
        ->assertNotPresent('header > h1');

    $host->assertPresent('[role="group"][aria-label="1 online"]');

    $guest->navigate(p13aRoomPath($room))
        ->assertPathIs('/login');

    visit(p13aJoinPath($room))->assertSee('This guest link is no longer valid.');

    expect($room->fresh()->name)->toBe('Lunch break')
        ->and($room->fresh()->access)->toBe(GameRoomAccess::Team);
});

it('[P13a-09] deletes the room, sends its creator to the team page and tells the guest', function () {
    ['room' => $room, 'ada' => $ada] = p13aRoom();
    $teamPath = route('teams.show', [$room->team->workspace, $room->team], false);

    $host = $this->awaitRealtime($this->signIn($ada, p13aRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(p13aJoinPath($room), 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('[aria-label="Room menu"]')
        ->assertVisible('[role="menuitem"]:has-text("Delete room")')
        ->click('[role="menuitem"]:has-text("Delete room")')
        ->assertSee('Delete this room?')
        ->assertSee('Its rounds and scores are deleted for everyone.')
        ->click('[role="dialog"] button:has-text("Delete")');

    $host->assertPathIs($teamPath);

    $guest->assertSee('This room was deleted.')
        ->assertDontSee('Back to the team');

    expect(GameRoom::query()->whereKey($room->id)->exists())->toBeFalse();
});
```

- [ ] **Step 4: Run the tests of steps 7 and 9**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php --filter='P13a-0[79]'`
Expected: PASS (2 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector` and keep the result.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php`
Expected: PASS (10 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php
git commit -m "test(browser): cover the games foundation walkthrough: timer, team-only access and delete"
```

### Task 3: Draw & Guess walkthrough, steps 1 to 10 (drawing, late joiner, guesses, hints, rotation)

This task automates steps 1 to 10 of the plan 13b walkthrough (`docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md`, lines 5573 to 5582).

**How a drawing travels** (read in `drawing-canvas.tsx`, `draw-board.tsx`, `use-stroke-whispers.ts`, `GameDrawingOpsController`, `GameLastDrawingOpsController`, `GameDrawingsController`):

- The drawer's `<canvas aria-label="Your drawing">` handles `pointerdown`, `pointermove`, `pointerup`. While the pointer is down, the points drawn so far are whispered every 40 ms on the presence channel (`client-game-stroke`, at most 100 points per message). Viewers (`<canvas aria-label="The drawing">`) draw these as a live preview and drop a preview that got no update for 3 seconds.
- On `pointerup` the drawer POSTs the whole stroke to `games/{room}/rounds/{round}/drawing-ops`; the server stores it in `game_rounds.drawing` and broadcasts `game.drawing.op-added`; viewers replace the preview with the committed operation. A stroke that reaches 400 points is committed by itself and a new stroke starts at its last point.
- The fill tool commits on `pointerdown`. "Undo" (`[aria-label="Undo"]`) sends `DELETE …/drawing-ops/last`. "Clear" asks for a second click ("Click again to clear") and sends `DELETE …/drawing`.
- Drawing requests are limited to 20 per second with a burst of 20; no test comes near it.
- Committed operations are rasterised on an 800 x 600 grid by `resources/js/lib/games/drawing.ts`, identically on every client. The logical canvas is 1000 x 750, so a logical point `(x, y)` is the raster pixel `(0.8x, 0.8y)`. Black is `rgb(23 23 23)`, red is `rgb(220 38 38)`, the background is white.

**How the tests draw.** The plugin has no pointer API for a canvas beyond `click`, `hover` and `drag`, so the tests dispatch `PointerEvent`s on the drawer's canvas with `script()` (brief, "Canvas drawing"). The helper `p13bPointer()` takes positions as fractions of the canvas box, so it does not depend on the canvas's size on screen. A synthetic pointer is not an "active pointer" for the browser, and `setPointerCapture()` throws for it, which would abort the product's `pointerdown` handler; the helper therefore replaces `setPointerCapture` on that one canvas element with a function that does nothing. The tests then read single pixels of the other page's canvas with `getImageData()`. Every row that depends on this is `auto-substituted`, and the technique is unproven until this task runs (see the run step).

**What stays manual.** Step 5 asked to compare screenshots of the fill on a desktop and a phone, and step 4 asked for a finger on a phone. `[P13b-05a]` asserts that the fill has the same pixels on both pages (three sampled pixels and a checksum of the whole canvas), but both pages run in the same Chromium on the same machine, so the comparison across real devices and the touch input stay in the residual checklist (`P13b-04t`, `P13b-05b`).

Other facts about the interface that the selectors rely on:

- Game switcher (`game-switcher.tsx`): the host's `button[aria-label="Game"]`, a Radix select with "Draw & Guess", "Hangman", "Decoded".
- Start controls for Draw & Guess and Decoded (`start-round-controls.tsx`, `leader-picker.tsx`): with fewer than two players online, "Waiting for another player" and a disabled "Start"; otherwise the label "Who draws?" and the Radix select `button[aria-label="Who draws?"]`, preselected by `nextLeaderId()` (`resources/js/lib/games/rotation.ts`): the next online player after the previous leader in join order, or the first online player in join order when there is no previous leader. On a room's first round that is the host, not the guest as the walkthrough said (feature spec §4.1); the test asserts the host is preselected and then chooses the guest.
- Draw board (`draw-board.tsx`): the drawer sees "Your word to draw" with the word, the toolbar `[role="toolbar"][aria-label="Drawing tools"]` (colours `[aria-label="Red"]`…, tools `[aria-label="Pen"]`, `[aria-label="Eraser"]`, `[aria-label="Fill"]`, `[aria-label="Undo"]`, the button "Clear") and the button "Reveal a letter (2 left)"; everyone else sees the mask and "<name> is drawing".
- Guess chat (`guess-chat.tsx`): `section[aria-labelledby="game-guesses"]` with `input[aria-label="Your guess"]` and a submit button "Guess" for guessers, "You know the word, so you cannot guess." for the drawer, and the badge "Very close!" on the guesser's own near misses. Guesses are limited to a burst of three per player.
- The leader or the host ends a round with the button "Pass" (`pass-round-button.tsx`).
- Scores (`room-sidebar.tsx`, `room-scores.tsx`): the tab `[role="tab"]` "Scores" lists each player's total as `[aria-label="10 points"]`.
- Words: "lantern" for most tests (it appears nowhere in the interface); "lamp" for the hint test (four letters, so two hints). A near miss of "lantern" is "lanterns" (`GuessMatch`: up to two edits for a word longer than four letters); "LÀNTERN" is correct because both sides are folded to ASCII and lowercased.
- Most tests use a second team member, "Bob Leader", as the drawer instead of the walkthrough's guest on a phone, so the round can be arranged with factories before the browsers open. The guest's path into a Draw & Guess round is covered by `[P13b-02]`.

No product file changes in this task.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`
- Test: `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn()`, `$this->joinAsGuest()`, `$this->awaitRealtime()` (plan 16a); `data-realtime` on `games/show`.
  - Existing helpers in `tests/Pest.php`: `teamMember(Team $team): User`, `gameRoomHost(GameRoom $room): array{0: User, 1: GamePlayer}`, `gameRoomMember(GameRoom $room): array{0: User, 1: GamePlayer}`, `activeGameRound(GameRoom $room, array $attributes = []): GameRound`, `gamePayloadExposesWord(array|string $payload, string $word): bool`.
  - Factories: `GameRoomFactory::game()`, `linkAccess()`; `GameRoundFactory::game()`, `word()`, `ledBy()`, `ended()`.
  - `App\Support\Games\GameWordBook::__construct(?array $words = null, ?array $questions = null)`.
  - This file does not call the `p13a*` helpers of Task 1; it declares its own.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`: `p13bRenamed(User $user, string $name): User`, `p13bRoom(GameKind $game): array{room: GameRoom, ada: User, adaPlayer: GamePlayer}`, `p13bTable(GameKind $game, string $word, array $roundAttributes = []): array{room: GameRoom, ada: User, adaPlayer: GamePlayer, bob: User, bobPlayer: GamePlayer, round: GameRound}`, `p13bOnlyWord(string $word): void`, `p13bLine(): array`, `p13bPointer(mixed $page, string $type, array $points, string $label = 'Your drawing'): void`, `p13bPixelScript(string $label, int $x, int $y): string`, `p13bChecksumScript(string $label): string`, `p13bDrawingLengthScript(GameRoom $room): string`, `p13bSnapshotScript(GameRoom $room): string`, `p13bGuess(mixed $page, string $text): void`.

- [ ] **Step 1: Create the test file with its helpers and the tests of steps 1 to 3**

Create `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php` directly with this content:

```php
<?php

use App\Enums\GameKind;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use App\Support\Games\GameWordBook;

function p13bRenamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @return array{
 *     room: GameRoom,
 *     ada: User,
 *     adaPlayer: GamePlayer
 * }
 */
function p13bRoom(GameKind $game): array
{
    $room = GameRoom::factory()->game($game)->linkAccess()->create(['name' => 'Standup games']);
    [$ada, $adaPlayer] = gameRoomHost($room);

    $room->forceFill(['created_by_user_id' => $ada->id])->save();
    $adaPlayer->forceFill(['created_at' => now()->subMinutes(5)])->save();

    return [
        'room' => $room,
        'ada' => p13bRenamed($ada, 'Ada Host'),
        'adaPlayer' => $adaPlayer,
    ];
}

/**
 * @param  array<string, mixed>  $roundAttributes
 * @return array{
 *     room: GameRoom,
 *     ada: User,
 *     adaPlayer: GamePlayer,
 *     bob: User,
 *     bobPlayer: GamePlayer,
 *     round: GameRound
 * }
 */
function p13bTable(GameKind $game, string $word, array $roundAttributes = []): array
{
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13bRoom($game);
    [$bob, $bobPlayer] = gameRoomMember($room);

    return [
        'room' => $room,
        'ada' => $ada,
        'adaPlayer' => $adaPlayer,
        'bob' => p13bRenamed($bob, 'Bob Leader'),
        'bobPlayer' => $bobPlayer,
        'round' => activeGameRound($room, ['word' => $word, 'leader_player_id' => $bobPlayer->id, ...$roundAttributes]),
    ];
}

function p13bOnlyWord(string $word): void
{
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => $word, 'drawable' => true]]]));
}

/**
 * @return array{
 *     type: string,
 *     color: string,
 *     size: int,
 *     points: array<int, array<int, int>>
 * }
 */
function p13bLine(): array
{
    return ['type' => 'stroke', 'color' => 'black', 'size' => 10, 'points' => [[250, 375], [750, 375]]];
}

/**
 * @param  array<int, array<int, float>>  $points
 */
function p13bPointer(mixed $page, string $type, array $points, string $label = 'Your drawing'): void
{
    $path = json_encode($points);

    $page->script(<<<JS
        () => {
            const canvas = document.querySelector('canvas[aria-label="{$label}"]');
            const box = canvas.getBoundingClientRect();
            canvas.setPointerCapture = () => {};
            for (const [x, y] of {$path}) {
                canvas.dispatchEvent(new PointerEvent("{$type}", {
                    bubbles: true,
                    cancelable: true,
                    pointerId: 1,
                    pointerType: "mouse",
                    isPrimary: true,
                    button: 0,
                    buttons: 1,
                    clientX: box.left + box.width * x,
                    clientY: box.top + box.height * y,
                }));
            }
            return true;
        }
        JS);
}

function p13bPixelScript(string $label, int $x, int $y): string
{
    return "Array.from(document.querySelector('canvas[aria-label=\"{$label}\"]').getContext('2d').getImageData({$x}, {$y}, 1, 1).data).join(' ')";
}

function p13bChecksumScript(string $label): string
{
    return "() => { const canvas = document.querySelector('canvas[aria-label=\"{$label}\"]'); const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; let sum = 0; for (let index = 0; index < data.length; index += 1) { sum = (sum * 31 + data[index]) % 2147483647; } return String(sum); }";
}

function p13bDrawingLengthScript(GameRoom $room): string
{
    return "() => fetch(\"/games/{$room->id}/snapshot\", { headers: { Accept: \"application/json\" } }).then((response) => response.json()).then((snapshot) => snapshot.round.drawing.length)";
}

function p13bSnapshotScript(GameRoom $room): string
{
    return "() => fetch(\"/games/{$room->id}/snapshot\", { headers: { Accept: \"application/json\" } }).then((response) => response.text())";
}

function p13bGuess(mixed $page, string $text): void
{
    $page->assertVisible('input[aria-label="Your guess"]')
        ->fill('input[aria-label="Your guess"]', $text)
        ->click('section[aria-labelledby="game-guesses"] button[type="submit"]');
}

it('[P13b-01] waits for another player when the host switches to Draw & Guess alone', function () {
    ['room' => $room, 'ada' => $ada] = p13bRoom(GameKind::Hangman);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $host->assertSee('Ready to play?')
        ->assertButtonEnabled('Start')
        ->click('button[aria-label="Game"]')
        ->assertVisible('[role="option"]:has-text("Draw & Guess")')
        ->click('[role="option"]:has-text("Draw & Guess")')
        ->assertSeeIn('button[aria-label="Game"]', 'Draw & Guess')
        ->assertSee('Waiting for another player')
        ->assertButtonDisabled('Start')
        ->assertNotPresent('button[aria-label="Who draws?"]');

    expect($room->fresh()->game)->toBe(GameKind::DrawAndGuess);
});

it('[P13b-02] lets the host choose the drawer once a guest has joined and starts the round', function () {
    p13bOnlyWord('lantern');
    ['room' => $room, 'ada' => $ada] = p13bRoom(GameKind::DrawAndGuess);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $host->assertSee('Waiting for another player')
        ->assertButtonDisabled('Start');

    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertDontSee('Waiting for another player')
        ->assertSee('Who draws?')
        ->assertSeeIn('button[aria-label="Who draws?"]', 'Ada Host')
        ->click('button[aria-label="Who draws?"]')
        ->assertVisible('[role="option"]:has-text("Visitor")')
        ->click('[role="option"]:has-text("Visitor")')
        ->assertSeeIn('button[aria-label="Who draws?"]', 'Visitor')
        ->click('Start');

    $guest->assertSee('Your word to draw')
        ->assertSee('lantern')
        ->assertVisible('canvas[aria-label="Your drawing"]')
        ->assertVisible('[role="toolbar"][aria-label="Drawing tools"]')
        ->assertSee('You know the word, so you cannot guess.');

    $host->assertSee('Visitor is drawing')
        ->assertPresent('[role="img"][aria-label="7 letters left to find"]')
        ->assertVisible('canvas[aria-label="The drawing"]')
        ->assertVisible('input[aria-label="Your guess"]')
        ->assertNotPresent('[role="toolbar"][aria-label="Drawing tools"]');

    $round = GameRound::query()->sole();
    $visitor = GamePlayer::query()->where('game_room_id', $room->id)->where('guest_name', 'Visitor')->sole();

    expect($round->word)->toBe('lantern')
        ->and($round->leader_player_id)->toBe($visitor->id);
});

it('[P13b-03] gives the word to the drawer and keeps it out of the page source and the snapshot of a guesser', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::DrawAndGuess, 'lantern');

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $drawer->assertSee('Your word to draw')
        ->assertSee('lantern')
        ->assertVisible('canvas[aria-label="Your drawing"]');

    $guesser->assertSee('Bob Leader is drawing')
        ->assertPresent('[role="img"][aria-label="7 letters left to find"]')
        ->assertVisible('canvas[aria-label="The drawing"]')
        ->assertDontSee('lantern');

    $guesserSnapshot = (string) $guesser->script(p13bSnapshotScript($room));
    $drawerSnapshot = (string) $drawer->script(p13bSnapshotScript($room));

    expect($guesserSnapshot)->toContain('"maxHints"')
        ->and(gamePayloadExposesWord($guesserSnapshot, 'lantern'))->toBeFalse()
        ->and(gamePayloadExposesWord($guesser->content(), 'lantern'))->toBeFalse()
        ->and(gamePayloadExposesWord($drawerSnapshot, 'lantern'))->toBeTrue();

    $secretStatus = $guesser->script("() => fetch(\"/games/{$room->id}/rounds/{$round->id}/secret\", { headers: { Accept: \"application/json\" } }).then((response) => response.status)");

    expect($secretStatus)->toBe(403);
});
```

Both players of `[P13b-03]` open the room while the round is already running, so each page source embeds that player's own snapshot: the drawer's contains the word, the guesser's must not.

- [ ] **Step 2: Run the tests of steps 1 to 3**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php --filter='P13b-0[1-3]'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `[P13b-02]` shows another name than "Ada Host" in the picker before the choice, read `nextLeaderId()` again before changing the test: the feature spec (§4.1) says the first online player in join order is preselected when no round was led yet.

- [ ] **Step 3: Append the drawing tests (steps 4 to 6)**

Append to `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`:

```php
it('[P13b-04a] shows a line to the other player while it is drawn and keeps it after the pointer lifts', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::DrawAndGuess, 'lantern');

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $viewer = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $drawer->assertVisible('canvas[aria-label="Your drawing"]');
    $viewer->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertScript(p13bPixelScript('The drawing', 400, 300), '255 255 255 255');

    p13bPointer($drawer, 'pointerdown', [[0.25, 0.5]]);
    p13bPointer($drawer, 'pointermove', [[0.35, 0.5], [0.5, 0.5], [0.65, 0.5], [0.75, 0.5]]);

    $viewer->assertScript(p13bPixelScript('The drawing', 400, 300), '23 23 23 255');

    expect($round->fresh()->drawing)->toBe([]);

    p13bPointer($drawer, 'pointerup', [[0.75, 0.5]]);

    $drawer->assertScript(p13bDrawingLengthScript($room), 1)
        ->assertScript(p13bPixelScript('Your drawing', 400, 300), '23 23 23 255')
        ->assertEnabled('[aria-label="Undo"]');

    $viewer->assertScript(p13bPixelScript('The drawing', 400, 300), '23 23 23 255')
        ->assertScript(p13bPixelScript('The drawing', 400, 100), '255 255 255 255');

    $drawing = $round->fresh()->drawing;

    expect($drawing)->toHaveCount(1)
        ->and($drawing[0]['type'])->toBe('stroke')
        ->and($drawing[0]['color'])->toBe('black')
        ->and($drawing[0]['size'])->toBe(10)
        ->and($drawing[0]['points'][0])->toBe([250, 375])
        ->and(end($drawing[0]['points']))->toBe([750, 375]);
});

it('[P13b-04b] commits a long stroke in two parts that join without a gap', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::DrawAndGuess, 'lantern');
    $path = array_map(fn (int $step): array => [(100 + $step) / 1000, 0.4], range(0, 450));

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $viewer = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $drawer->assertVisible('canvas[aria-label="Your drawing"]');
    $viewer->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertScript(p13bPixelScript('The drawing', 240, 240), '255 255 255 255');

    p13bPointer($drawer, 'pointerdown', [$path[0]]);
    p13bPointer($drawer, 'pointermove', array_slice($path, 1));
    p13bPointer($drawer, 'pointerup', [$path[450]]);

    $drawer->assertScript(p13bDrawingLengthScript($room), 2);

    foreach ([240, 399, 432] as $x) {
        $viewer->assertScript(p13bPixelScript('The drawing', $x, 240), '23 23 23 255');
    }

    $viewer->assertScript(p13bPixelScript('The drawing', 600, 240), '255 255 255 255');

    $drawing = $round->fresh()->drawing;

    expect($drawing)->toHaveCount(2)
        ->and($drawing[0]['points'])->toHaveCount(400)
        ->and($drawing[1]['points'])->toHaveCount(52)
        ->and($drawing[0]['points'][0])->toBe([100, 300])
        ->and($drawing[1]['points'][0])->toBe($drawing[0]['points'][399])
        ->and(end($drawing[1]['points']))->toBe([550, 300])
        ->and($round->fresh()->drawing_points)->toBe(452);
});

it('[P13b-05a] fills a closed shape identically for both players, undoes the fill and clears the drawing after a second click', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::DrawAndGuess, 'lantern');

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $viewer = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $drawer->assertVisible('canvas[aria-label="Your drawing"]')
        ->assertDisabled('[aria-label="Undo"]');
    $viewer->assertPresent('[role="group"][aria-label="2 online"]');

    p13bPointer($drawer, 'pointerdown', [[0.3, 0.3]]);
    p13bPointer($drawer, 'pointermove', [[0.7, 0.3], [0.7, 0.7], [0.3, 0.7], [0.3, 0.3]]);
    p13bPointer($drawer, 'pointerup', [[0.3, 0.3]]);

    $drawer->assertScript(p13bDrawingLengthScript($room), 1)
        ->click('[aria-label="Red"]')
        ->assertAriaAttribute('[aria-label="Red"]', 'pressed', 'true')
        ->click('[aria-label="Fill"]')
        ->assertAriaAttribute('[aria-label="Fill"]', 'pressed', 'true');

    p13bPointer($drawer, 'pointerdown', [[0.5, 0.5]]);

    $drawer->assertScript(p13bDrawingLengthScript($room), 2);

    foreach ([[$drawer, 'Your drawing'], [$viewer, 'The drawing']] as [$page, $label]) {
        $page->assertScript(p13bPixelScript($label, 400, 300), '220 38 38 255')
            ->assertScript(p13bPixelScript($label, 240, 300), '23 23 23 255')
            ->assertScript(p13bPixelScript($label, 100, 100), '255 255 255 255');
    }

    $viewer->assertScript(p13bChecksumScript('The drawing'), (string) $drawer->script(p13bChecksumScript('Your drawing')));

    $drawer->click('[aria-label="Undo"]');

    foreach ([[$drawer, 'Your drawing'], [$viewer, 'The drawing']] as [$page, $label]) {
        $page->assertScript(p13bPixelScript($label, 400, 300), '255 255 255 255')
            ->assertScript(p13bPixelScript($label, 240, 300), '23 23 23 255');
    }

    expect($round->fresh()->drawing)->toHaveCount(1);

    $drawer->click('button:has-text("Clear")')
        ->assertSee('Click again to clear');

    expect($round->fresh()->drawing)->toHaveCount(1);

    $drawer->click('button:has-text("Click again to clear")');

    foreach ([[$drawer, 'Your drawing'], [$viewer, 'The drawing']] as [$page, $label]) {
        $page->assertScript(p13bPixelScript($label, 240, 300), '255 255 255 255');
    }

    $drawer->assertDisabled('[aria-label="Undo"]');

    expect($round->fresh()->drawing)->toBe([]);
});

it('[P13b-06] shows the committed drawing at once to a player who joins in the middle of the round', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob] = p13bTable(GameKind::DrawAndGuess, 'lantern', [
        'drawing' => [p13bLine()],
        'drawing_points' => 2,
    ]);
    $cleo = p13bRenamed(teamMember($room->team), 'Cleo Late');

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $guesser->assertPresent('[role="group"][aria-label="2 online"]');

    $late = $this->awaitRealtime($this->signIn($cleo, "/games/{$room->id}"));

    $late->assertSee('Bob Leader is drawing')
        ->assertScript(p13bPixelScript('The drawing', 400, 300), '23 23 23 255')
        ->assertScript(p13bPixelScript('The drawing', 400, 100), '255 255 255 255')
        ->assertVisible('input[aria-label="Your guess"]');

    $drawer->assertPresent('[role="group"][aria-label="3 online"]')
        ->assertSeeIn('section[aria-labelledby="game-players"]', 'Cleo Late');
});
```

Where the numbers come from:

- `[P13b-04a]` draws from 25 % to 75 % of the width at half the height: logical `(250, 375)` to `(750, 375)`, raster `(200, 300)` to `(600, 300)`. Pixel `(400, 300)` is on the line; pixel `(400, 100)` is not. The viewer's pixel is asserted before `pointerup`, while the database still holds no operation, so only the whisper can have drawn it.
- `[P13b-04b]` sends one `pointerdown` and 450 `pointermove`s along logical `x = 100…550`, `y = 300` (raster row 240). The product commits the first 400 points by itself (`MaxStrokePoints`), starts the next stroke at the 400th point, and commits the rest on `pointerup`: two operations of 400 and 52 points, the second starting where the first ends. Raster column 399 is the joint.
- `[P13b-05a]` draws a square with corners at 30 % and 70 %: raster `(240, 180)` to `(560, 420)`. `(400, 300)` is inside, `(240, 300)` is on the left edge, `(100, 100)` is outside.

- [ ] **Step 4: Run the drawing tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php --filter='P13b-0[456]'`
Expected: PASS (4 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. This is the first run of the canvas technique, so read a failure in this order:

1. If the drawer's own pixel never turns dark, the synthetic pointer events did not reach the product's handlers. Run the test with `--headed --debug` and check in the page that `canvas.setPointerCapture` is the replacement and that no error is logged.
2. If the drawer's pixel is dark but the viewer's is still white before `pointerup` in `[P13b-04a]`, the whisper did not arrive within the 3 seconds a preview lives. Check that both pages show "2 online" before the first event.
3. If a pixel is dark but not exactly `23 23 23 255` on the live preview, the browser anti-aliased the centre of the line; in `[P13b-04a]` replace that one assertion (the one before `pointerup`) by a test for "not white": `->assertScript(p13bPixelScript('The drawing', 400, 300).' !== "255 255 255 255"', true)`. Committed operations are not anti-aliased, so every assertion after a commit keeps its exact value.

If none of these applies, see the harness findings.

- [ ] **Step 5: Append the tests of guesses, hints and rotation (steps 7 to 10)**

Add these imports to the top of `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`, keeping the list in alphabetical order:

```php
use App\Enums\GameRoundOutcome;
use App\Models\GameGuess;
```

Append to the file:

```php
it('[P13b-07] shows a wrong guess and a near miss to everyone and "Very close!" to the guesser only', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::DrawAndGuess, 'lantern');
    $chat = 'section[aria-labelledby="game-guesses"]';

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $guesser->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertSee('No guesses yet.');

    p13bGuess($guesser, 'planet');

    $guesser->assertValue('input[aria-label="Your guess"]', '')
        ->assertSeeIn($chat, 'planet')
        ->assertDontSee('Very close!');

    $drawer->assertSeeIn($chat, 'Ada Host')
        ->assertSeeIn($chat, 'planet');

    p13bGuess($guesser, 'lanterns');

    $guesser->assertSeeIn($chat, 'lanterns')
        ->assertSee('Very close!');

    $drawer->assertSeeIn($chat, 'lanterns')
        ->assertDontSee('Very close!');

    $this->awaitRealtime($guesser->navigate("/games/{$room->id}"));
    $this->awaitRealtime($drawer->navigate("/games/{$room->id}"));

    $guesser->assertSeeIn($chat, 'lanterns')
        ->assertSee('Very close!');

    $drawer->assertSeeIn($chat, 'lanterns')
        ->assertDontSee('Very close!');

    expect($round->fresh()->ended_at)->toBeNull()
        ->and(GameGuess::query()->where('game_round_id', $round->id)->where('is_near_miss', true)->pluck('text')->all())->toBe(['lanterns']);
});

it('[P13b-08] reveals letters to the guessers until half the word is shown', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::DrawAndGuess, 'lamp');

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $guesser->assertPresent('[role="img"][aria-label="4 letters left to find"]');

    $drawer->assertVisible('button:has-text("Reveal a letter (2 left)")')
        ->click('button:has-text("Reveal a letter (2 left)")')
        ->assertVisible('button:has-text("Reveal a letter (1 left)")');

    $guesser->assertPresent('[role="img"][aria-label="3 letters left to find"]');

    $drawer->click('button:has-text("Reveal a letter (1 left)")')
        ->assertDisabled('button:has-text("Reveal a letter (0 left)")');

    $guesser->assertPresent('[role="img"][aria-label="2 letters left to find"]');

    expect($round->fresh()->revealed_positions)->toHaveCount(2);
});

it('[P13b-09] ends the turn on a correct guess typed with other capitals and accents, without showing the guess', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::DrawAndGuess, 'lantern');

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $guesser->assertPresent('[role="group"][aria-label="2 online"]');

    p13bGuess($guesser, 'LÀNTERN');

    $guesser->assertSee('You found it!');

    foreach ([$drawer, $guesser] as $page) {
        $page->assertSee('Guessed')
            ->assertSee('lantern')
            ->assertSee('Ada Host found it!')
            ->assertSeeIn('[aria-label="Points of this round"]', '+10 Ada Host')
            ->assertSeeIn('[aria-label="Points of this round"]', '+5 Bob Leader')
            ->assertDontSee('LÀNTERN')
            ->assertNotPresent('section[aria-labelledby="game-guesses"]')
            ->click('[role="tab"]:has-text("Scores")')
            ->assertPresent('[aria-label="10 points"]')
            ->assertPresent('[aria-label="5 points"]');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Guessed)
        ->and($round->fresh()->winner_player_id)->toBe($adaPlayer->id)
        ->and(GameGuess::query()->where('game_round_id', $round->id)->where('is_correct', true)->pluck('text')->all())->toBe(['LÀNTERN']);
});

it('[P13b-10] preselects the next online player as the drawer of the next round', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13bRoom(GameKind::DrawAndGuess);
    [$bob, $bobPlayer] = gameRoomMember($room);
    p13bRenamed($bob, 'Bob Leader');
    $previous = GameRound::factory()
        ->game(GameKind::DrawAndGuess)
        ->word('castle')
        ->ledBy($adaPlayer)
        ->ended(GameRoundOutcome::Passed)
        ->create(['game_room_id' => $room->id]);
    $room->forceFill(['current_round_id' => $previous->id])->save();

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertSee('Passed')
        ->assertSee('castle')
        ->assertSeeIn('button[aria-label="Who draws?"]', 'Bob Leader')
        ->click('Next round')
        ->assertSee('Bob Leader is drawing');

    $member->assertSee('Your word to draw')
        ->assertVisible('canvas[aria-label="Your drawing"]');

    $round = $room->fresh()->currentRound;

    expect($round->id)->not->toBe($previous->id)
        ->and($round->leader_player_id)->toBe($bobPlayer->id);

    $member->click('Pass');

    $host->assertSee('Passed')
        ->assertSeeIn('button[aria-label="Who draws?"]', 'Ada Host');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Passed);
});
```

The points of `[P13b-09]` follow feature spec §4.6: ten for a guess without a hint, five for the drawer.

- [ ] **Step 6: Run the tests of steps 7 to 10**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php --filter='P13b-0[789]|P13b-10'`
Expected: PASS (4 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 7: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may re-indent the heredoc of `p13bPointer()`; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector` and keep the result.

- [ ] **Step 8: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`
Expected: PASS (11 tests).

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php
git commit -m "test(browser): cover the Draw & Guess walkthrough: drawing, late joiner, guesses, hints and rotation"
```

### Task 4: Decoded walkthrough, steps 11 to 13 (emoji clue, pass and give up, history)

This task automates steps 11 to 13 of the plan 13b walkthrough (`docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md`, lines 5583 to 5585).

Facts about the interface that the selectors rely on:

- Decoded board (`decoded-board.tsx`): the clue giver sees "Your word to describe" with the word, the clue editor and the hint button; everyone else sees "<name> is giving clues", the clue row and the mask. Both sides have the guess chat of Task 3.
- Clue editor (`clue-editor.tsx`): five slots. A filled slot is `button[aria-label="Remove <emoji>"]`; the first empty slot is `button[aria-label="Add an emoji"]`, which opens the emoji picker of the retro board (`resources/js/components/retro/emoji-picker.tsx`): a menu with the six quick emoji 👍 ❤️ 👏 🎉 🤔 👎 and "More emoji…", which opens a dialog with the full list. With five emoji there is no add button. Under the slots: "Describe the word with up to five emoji, without letters or digits." Each edit is saved 300 ms later with `PUT …/clue` and broadcast as `game.clue.changed`.
- Clue row for the others and in the history (`clue-row.tsx`): `[role="img"][aria-label="Clue: 🚀 🌕"]`, or `[aria-label="No clue yet"]`.
- A letter-like emoji (a keycap, a flag, a letter button) is refused in the browser with the toast "Use emoji only, without letters or digits." (`resources/js/lib/games/clue.ts`, mirror of `App\Rules\ClueEmoji`); nothing is sent.
- The walkthrough named 🚀 and 🌕 "from the picker". Neither is a quick emoji today, so the test takes 👍 from the quick row and 🚀 and 🌕 from the full list.
- **The full list is third-party data.** The picker (the `frimousse` package) asks skrum for `/emoji-data/{version}/en/data.json` and `messages.json`; `EmojiDataController` serves them from the default storage disk and downloads them from `cdn.jsdelivr.net` only when the disk has none. The tests call `Storage::fake()` and put a three-emoji data set in the emojibase format on the disk, so no request leaves the process (spec §3.6, a third-party call). The picker capitalises the labels, so its cells are `button[frimousse-emoji][aria-label="Rocket"]`, `…"Full moon"` and `…"Keycap: 1"`. The keycap is used rather than a flag because the picker hides flags on systems whose emoji font cannot draw them.
- Pass (`pass-round-button.tsx`): the leader and the host see the button "Pass" in Draw & Guess and Decoded, and "Give up" in Hangman; both end the round with the outcome "Passed" and show the word.
- History (`round-detail.tsx`): the detail of a Draw & Guess round is a canvas `[aria-label="Drawing of <word>"]` without input handlers and without the toolbar; the detail of a Decoded round is the clue row and the word; both show "Led by <name>".

No product file changes in this task.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`
- Test: `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`

**Interfaces:**
- Consumes: everything Task 3 consumes, and Task 3's helpers `p13bRoom()`, `p13bTable()`, `p13bRenamed()`, `p13bLine()`, `p13bPointer()`, `p13bPixelScript()`, `p13bGuess()`.
- Produces: the file-level helper `p13bSeedEmojiData(): void`.

- [ ] **Step 1: Append the emoji data helper and the clue tests (step 11)**

Add this import to the top of `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`, after `use App\Support\Games\GameWordBook;`:

```php
use Illuminate\Support\Facades\Storage;
```

Add this helper after `p13bGuess()`:

```php
function p13bSeedEmojiData(): void
{
    Storage::fake();

    $version = config('services.emoji_data.version');
    $emoji = [
        ['emoji' => '🚀', 'label' => 'rocket', 'group' => 0, 'subgroup' => 0, 'order' => 1, 'version' => 0.6, 'tags' => ['launch']],
        ['emoji' => '🌕', 'label' => 'full moon', 'group' => 0, 'subgroup' => 0, 'order' => 2, 'version' => 0.6, 'tags' => ['moon']],
        ['emoji' => "1\u{FE0F}\u{20E3}", 'label' => 'keycap: 1', 'group' => 0, 'subgroup' => 0, 'order' => 3, 'version' => 0.6, 'tags' => ['keycap']],
    ];
    $messages = [
        'groups' => [['key' => 'objects', 'message' => 'objects', 'order' => 0]],
        'subgroups' => [['key' => 'sky', 'message' => 'sky', 'order' => 0]],
        'skinTones' => [
            ['key' => 'light', 'message' => 'light skin tone'],
            ['key' => 'medium-light', 'message' => 'medium-light skin tone'],
            ['key' => 'medium', 'message' => 'medium skin tone'],
            ['key' => 'medium-dark', 'message' => 'medium-dark skin tone'],
            ['key' => 'dark', 'message' => 'dark skin tone'],
        ],
    ];

    Storage::put("emoji-data/{$version}/en/data.json", (string) json_encode($emoji, JSON_UNESCAPED_UNICODE));
    Storage::put("emoji-data/{$version}/en/messages.json", (string) json_encode($messages));
}
```

Append to the file:

```php
it('[P13b-11a] lets the clue giver add emoji from the quick row and the full list and remove one, live for the others', function () {
    p13bSeedEmojiData();
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::Decoded, 'rocket');

    $leader = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $leader->assertSee('Your word to describe')
        ->assertSee('rocket')
        ->assertSee('Describe the word with up to five emoji, without letters or digits.');

    $guesser->assertSee('Bob Leader is giving clues')
        ->assertPresent('[role="img"][aria-label="No clue yet"]')
        ->assertPresent('[role="img"][aria-label="6 letters left to find"]')
        ->assertDontSee('rocket');

    $leader->click('[aria-label="Add an emoji"]')
        ->assertVisible('[role="menuitem"]:has-text("👍")')
        ->assertSee('More emoji…')
        ->click('[role="menuitem"]:has-text("👍")')
        ->assertVisible('[aria-label="Remove 👍"]');

    $guesser->assertPresent('[role="img"][aria-label="Clue: 👍"]');

    $leader->assertNotPresent('[role="menu"]')
        ->click('[aria-label="Add an emoji"]')
        ->assertSee('More emoji…')
        ->click('More emoji…')
        ->assertVisible('button[frimousse-emoji][aria-label="Rocket"]')
        ->click('button[frimousse-emoji][aria-label="Rocket"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertVisible('[aria-label="Remove 🚀"]');

    $guesser->assertPresent('[role="img"][aria-label="Clue: 👍 🚀"]');

    $leader->click('[aria-label="Add an emoji"]')
        ->assertSee('More emoji…')
        ->click('More emoji…')
        ->assertVisible('button[frimousse-emoji][aria-label="Full moon"]')
        ->click('button[frimousse-emoji][aria-label="Full moon"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertVisible('[aria-label="Remove 🌕"]');

    $guesser->assertPresent('[role="img"][aria-label="Clue: 👍 🚀 🌕"]');

    $leader->click('[aria-label="Remove 👍"]')
        ->assertNotPresent('[aria-label="Remove 👍"]')
        ->assertCount('[aria-label^="Remove "]', 2);

    $guesser->assertPresent('[role="img"][aria-label="Clue: 🚀 🌕"]');

    expect($round->fresh()->clue)->toBe(['🚀', '🌕']);
});

it('[P13b-11b] refuses a keycap as a clue and offers no sixth slot', function () {
    p13bSeedEmojiData();
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::Decoded, 'rocket', [
        'clue' => ['👍', '👏', '🎉', '🤔'],
    ]);

    $leader = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $guesser->assertPresent('[role="img"][aria-label="Clue: 👍 👏 🎉 🤔"]');

    $leader->assertCount('[aria-label^="Remove "]', 4)
        ->click('[aria-label="Add an emoji"]')
        ->assertSee('More emoji…')
        ->click('More emoji…')
        ->assertVisible('button[frimousse-emoji][aria-label="Keycap: 1"]')
        ->click('button[frimousse-emoji][aria-label="Keycap: 1"]')
        ->assertSee('Use emoji only, without letters or digits.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('[aria-label^="Remove "]', 4);

    expect($round->fresh()->clue)->toBe(['👍', '👏', '🎉', '🤔']);

    $leader->click('[aria-label="Add an emoji"]')
        ->assertSee('More emoji…')
        ->click('More emoji…')
        ->assertVisible('button[frimousse-emoji][aria-label="Rocket"]')
        ->click('button[frimousse-emoji][aria-label="Rocket"]')
        ->assertCount('[aria-label^="Remove "]', 5)
        ->assertNotPresent('[aria-label="Add an emoji"]');

    $guesser->assertPresent('[role="img"][aria-label="Clue: 👍 👏 🎉 🤔 🚀"]');

    expect($round->fresh()->clue)->toBe(['👍', '👏', '🎉', '🤔', '🚀']);
});

it('[P13b-11c] lets a guesser solve a Decoded round from the clue', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::Decoded, 'rocket', [
        'clue' => ['🚀', '🌕'],
    ]);
    $chat = 'section[aria-labelledby="game-guesses"]';

    $leader = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $leader->assertSee('You know the word, so you cannot guess.')
        ->assertNotPresent('input[aria-label="Your guess"]');

    $guesser->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertPresent('[role="img"][aria-label="Clue: 🚀 🌕"]');

    p13bGuess($guesser, 'planet');

    $leader->assertSeeIn($chat, 'planet');

    p13bGuess($guesser, 'Rocket');

    $guesser->assertSee('You found it!');

    foreach ([$leader, $guesser] as $page) {
        $page->assertSee('Guessed')
            ->assertSee('rocket')
            ->assertSee('Ada Host found it!')
            ->assertNotPresent($chat);
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Guessed)
        ->and($round->fresh()->winner_player_id)->toBe($adaPlayer->id);
});
```

- [ ] **Step 2: Run the clue tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php --filter='P13b-11'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the full list shows "Emoji list unavailable" or stays on "Loading…", the seeded files were not served: open `/emoji-data/{version}/en/data.json` in the headed browser, compare the path with the one `EmojiDataController::show()` builds, and compare the JSON with the fields `frimousse` reads (`emoji`, `label`, `group`, `version`, `tags` in `data.json`; `groups`, `subgroups`, `skinTones` in `messages.json`). If that does not explain it, see the harness findings.

- [ ] **Step 3: Append the tests of pass, give up and the history (steps 12 and 13)**

Append to `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`:

```php
it('[P13b-12a] lets the host end a Decoded round with "Pass"', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::Decoded, 'rocket');

    $leader = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $leader->assertSee('Pass');

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertSee('Pass')
        ->assertDontSee('Give up')
        ->click('Pass');

    foreach ([$leader, $host] as $page) {
        $page->assertSeeIn('main [data-slot="badge"]', 'Passed')
            ->assertSee('rocket')
            ->assertDontSee('found it!');
    }

    $host->assertSee('Next round');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Passed)
        ->and($round->fresh()->winner_player_id)->toBeNull();
});

it('[P13b-12b] shows "Give up" to the host of a Hangman round and to nobody else', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::Hangman, 'quartz', [
        'leader_player_id' => null,
    ]);

    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $member->assertCount('[role="group"][aria-label="Letters"] button', 26)
        ->assertDontSee('Give up')
        ->assertNotPresent('button:has-text("Pass")');

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertNotPresent('button:has-text("Pass")')
        ->assertSee('Give up')
        ->click('Give up');

    foreach ([$member, $host] as $page) {
        $page->assertSeeIn('main [data-slot="badge"]', 'Passed')
            ->assertSee('quartz')
            ->assertNotPresent('[role="group"][aria-label="Letters"]');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Passed);
});

it('[P13b-13a] replays the drawing of a Draw & Guess round in the history, read-only', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13bRoom(GameKind::DrawAndGuess);
    [$bob, $bobPlayer] = gameRoomMember($room);
    p13bRenamed($bob, 'Bob Leader');
    GameRound::factory()
        ->game(GameKind::DrawAndGuess)
        ->word('lantern')
        ->ledBy($bobPlayer)
        ->ended(GameRoundOutcome::Guessed)
        ->create([
            'game_room_id' => $room->id,
            'winner_player_id' => $adaPlayer->id,
            'drawing' => [p13bLine()],
            'drawing_points' => 2,
        ]);
    $canvas = '[role="dialog"] canvas[aria-label="Drawing of lantern"]';

    $page = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $page->click('History')
        ->assertSee('Last rounds')
        ->assertVisible('[role="dialog"] li button:has-text("lantern")')
        ->assertSeeIn('[role="dialog"] li button:has-text("lantern")', 'Guessed')
        ->click('[role="dialog"] li button:has-text("lantern")')
        ->assertVisible($canvas)
        ->assertSeeIn('[role="dialog"]', 'Led by Bob Leader')
        ->assertSeeIn('[role="dialog"]', 'Ada Host found it!')
        ->assertScript(p13bPixelScript('Drawing of lantern', 400, 300), '23 23 23 255')
        ->assertScript(p13bPixelScript('Drawing of lantern', 400, 100), '255 255 255 255')
        ->assertNotPresent('[role="dialog"] [role="toolbar"]')
        ->assertNotPresent('[role="dialog"] canvas.cursor-crosshair');

    p13bPointer($page, 'pointerdown', [[0.25, 0.2]], 'Drawing of lantern');
    p13bPointer($page, 'pointermove', [[0.5, 0.2], [0.75, 0.2]], 'Drawing of lantern');
    p13bPointer($page, 'pointerup', [[0.75, 0.2]], 'Drawing of lantern');

    $page->assertScript(p13bPixelScript('Drawing of lantern', 400, 120), '255 255 255 255')
        ->assertScript(p13bPixelScript('Drawing of lantern', 400, 300), '23 23 23 255');
});

it('[P13b-13b] shows the clue of a Decoded round in the history', function () {
    ['room' => $room, 'ada' => $ada] = p13bRoom(GameKind::Decoded);
    [$bob, $bobPlayer] = gameRoomMember($room);
    p13bRenamed($bob, 'Bob Leader');
    GameRound::factory()
        ->game(GameKind::DrawAndGuess)
        ->word('lantern')
        ->ledBy($bobPlayer)
        ->ended(GameRoundOutcome::Guessed)
        ->create(['game_room_id' => $room->id, 'ended_at' => now()->subMinutes(10)]);
    GameRound::factory()
        ->game(GameKind::Decoded)
        ->word('rocket')
        ->ledBy($bobPlayer)
        ->ended(GameRoundOutcome::Passed)
        ->create(['game_room_id' => $room->id, 'clue' => ['🚀', '🌕']]);

    $page = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $page->click('History')
        ->assertSee('Last rounds')
        ->assertCount('[role="dialog"] li button', 2)
        ->assertSeeIn('[role="dialog"] li button:has-text("rocket")', 'Passed')
        ->click('[role="dialog"] li button:has-text("rocket")')
        ->assertPresent('[role="dialog"] [role="img"][aria-label="Clue: 🚀 🌕"]')
        ->assertSeeIn('[role="dialog"]', 'rocket')
        ->assertSeeIn('[role="dialog"]', 'Led by Bob Leader')
        ->assertNotPresent('[role="dialog"] canvas')
        ->click('[role="dialog"] button:has-text("Back")')
        ->assertCount('[role="dialog"] li button', 2);
});
```

In `[P13b-13a]` the three pointer events on the history canvas would draw a line across raster row 120 if the canvas accepted input; the pixel staying white proves the replay is read-only.

- [ ] **Step 4: Run the tests of steps 12 and 13**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php --filter='P13b-1[23]'`
Expected: PASS (4 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector` and keep the result.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`
Expected: PASS (18 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php
git commit -m "test(browser): cover the Decoded walkthrough: emoji clue, pass, give up and round history"
```

### Task 5: Sprint in one GIF walkthrough (plan 13c)

This task automates the six steps of the plan 13c walkthrough (`docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md`, lines 3918 to 3923) in `tests/Browser/Walkthroughs/Plan13cSprintGifTest.php`. No product file changes, so no frontend build is needed.

Substitutions used (spec §3.6):

- The GIF provider is GIPHY, faked with `Http::fake()`. A provider is "enabled" when `config('services.gifs.provider')` is `giphy` or `tenor` and `config('services.gifs.key')` is a non-empty string (`app/Support/Gifs/GifCatalog.php`, `config/services.php` key `gifs`). The fake answers `api.giphy.com/v1/gifs/search`, `/trending` and `/{id}` with the shape of `gameGiphyItem()` in `tests/Pest.php`, and `media.giphy.com/*` with a one-pixel GIF so the proxy `GET /gifs/{gif}/{size}` (`app/Http/Controllers/GifsController.php`) serves a real image. The proxy stores each image on the default disk, so the helper also calls `Storage::fake()`.
- The fake returns ids derived from the search word (`party` gives `partyone` and `partytwo`, an empty query gives `trendone` and `trendtwo`), so two players who search different words never receive each other's ids. That makes "the other browser never has the GIF id" checkable.
- "Check the network tab" becomes: the id is absent from the other player's document, and absent from the snapshot that the other player's page fetches with `fetch()` through `script()`.
- "Sets a 1-minute timer and waits" becomes: `config(['queue.default' => 'database'])`, `$this->travel(61)->seconds()`, `$this->workQueue()`.

Facts about the interface that the selectors rely on (all read from the current code):

- The room page root carries `data-realtime` (`resources/js/components/games/game-room.tsx`), so `$this->awaitRealtime($page)` works on `/games/{room}`. The header is `header` with one `h1`; a bare `header` would be read as text, so the tests write `header:has(h1)`.
- The host's game switcher is a Radix select whose trigger is `button[aria-label="Game"]` (`game-switcher.tsx`); a non-host sees a badge with the game's name instead.
- The question banner (`gif-question-banner.tsx`) shows "Shuffle question" and "Edit question" to the host until the first answer; the edit input is `[aria-label="Question"]`.
- The answer stage (`gif-answer-stage.tsx`) shows "Choose a GIF", then "Change GIF" and "Remove GIF", the player's own tile with the caption "Your GIF", and for the others a list `ul[aria-label="Answers"]` of placeholders "Ada answered". The host also sees "Reveal the GIFs".
- The picker (`components/gifs/gif-search-dialog.tsx`) is a dialog titled "Choose a GIF" with the input `[aria-label="Search GIFs…"]`, one `button[aria-label="Choose this GIF"]` per result holding `img[src="/gifs/{id}/preview"]`, and the line "Powered by GIPHY". It searches 300 ms after the input changes.
- A GIF tile is a `figure` holding `img[src="/gifs/{id}/preview"]` (`gif-tile.tsx`). The tests address a tile as `figure:has(img[src="/gifs/partyone/preview"])`.
- The voting stage (`gif-voting-stage.tsx`) shows "Vote for your favourite GIF.", ":count of :total voted", a "Favourite" button (`aria-pressed`, text "Your favourite" once chosen) on every tile except the viewer's own, and "Finish round" for the host. The total is the number of players online, so the tests wait for `[role="group"][aria-label="2 online"]` first.
- The end card (`round-end-card.tsx`, `gif-round-results.tsx`) shows the badge "Revealed", the question, and per tile "Votes: n" and a badge "+n".
- The room timer (`room-timer.tsx`) is `button[aria-label="Timer"]` with the menu items "1 min", "2 min", "3 min", "5 min", "10 min" and "Stop timer"; the countdown is a badge in the header with no `role="timer"`.
- The history drawer is the button "History"; it opens a sheet (`[role="dialog"]`) titled "Last rounds" with one button per round showing the word or the question.
- The guest join page is `/play/{guestToken}` (`resources/js/pages/games/join.tsx`) with the input `#name` and the button "Join", so `$this->joinAsGuest()` works unchanged.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan13cSprintGifTest.php`
- Test: `tests/Browser/Walkthroughs/Plan13cSprintGifTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime(mixed $page): mixed` (plan 16a) and `$this->workQueue(): void` (plan 16b Task 1, in `tests/Browser/Support/InteractsWithBrowser.php`).
  - Helpers in `tests/Pest.php`: `gameRoomHost(GameRoom $room): array{0: User, 1: GamePlayer}`, `gameRoomMember(GameRoom $room): array{0: User, 1: GamePlayer}`, `activeGifRound(GameRoom $room, array $attributes = []): GameRound` (question "How did the sprint feel?"), `gameGiphyItem(string $id): array`.
  - Factories: `GameRoomFactory::game()`, `linkAccess()`; `GameGifAnswerFactory`; `GameGifVoteFactory`.
  - `App\Support\Games\GameWordBook` (constructor argument `questions`) to fix the question list.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan13cSprintGifTest.php` (global functions; other files must not redeclare them): `p13cNamed(User $user, string $name): User`, `p13cFakeGifs(): void`, `p13cRoom(GameKind $game = GameKind::SprintGif): array`, `p13cMember(GameRoom $room, string $name): array`, `p13cAnswer(GameRound $round, GamePlayer $player, string $gifId): GameGifAnswer`, `p13cTile(string $gifId): string`, `p13cPick(mixed $page, string $opener, string $query, string $gifId): mixed`.
  - No product hook.

- [ ] **Step 1: Create the test file with its helpers and the tests of steps 1 and 2**

`php artisan make:test` cannot write under `tests/Browser`, so create `tests/Browser/Walkthroughs/Plan13cSprintGifTest.php` directly with this content:

```php
<?php

use App\Enums\GameKind;
use App\Models\GameGifAnswer;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use App\Support\Games\GameWordBook;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

function p13cNamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

function p13cFakeGifs(): void
{
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'browser-gif-key', 'rating' => 'pg']]);

    Storage::fake();

    Http::fake([
        'api.giphy.com/*' => function (HttpRequest $request) {
            $endpoint = basename((string) parse_url($request->url(), PHP_URL_PATH));

            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);

            if ($endpoint === 'trending') {
                return Http::response(['data' => [gameGiphyItem('trendone'), gameGiphyItem('trendtwo')]]);
            }

            if ($endpoint === 'search') {
                $word = preg_replace('/[^a-z]/', '', strtolower((string) ($query['q'] ?? '')));

                return Http::response(['data' => [gameGiphyItem("{$word}one"), gameGiphyItem("{$word}two")]]);
            }

            return Http::response(['data' => gameGiphyItem($endpoint)]);
        },
        'media.giphy.com/*' => Http::response(
            (string) base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
            200,
            ['Content-Type' => 'image/gif'],
        ),
    ]);
}

/**
 * @return array{
 *     room: GameRoom,
 *     ada: User,
 *     adaPlayer: GamePlayer
 * }
 */
function p13cRoom(GameKind $game = GameKind::SprintGif): array
{
    $room = GameRoom::factory()->game($game)->linkAccess()->create(['name' => 'Friday fun']);
    [$ada, $adaPlayer] = gameRoomHost($room);

    return [
        'room' => $room->fresh(),
        'ada' => p13cNamed($ada, 'Ada'),
        'adaPlayer' => $adaPlayer,
    ];
}

/**
 * @return array{0: User, 1: GamePlayer}
 */
function p13cMember(GameRoom $room, string $name): array
{
    [$user, $player] = gameRoomMember($room);

    return [p13cNamed($user, $name), $player];
}

function p13cAnswer(GameRound $round, GamePlayer $player, string $gifId): GameGifAnswer
{
    return GameGifAnswer::factory()->create([
        'game_round_id' => $round->id,
        'player_id' => $player->id,
        'gif_id' => $gifId,
    ]);
}

function p13cTile(string $gifId): string
{
    return "figure:has(img[src=\"/gifs/{$gifId}/preview\"])";
}

function p13cPick(mixed $page, string $opener, string $query, string $gifId): mixed
{
    $result = "button[aria-label=\"Choose this GIF\"]:has(img[src=\"/gifs/{$gifId}/preview\"])";

    return $page->click($opener)
        ->assertSee('Powered by GIPHY')
        ->fill('[aria-label="Search GIFs…"]', $query)
        ->assertPresent($result)
        ->click($result)
        ->assertNotPresent('[role="dialog"]');
}

it('[P13c-01] lets the host switch to Sprint in one GIF, start, shuffle and edit the question until the first answer', function () {
    p13cFakeGifs();
    $questions = ['Which GIF sums up the sprint?', 'How did the sprint feel?'];
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => $questions]));
    ['room' => $room, 'ada' => $ada] = p13cRoom(GameKind::Hangman);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $c = $this->awaitRealtime($this->joinAsGuest(route('games.join.show', $room->guest_token, false), 'Casey'));

    foreach ([$a, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $c->assertSeeIn('header:has(h1)', 'Hangman')
        ->assertSee('Waiting for the host to start.');

    $a->click('[aria-label="Game"]')
        ->assertVisible('[role="option"]:has-text("Sprint in one GIF")')
        ->click('[role="option"]:has-text("Sprint in one GIF")')
        ->assertSeeIn('[aria-label="Game"]', 'Sprint in one GIF');

    $c->assertSeeIn('header:has(h1)', 'Sprint in one GIF');

    $a->assertSee('Ready to play?')
        ->click('Start')
        ->assertSee('Pick a GIF that answers the question.');

    $round = GameRound::query()->where('game_room_id', $room->id)->sole();
    $first = (string) $round->question;
    $second = $first === $questions[0] ? $questions[1] : $questions[0];

    foreach ([$a, $c] as $page) {
        $page->assertSee($first)
            ->assertSee('Pick a GIF that answers the question.');
    }

    $c->assertDontSee('Shuffle question')
        ->assertDontSee('Edit question')
        ->assertDontSee('Reveal the GIFs');

    $a->assertSee('Shuffle question')
        ->click('Shuffle question');

    foreach ([$a, $c] as $page) {
        $page->assertSee($second)
            ->assertDontSee($first);
    }

    $a->click('Edit question')
        ->assertVisible('[aria-label="Question"]')
        ->fill('[aria-label="Question"]', 'Which GIF is our sprint in one picture?')
        ->click('Save');

    foreach ([$a, $c] as $page) {
        $page->assertSee('Which GIF is our sprint in one picture?')
            ->assertDontSee($second);
    }

    p13cPick($c, 'Choose a GIF', 'party', 'partyone');

    $a->assertSeeIn('ul[aria-label="Answers"]', 'Casey answered')
        ->assertDontSee('Shuffle question')
        ->assertDontSee('Edit question');

    expect($room->fresh()->game)->toBe(GameKind::SprintGif)
        ->and($round->fresh()->question)->toBe('Which GIF is our sprint in one picture?')
        ->and($round->gifAnswers()->count())->toBe(1);
});

it('[P13c-02] lets each player search, pick, change and remove a GIF while the other only ever gets a placeholder', function () {
    p13cFakeGifs();
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13cRoom();
    $round = activeGifRound($room);
    $snapshot = "() => fetch('/games/{$room->id}/snapshot', { headers: { Accept: 'application/json' }, credentials: 'same-origin' }).then((response) => response.text())";
    $documentHas = fn (string $gifId): string => "document.documentElement.outerHTML.includes(\"{$gifId}\")";

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $c = $this->awaitRealtime($this->joinAsGuest(route('games.join.show', $room->guest_token, false), 'Casey'));

    foreach ([$a, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSee('How did the sprint feel?')
            ->assertSee('No GIFs yet.');
    }

    p13cPick($a, 'Choose a GIF', 'party', 'partyone');

    $a->assertSeeIn(p13cTile('partyone'), 'Your GIF')
        ->assertSee('Change GIF')
        ->assertSee('Remove GIF');

    $c->assertSeeIn('ul[aria-label="Answers"]', 'Ada answered')
        ->assertNotPresent('figure')
        ->assertScript($documentHas('partyone'), false);

    $body = (string) $c->script($snapshot);

    expect($body)->toContain('"answered":true')
        ->not->toContain('partyone');

    p13cPick($a, 'Change GIF', 'coffee', 'coffeeone');

    $a->assertSeeIn(p13cTile('coffeeone'), 'Your GIF')
        ->assertNotPresent(p13cTile('partyone'));

    $c->assertSeeIn('ul[aria-label="Answers"]', 'Ada answered')
        ->assertScript($documentHas('coffeeone'), false);

    expect((string) $c->script($snapshot))->not->toContain('coffeeone')
        ->and($round->gifAnswers()->where('player_id', $adaPlayer->id)->sole()->gif_id)->toBe('coffeeone');

    $a->click('Remove GIF')
        ->assertSee('Choose a GIF')
        ->assertDontSee('Your GIF');

    $c->assertNotPresent('ul[aria-label="Answers"]')
        ->assertSee('No GIFs yet.');

    expect($round->gifAnswers()->count())->toBe(0);

    p13cPick($c, 'Choose a GIF', 'tada', 'tadaone');

    $c->assertSeeIn(p13cTile('tadaone'), 'Your GIF');

    $a->assertSeeIn('ul[aria-label="Answers"]', 'Casey answered')
        ->assertNotPresent('figure')
        ->assertScript($documentHas('tadaone'), false);

    expect((string) $a->script($snapshot))->not->toContain('tadaone')
        ->and($round->gifAnswers()->sole()->gif_id)->toBe('tadaone');
});
```

`[P13c-01]` reads the first question from the database because the server picks it at random from the two bound questions; the shuffle then has only the other one left. `[P13c-02]` reads the snapshot with `script()`, which returns the value of the promise. If this fails, see the harness findings.

- [ ] **Step 2: Run the tests of steps 1 and 2**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13cSprintGifTest.php --filter='P13c-0[12]'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 3: Add the timer reveal and the votes (steps 3 and 4)**

In `tests/Browser/Walkthroughs/Plan13cSprintGifTest.php`, add these two imports, keeping the list in alphabetical order:

```php
use App\Models\GameGifVote;
use Illuminate\Support\Facades\DB;
```

Then append to the end of the file:

```php
it('[P13c-03] reveals the GIFs to everyone when the one-minute timer runs out, without closing the round', function () {
    config(['queue.default' => 'database']);
    p13cFakeGifs();
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13cRoom();
    [$bob, $bobPlayer] = p13cMember($room, 'Bob');
    $round = activeGifRound($room);
    p13cAnswer($round, $adaPlayer, 'partyone');
    p13cAnswer($round, $bobPlayer, 'coffeeone');

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSee('Pick a GIF that answers the question.');
    }

    $a->assertSeeIn('ul[aria-label="Answers"]', 'Bob answered')
        ->assertNotPresent('img[src*="coffeeone"]');

    $b->assertSeeIn('ul[aria-label="Answers"]', 'Ada answered')
        ->assertNotPresent('img[src*="partyone"]');

    $a->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('header:has(h1)', '0:');
    }

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($round->fresh()->revealed_at)->toBeNull();

    $this->travel(61)->seconds();
    $this->workQueue();

    foreach ([$a, $b] as $page) {
        $page->assertSee('Vote for your favourite GIF.')
            ->assertPresent(p13cTile('partyone'))
            ->assertPresent(p13cTile('coffeeone'))
            ->assertSee('0 of 2 voted')
            ->assertDontSee('Votes:')
            ->assertDontSee('Change GIF');
    }

    $a->assertSeeIn(p13cTile('partyone'), 'Your GIF')
        ->assertSeeIn(p13cTile('coffeeone'), 'by Bob')
        ->assertSee('Finish round');

    $b->assertSeeIn(p13cTile('partyone'), 'by Ada')
        ->assertDontSee('Finish round');

    expect($round->fresh()->revealed_at)->not->toBeNull()
        ->and($round->fresh()->ended_at)->toBeNull()
        ->and(DB::table('jobs')->count())->toBe(0);

    $a->assertNotPresent('[role="menu"]')
        ->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min')
        ->assertNotPresent('[role="menu"]');

    $b->assertSee('Vote for your favourite GIF.');

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($room->fresh()->timer_ends_at->isFuture())->toBeTrue()
        ->and($round->fresh()->ended_at)->toBeNull();
});

it('[P13c-04] lets each player vote for another GIF, change and retract the vote, with a live tally and no counts', function () {
    p13cFakeGifs();
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13cRoom();
    [$bob, $bobPlayer] = p13cMember($room, 'Bob');
    [, $cleoPlayer] = p13cMember($room, 'Cleo');
    $round = activeGifRound($room, ['revealed_at' => now()->startOfSecond()]);
    p13cAnswer($round, $adaPlayer, 'partyone');
    p13cAnswer($round, $bobPlayer, 'coffeeone');
    p13cAnswer($round, $cleoPlayer, 'tadaone');
    $favourite = fn (string $gifId): string => p13cTile($gifId).' button';

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSee('Vote for your favourite GIF.')
            ->assertSee('0 of 2 voted')
            ->assertCount('figure', 3);
    }

    $b->assertSeeIn(p13cTile('coffeeone'), 'Your GIF')
        ->assertNotPresent($favourite('coffeeone'))
        ->assertSeeIn($favourite('partyone'), 'Favourite')
        ->click($favourite('partyone'))
        ->assertSeeIn($favourite('partyone'), 'Your favourite')
        ->assertAriaAttribute($favourite('partyone'), 'pressed', 'true');

    $a->assertSee('1 of 2 voted')
        ->assertDontSee('Votes:')
        ->assertNotPresent($favourite('partyone'));

    $b->click($favourite('tadaone'))
        ->assertAriaAttribute($favourite('tadaone'), 'pressed', 'true')
        ->assertAriaAttribute($favourite('partyone'), 'pressed', 'false');

    $a->assertSee('1 of 2 voted');

    expect(GameGifVote::query()->where('game_round_id', $round->id)->sole()->answer->gif_id)->toBe('tadaone');

    $b->click($favourite('tadaone'))
        ->assertAriaAttribute($favourite('tadaone'), 'pressed', 'false');

    $a->assertSee('0 of 2 voted');

    expect(GameGifVote::query()->where('game_round_id', $round->id)->count())->toBe(0);

    $a->click($favourite('coffeeone'))
        ->assertAriaAttribute($favourite('coffeeone'), 'pressed', 'true');

    $b->assertSee('1 of 2 voted')
        ->assertDontSee('Votes:');

    expect($round->fresh()->ended_at)->toBeNull();
});
```

`[P13c-04]` adds a third answer by an offline member so that Bob has two GIFs to choose between; votes are limited to a burst of three per player, and Bob makes exactly three requests. `GameGifVote::answer()` is the vote's `belongsTo` relation (`app/Models/GameGifVote.php`).

- [ ] **Step 4: Run the tests of steps 3 and 4**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13cSprintGifTest.php --filter='P13c-0[34]'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the close of the round and the next round (steps 5 and 6)**

In the same file, add these two imports, keeping the list in alphabetical order:

```php
use App\Enums\GameRoundOutcome;
use App\Models\GamePoint;
```

Then append to the end of the file:

```php
it('[P13c-05a] shows the vote counts and "+2" per vote to everyone when the host finishes the round, and the same counts in the history', function () {
    p13cFakeGifs();
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13cRoom();
    [$bob, $bobPlayer] = p13cMember($room, 'Bob');
    $round = activeGifRound($room, ['revealed_at' => now()->startOfSecond()]);
    $adaAnswer = p13cAnswer($round, $adaPlayer, 'partyone');
    p13cAnswer($round, $bobPlayer, 'coffeeone');
    GameGifVote::factory()->create([
        'game_round_id' => $round->id,
        'voter_player_id' => $bobPlayer->id,
        'answer_id' => $adaAnswer->id,
    ]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSee('1 of 2 voted')
            ->assertDontSee('Votes:');
    }

    $a->click('Finish round');

    foreach ([$a, $b] as $page) {
        $page->assertSee('Revealed')
            ->assertSee('How did the sprint feel?')
            ->assertSeeIn(p13cTile('partyone'), 'Votes: 1')
            ->assertSeeIn(p13cTile('partyone'), '+2')
            ->assertSeeIn(p13cTile('partyone'), 'by Ada')
            ->assertSeeIn(p13cTile('coffeeone'), 'Votes: 0')
            ->assertDontSeeIn(p13cTile('coffeeone'), '+2')
            ->assertDontSee('Vote for your favourite GIF.');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed)
        ->and(GamePoint::query()->where('player_id', $adaPlayer->id)->sole()->points)->toBe(2)
        ->and(GamePoint::query()->where('player_id', $bobPlayer->id)->sole()->points)->toBe(0);

    $b->click('History')
        ->assertSee('Last rounds')
        ->click('[role="dialog"] button:has-text("How did the sprint feel?")')
        ->assertSeeIn('[role="dialog"] '.p13cTile('partyone'), 'Votes: 1')
        ->assertSeeIn('[role="dialog"] '.p13cTile('coffeeone'), 'Votes: 0');
});

it('[P13c-05b] closes the voting round with its counts when the timer runs out during voting', function () {
    config(['queue.default' => 'database']);
    p13cFakeGifs();
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13cRoom();
    [$bob, $bobPlayer] = p13cMember($room, 'Bob');
    $round = activeGifRound($room, ['revealed_at' => now()->startOfSecond()]);
    $adaAnswer = p13cAnswer($round, $adaPlayer, 'partyone');
    p13cAnswer($round, $bobPlayer, 'coffeeone');
    GameGifVote::factory()->create([
        'game_round_id' => $round->id,
        'voter_player_id' => $bobPlayer->id,
        'answer_id' => $adaAnswer->id,
    ]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSee('1 of 2 voted');
    }

    $a->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('header:has(h1)', '0:');
    }

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($round->fresh()->ended_at)->toBeNull();

    $this->travel(61)->seconds();
    $this->workQueue();

    foreach ([$a, $b] as $page) {
        $page->assertSee('Revealed')
            ->assertSeeIn(p13cTile('partyone'), 'Votes: 1')
            ->assertSeeIn(p13cTile('partyone'), '+2')
            ->assertSeeIn(p13cTile('coffeeone'), 'Votes: 0')
            ->assertDontSee('Vote for your favourite GIF.');
    }

    $a->assertSee('Next round');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed)
        ->and(GamePoint::query()->where('player_id', $adaPlayer->id)->sole()->points)->toBe(2);
});

it('[P13c-06] closes a round in its voting window with its points when the host starts the next round', function () {
    p13cFakeGifs();
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['Which GIF sums up the sprint?', 'How did the sprint feel?']]));
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13cRoom();
    [$bob, $bobPlayer] = p13cMember($room, 'Bob');
    $round = activeGifRound($room, ['revealed_at' => now()->startOfSecond()]);
    $adaAnswer = p13cAnswer($round, $adaPlayer, 'partyone');
    GameGifVote::factory()->create([
        'game_round_id' => $round->id,
        'voter_player_id' => $bobPlayer->id,
        'answer_id' => $adaAnswer->id,
    ]);
    $startNextRound = "() => fetch('/games/{$room->id}/rounds', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN=')).split('=')[1]) }, body: '{}' }).then((response) => response.status)";

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSee('How did the sprint feel?')
            ->assertSee('1 of 2 voted');
    }

    expect($a->script($startNextRound))->toBe(201);

    foreach ([$a, $b] as $page) {
        $page->assertSee('Which GIF sums up the sprint?')
            ->assertSee('Pick a GIF that answers the question.')
            ->assertDontSee('Vote for your favourite GIF.');
    }

    $b->click('[role="tab"]:has-text("Scores")')
        ->assertPresent('[role="tabpanel"] li:has-text("Ada") [aria-label="2 points"]');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed)
        ->and(GamePoint::query()->where('player_id', $adaPlayer->id)->sole()->points)->toBe(2)
        ->and(GameRound::query()->where('game_room_id', $room->id)->whereNull('ended_at')->sole()->question)->toBe('Which GIF sums up the sprint?');
});
```

`[P13c-06]`: today's interface shows "Start" and "Next round" only when no round is active (`StartRoundControls` is rendered by `round-end-card.tsx` alone), so there is no button to press during the voting window. The test sends, from the host's signed-in page, the request that button sends (`POST /games/{room}/rounds` with the page's XSRF token) and then asserts what both browsers show. The request carries no `X-Socket-ID`, so the host's own page learns the result from the broadcasts, like the other page. If this fails, see the harness findings.

- [ ] **Step 6: Run the tests of steps 5 and 6**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13cSprintGifTest.php --filter='P13c-0[56]'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 7: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector` and keep its result.

- [ ] **Step 8: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13cSprintGifTest.php`
Expected: PASS (7 tests).

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan13cSprintGifTest.php
git commit -m "test(browser): cover the Sprint in one GIF walkthrough"
```

### Task 6: Icebreaker game inside a retro and "Games we played" (plan 13d, steps 6 and 11)

This task automates steps 6 and 11 of the plan 13d walkthrough (`docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md`, lines 4436 to 4440 and 4448) in a new file, `tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php`. Task 7 adds the rest of the walkthrough to the same file. No product file changes, so no frontend build is needed.

Substitution used (spec §3.6): "Set the board timer during a round: the round ends when it hits zero" becomes `config(['queue.default' => 'database'])`, the facilitator choosing "1 min" in the board's timer menu, `$this->travel(61)->seconds()` and `$this->workQueue()`.

Facts about the interface that the selectors rely on (all read from the current code):

- A retro created with the Icebreaker phase starts in that phase: `CreateRetro` sets `phase` to `Retro::firstPhase()`, and Icebreaker comes before Writing. The walkthrough's "and move to Icebreaker" needs no action.
- The new-retro dialog (`resources/js/components/teams/new-retro-dialog.tsx`) has the checkbox `#new-retro-icebreaker`; once ticked it shows the Radix select `#new-retro-icebreaker-game`, whose default is "Draw & Guess".
- In the Icebreaker phase the board renders `IcebreakerStage` instead of the columns (`board.tsx`): `main.relative` holding `section[aria-label="Icebreaker game"]` (`icebreaker-game.tsx`), with the heading "Icebreaker", the facilitator's game switcher `button[aria-label="Game"]` (a badge for everyone else), the "History" button and the game panel. The game panel contains a second, inner `main` without the class `relative`, so `main.relative` matches exactly one element.
- Game events of an icebreaker travel on the retro's channel; the page root's `data-realtime` is the retro board's, so `$this->awaitRealtime($page)` works on `/retros/{retro}`.
- The Hangman board (`hangman-board.tsx`) shows the keyboard `[role="group"][aria-label="Letters"]` with one button per letter, the mask `[role="img"]` labelled ":count letters left to find", and `ul[aria-label="Last letters"]` with ":name picked :letter".
- With no active round the panel shows the end card: the outcome badge ("Abandoned", "Time's up", "Solved"), the word, and "Start" or "Next round" for the host, "Waiting for the host to start." for the others.
- The board timer is `button[aria-label="Timer"]` in the board header with "1 min", "3 min", "5 min", "10 min"; the countdown is `[role="timer"]`. `RetroTimersController` calls `ScheduleIcebreakerExpiry`, which queues `CloseExpiredGameRound` for the active round.
- The phase stepper's "Next" button moves to Writing; `ChangeRetroPhase` ends the active round as Abandoned.
- Cursors and reactions on the board use the same overlays as in plan 10b: `.lc-overlay`, `.lr-overlay`, `[aria-label="Send a reaction 🎉"]`.
- The Results view of a completed retro (`results-view.tsx`) renders its sections as `section` elements each starting with an `h2`: "Action items", then "Games we played" (`games-played-section.tsx`), then "Return on time invested". The games section shows ":count rounds played", a podium `ol.grid` of at most three rows with "Show all" / "Show less", one `li` per round in `ol.space-y-2`, and a "Replay" button on Draw & Guess rounds only, which opens a dialog titled "Replay" with `canvas[aria-label="Drawing of rocket"]`.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php`
- Test: `tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `signIn`, `joinAsGuest`, `awaitRealtime` (plan 16a) and `$this->workQueue(): void` (plan 16b Task 1).
  - Helpers in `tests/Pest.php`: `teamMember(Team $team): User`, `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`, `retroMember(Retro $retro): array{0: User, 1: Participant}`, `activeGameRound(GameRoom $room, array $attributes = []): GameRound`, `awardGamePoints(GameRoom $room, GamePlayer $player, int $points, bool $isWin = false, array $attributes = []): GamePoint`.
  - Factories: `RetroFactory::withIcebreaker()`, `withGuestAccess()`, `anonymous()`, `inPhase()`; `GameRoomFactory::icebreaker(Retro $retro)`, `game()`; `GamePlayerFactory::forParticipant()`; `GameRoundFactory::game()`, `ended()`; `GameGifAnswerFactory`; `GameGifVoteFactory`.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php` (global functions): `p13dNamed(User $user, string $name): User`, `p13dIcebreaker(RetroPhase $phase = RetroPhase::Icebreaker, GameKind $game = GameKind::Hangman, array $attributes = []): array`, `p13dIcebreakerPlayer(Retro $retro, GameRoom $room, string $name): GamePlayer`.
  - No product hook.

- [ ] **Step 1: Create the test file with its helpers and the icebreaker tests (step 6)**

Create `tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php` directly with this content:

```php
<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Models\Column;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;

function p13dNamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     retro: Retro,
 *     room: GameRoom,
 *     ada: User,
 *     adaPlayer: GamePlayer,
 *     bob: User,
 *     bobPlayer: GamePlayer
 * }
 */
function p13dIcebreaker(RetroPhase $phase = RetroPhase::Icebreaker, GameKind $game = GameKind::Hangman, array $attributes = []): array
{
    $retro = Retro::factory()
        ->withIcebreaker()
        ->withGuestAccess()
        ->inPhase($phase)
        ->create(['title' => 'Sprint 13 retro', 'icebreaker_game' => $game, ...$attributes]);

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$ada, $adaParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);
    $retro = $retro->fresh();
    $room = GameRoom::factory()->icebreaker($retro)->game($game)->create();

    return [
        'retro' => $retro,
        'room' => $room,
        'ada' => p13dNamed($ada, 'Ada'),
        'adaPlayer' => GamePlayer::factory()->forParticipant($adaParticipant)->create(['game_room_id' => $room->id]),
        'bob' => p13dNamed($bob, 'Bob'),
        'bobPlayer' => GamePlayer::factory()->forParticipant($bobParticipant)->create(['game_room_id' => $room->id]),
    ];
}

function p13dIcebreakerPlayer(Retro $retro, GameRoom $room, string $name): GamePlayer
{
    [$user, $participant] = retroMember($retro);
    p13dNamed($user, $name);

    return GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
}

it('[P13d-06a] creates a retro with the Icebreaker phase and Hangman, which opens on the game panel instead of the columns', function () {
    $team = Team::factory()->create();
    $ada = p13dNamed(teamMember($team), 'Ada');

    $page = $this->signIn($ada, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 13 retro')
        ->assertSee('Start, Stop, Continue')
        ->click('[role="dialog"] li button:has-text("Start, Stop, Continue")')
        ->assertSeeIn('[role="dialog"] li button[aria-pressed="true"]', 'Start, Stop, Continue')
        ->click('#new-retro-icebreaker')
        ->assertAriaAttribute('#new-retro-icebreaker', 'checked', 'true')
        ->click('#new-retro-icebreaker-game')
        ->assertVisible('[role="option"]:has-text("Hangman")')
        ->click('[role="option"]:has-text("Hangman")')
        ->assertSeeIn('#new-retro-icebreaker-game', 'Hangman')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('[aria-current="step"]', 'Icebreaker')
        ->assertPresent('section[aria-label="Icebreaker game"]')
        ->assertSeeIn('[aria-label="Game"]', 'Hangman')
        ->assertCount('[data-test^="retro-column-"]', 0)
        ->assertSee('Ready to play?')
        ->click('Start')
        ->assertPresent('[role="group"][aria-label="Letters"]')
        ->assertPresent('[role="img"][aria-label$="letters left to find"]');

    $retro = Retro::query()->where('title', 'Sprint 13 retro')->sole();
    $room = GameRoom::query()->where('retro_id', $retro->id)->sole();

    expect($retro->icebreaker_enabled)->toBeTrue()
        ->and($retro->icebreaker_game)->toBe(GameKind::Hangman)
        ->and($retro->phase)->toBe(RetroPhase::Icebreaker)
        ->and($retro->columns()->count())->toBe(3)
        ->and($room->game)->toBe(GameKind::Hangman)
        ->and(GameRound::query()->where('game_room_id', $room->id)->whereNull('ended_at')->count())->toBe(1);
});

it('[P13d-06b] plays the game live on the board and keeps cursors and flying reactions working', function () {
    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = p13dIcebreaker();
    activeGameRound($room, ['word' => 'sprint']);

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('section[aria-label="Icebreaker game"]')
            ->assertPresent('[role="img"][aria-label="6 letters left to find"]')
            ->assertCount('[data-test^="retro-column-"]', 0)
            ->assertPresent('.lc-overlay')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]');
    }

    $a->assertSeeIn('[aria-label="Game"]', 'Hangman');
    $b->assertNotPresent('[aria-label="Game"]')
        ->assertSeeIn('section[aria-label="Icebreaker game"]', 'Hangman');

    $b->click('[role="group"][aria-label="Letters"] button:has-text("s")');

    $a->assertPresent('[role="img"][aria-label="5 letters left to find"]')
        ->assertSeeIn('ul[aria-label="Last letters"]', 'Bob picked S');

    $b->hover('[role="group"][aria-label="Letters"]')->hover('main.relative');
    $a->assertSeeIn('.lc-overlay', 'Bob');

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada');
});

it('[P13d-06c] abandons the round when the facilitator switches the game mid-round', function () {
    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = p13dIcebreaker();
    $round = activeGameRound($room, ['word' => 'sprint']);

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="group"][aria-label="Letters"]');
    }

    $a->click('[aria-label="Game"]')
        ->assertVisible('[role="option"]:has-text("Decoded")')
        ->click('[role="option"]:has-text("Decoded")')
        ->assertSeeIn('[aria-label="Game"]', 'Decoded');

    foreach ([$a, $b] as $page) {
        $page->assertNotPresent('[role="group"][aria-label="Letters"]')
            ->assertSeeIn('section[aria-label="Icebreaker game"]', 'Abandoned')
            ->assertSeeIn('section[aria-label="Icebreaker game"]', 'sprint');
    }

    $b->assertSeeIn('section[aria-label="Icebreaker game"]', 'Decoded')
        ->assertSee('Waiting for the host to start.');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Abandoned)
        ->and($room->fresh()->game)->toBe(GameKind::Decoded)
        ->and(GamePoint::query()->count())->toBe(0);
});

it('[P13d-06d] ends the round when the board timer set during it reaches zero', function () {
    config(['queue.default' => 'database']);

    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = p13dIcebreaker();
    $round = activeGameRound($room, ['word' => 'sprint']);

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="group"][aria-label="Letters"]')
            ->assertNotPresent('[role="timer"]');
    }

    $a->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($round->fresh()->ended_at)->toBeNull();

    $this->travel(61)->seconds();
    $this->workQueue();

    foreach ([$a, $b] as $page) {
        $page->assertNotPresent('[role="group"][aria-label="Letters"]')
            ->assertSeeIn('section[aria-label="Icebreaker game"]', "Time's up")
            ->assertSeeIn('section[aria-label="Icebreaker game"]', 'sprint');
    }

    $a->assertSee('Next round');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut)
        ->and(DB::table('jobs')->count())->toBe(0);
});

it('[P13d-06e] abandons the round and brings the columns back when the facilitator moves to Writing', function () {
    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = p13dIcebreaker();
    $round = activeGameRound($room, ['word' => 'sprint']);

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSeeIn('[aria-current="step"]', 'Icebreaker')
            ->assertPresent('[role="group"][aria-label="Letters"]');
    }

    $a->click('Next');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Writing')
            ->assertNotPresent('section[aria-label="Icebreaker game"]')
            ->assertCount('[data-test^="retro-column-"]', 3)
            ->assertSeeIn('main:has([data-test^="retro-column-"])', 'Continue');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Abandoned)
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Writing)
        ->and(GamePoint::query()->count())->toBe(0);
});
```

- [ ] **Step 2: Run the icebreaker tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php --filter='P13d-06'`
Expected: PASS (5 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 3: Add the "Games we played" tests (step 11)**

In the same file, add these two imports, keeping the list in alphabetical order:

```php
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
```

Then append to the end of the file:

```php
it('[P13d-11a] shows "Games we played" between the action items and ROTI, with the podium, "Show all" and a drawing replay, to a member and to a guest', function () {
    ['retro' => $retro, 'room' => $room, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = p13dIcebreaker(
        RetroPhase::Completed,
        GameKind::Hangman,
        ['completed_at' => now()],
    );
    $cleoPlayer = p13dIcebreakerPlayer($retro, $room, 'Cleo');
    $danPlayer = p13dIcebreakerPlayer($retro, $room, 'Dan');
    $hangman = GameRound::factory()->ended(GameRoundOutcome::Solved)->create([
        'game_room_id' => $room->id,
        'word' => 'sprint',
        'winner_player_id' => $bobPlayer->id,
        'ended_at' => now()->subMinutes(20),
    ]);
    $draw = GameRound::factory()->game(GameKind::DrawAndGuess)->ended(GameRoundOutcome::Guessed)->create([
        'game_room_id' => $room->id,
        'word' => 'rocket',
        'leader_player_id' => $adaPlayer->id,
        'winner_player_id' => $bobPlayer->id,
        'drawing' => [['type' => 'stroke', 'color' => 'black', 'size' => 4, 'points' => [[100, 100], [400, 300]]]],
        'ended_at' => now()->subMinutes(10),
    ]);
    $room->forceFill(['current_round_id' => $draw->id])->save();
    awardGamePoints($room, $bobPlayer, 6, true, ['game_round_id' => $hangman->id]);
    awardGamePoints($room, $cleoPlayer, 3, false, ['game_round_id' => $hangman->id]);
    awardGamePoints($room, $danPlayer, 1, false, ['game_round_id' => $hangman->id]);
    awardGamePoints($room, $bobPlayer, 10, true, ['game_round_id' => $draw->id, 'game' => GameKind::DrawAndGuess]);
    awardGamePoints($room, $adaPlayer, 5, false, ['game_round_id' => $draw->id, 'game' => GameKind::DrawAndGuess]);
    $games = 'section:has(> h2:has-text("Games we played"))';
    $inOrder = '(() => { const titles = [...document.querySelectorAll("section > h2")].map((title) => title.textContent); return titles.indexOf("Action items") >= 0 && titles.indexOf("Action items") < titles.indexOf("Games we played") && titles.indexOf("Games we played") < titles.indexOf("Return on time invested"); })()';

    $b = $this->signIn($bob, "/retros/{$retro->id}");
    $carol = $this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest');

    foreach ([$b, $carol] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertSeeIn($games, '2 rounds played')
            ->assertScript($inOrder, true)
            ->assertCount("{$games} ol.grid > li", 3)
            ->assertSeeIn("{$games} ol.grid", 'Bob')
            ->assertSeeIn("{$games} ol.grid", '16 points')
            ->assertSeeIn("{$games} ol.grid", 'Ada')
            ->assertSeeIn("{$games} ol.grid", 'Cleo')
            ->assertDontSeeIn("{$games} ol.grid", 'Dan')
            ->click("{$games} button:has-text(\"Show all\")")
            ->assertCount("{$games} ol.grid > li", 4)
            ->assertSeeIn("{$games} ol.grid", 'Dan')
            ->assertSeeIn($games, 'Show less')
            ->assertCount("{$games} ol.space-y-2 > li", 2)
            ->assertSeeIn("{$games} ol.space-y-2 > li:has-text(\"sprint\")", 'Solved')
            ->assertSeeIn("{$games} ol.space-y-2 > li:has-text(\"rocket\")", 'Guessed')
            ->assertCount("{$games} button:has-text(\"Replay\")", 1)
            ->click("{$games} button:has-text(\"Replay\")")
            ->assertPresent('[role="dialog"] canvas[aria-label="Drawing of rocket"]')
            ->assertSeeIn('[role="dialog"]', 'rocket');
    }
});

it('[P13d-11b] labels GIF tiles "Anonymous GIF" in "Games we played" of an anonymous retro', function () {
    ['retro' => $retro, 'room' => $room, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = p13dIcebreaker(
        RetroPhase::Completed,
        GameKind::SprintGif,
        ['completed_at' => now(), 'is_anonymous' => true, 'gifs_enabled' => true],
    );
    $round = GameRound::factory()->game(GameKind::SprintGif)->ended(GameRoundOutcome::Revealed)->create([
        'game_room_id' => $room->id,
        'word' => null,
        'question' => 'How did the sprint feel?',
        'revealed_at' => now()->subMinutes(15),
        'ended_at' => now()->subMinutes(10),
    ]);
    $room->forceFill(['current_round_id' => $round->id])->save();
    $adaAnswer = GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $adaPlayer->id, 'gif_id' => 'partyone']);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $bobPlayer->id, 'gif_id' => 'coffeeone']);
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $bobPlayer->id, 'answer_id' => $adaAnswer->id]);
    awardGamePoints($room, $adaPlayer, 0, false, ['game_round_id' => $round->id]);
    awardGamePoints($room, $bobPlayer, 0, false, ['game_round_id' => $round->id]);
    $games = 'section:has(> h2:has-text("Games we played"))';

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertSeeIn($games, '1 rounds played')
        ->assertSeeIn("{$games} ol.space-y-2 > li", 'How did the sprint feel?')
        ->assertSeeIn("{$games} ol.space-y-2 > li", 'Revealed')
        ->assertCount("{$games} figure", 2)
        ->assertCount("{$games} figcaption:has-text(\"Anonymous GIF\")", 2)
        ->assertSeeIn("{$games} figure:has(img[src=\"/gifs/partyone/preview\"])", 'Votes: 1')
        ->assertSeeIn("{$games} figure:has(img[src=\"/gifs/coffeeone/preview\"])", 'Votes: 0')
        ->assertDontSeeIn("{$games} ol.space-y-2", 'by Ada')
        ->assertDontSeeIn("{$games} ol.space-y-2", 'by Bob')
        ->assertNotPresent("{$games} button:has-text(\"Replay\")");
});
```

`[P13d-11b]` asserts "1 rounds played": the English string `:count rounds played` has no singular form (`lang/en.json`). The two GIF images are not loaded in this test (no provider is configured, so the proxy answers 404); the tiles and their captions are rendered all the same.

- [ ] **Step 4: Run the "Games we played" tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php --filter='P13d-11'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector` and keep its result.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php
git commit -m "test(browser): cover the icebreaker game and the games section of the retro results"
```

### Task 7: Guest play, scores, leaderboards, streaks and invites (plan 13d, steps 7 to 10 and 12)

This task adds steps 7, 9, 10 and 12 of the plan 13d walkthrough (lines 4441 to 4447 and 4449 to 4454 of the plan 13d file) to `tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php`. No product file changes, so no frontend build is needed.

Not automated in this task (see "Residual entries"):

- Step 8, the 13th browser session. The cap is the class constant `GameRoom::MaxOnlinePlayers = 12` (`app/Models/GameRoom.php`, line 54), compared in `BroadcastAuthorizationsController::authorizeGameChannel()` (line 155) with the live member list that `ReverbGamePresenceRoster` reads from Reverb. No configuration key lowers it, the roster comes from real sockets, and the suite opens at most four contexts.
- The loading skeleton of step 10, a state that lasts for one deferred request.
- The phone half of "desktop + phone" (line 4429).

Substitutions used (spec §3.6):

- Slack, Telegram, Microsoft Teams, Mattermost and the outgoing webhook are faked with `Http::fake()`. A provider is enabled by configuration (`IntegrationProvider::isConfigured()`): the test calls `enableIntegrations(...)` from `tests/Pest.php`, and connects the team with the `TeamIntegrationFactory` states `slack()`, `telegram()`, `microsoftTeams()`, `mattermost()` and `webhook()`. The webhook client resolves the host first, so the test also calls `outgoingWebhookResolves()` from `tests/Pest.php`. The OAuth round trip that connects Slack is not driven.
- Invites are delivered by a queued job. The tests set the `database` queue, see "Sending to Slack…" on the page, run the job with `$this->workQueue()`, and then see the line change, which is how the page behaves with a real worker.
- "Archive the Slack channel" becomes a Slack webhook that answers `404 channel_is_archived`.
- The two consecutive weeks are arranged by seeding `game_points.created_at`, which the walkthrough itself allows.

Facts about the interface that the selectors rely on (all read from the current code):

- The room sidebar (`room-sidebar.tsx`) has two tabs, `[role="tab"]` "Players" and "Scores", and one `[role="tabpanel"]`. The Players list is `section[aria-labelledby="game-players"]`; a guest's name is followed by "(guest)". The Scores list (`room-scores.tsx`) has one `li` per player with the points in an element labelled ":count points", "No points yet." when empty, and, for a room manager, the button "Reset scores" opening a dialog with a second "Reset scores" button.
- The end card lists the round's points in `ul[aria-label="Points of this round"]` as "+6 Casey" (`round-points.tsx`), and names the winner with ":name found it!".
- Hangman scoring (`HangmanRules::points()`): one point per position a player's letters revealed, plus five for the player who completes the word. With five positions of "sprint" credited to Ada and the last letter picked by the guest, Ada gets 5 and the guest 6.
- The team's Games page is `route('teams.games.index', [$workspace, $team])` (`resources/js/pages/games/index.tsx`). Its leaderboard is `section[aria-labelledby="team-leaderboard"]` (`team-leaderboard.tsx`): a toggle group `[aria-label="Period"]` with "Last 30 days" (default) and "All time", whose chosen item has `data-state="on"`, then one `li` per member with the name in `span.font-medium`, the badge ":count-week streak" from two weeks on, and the points. "No games played yet." is shown when the list is empty.
- The "Invite" button (`room-invite-button.tsx`) is shown only to a viewer who may share and only when at least one share channel is available. Its dialog "Invite to the room" (`room-invite-dialog.tsx`, `post-link-section.tsx`) has one button per available channel ("Post link to Slack", "Post link to Telegram", "Post link to Microsoft Teams", "Post link to Mattermost", "Send link to webhook"), a hint ("Only members of :team can join." on a `team` room, "Posted guest links stop working if you regenerate the link." on a `link` room), on a `link` room only a checkbox (`button[role="checkbox"]`) labelled "Include the guest link (anyone who can see the message can join)", and the delivery lines ("Sending to Slack…", "Sent to Slack · …", "Slack: failed — Reconnect Slack in the team settings.").
- A failed Slack post marks the connection as needing a reconnect, so "Post link to Slack" disappears; the failed line stays visible only because another channel (Telegram) keeps the section rendered.
- The Slack message is posted to the connection's `webhook_url` (`https://hooks.slack.com/…`) with the link in `blocks.1.elements.0.url`; Telegram receives `sendMessage` with the link inside `text`; the webhook request carries the header `X-Skrum-Event: game_room.link`.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php`
- Test: `tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php`

**Interfaces:**
- Consumes:
  - Everything Task 6 consumes, and the helpers of Task 6 (`p13dNamed`).
  - Helpers in `tests/Pest.php`: `gameRoomHost(GameRoom $room): array{0: User, 1: GamePlayer}`, `gameRoomMember(GameRoom $room): array{0: User, 1: GamePlayer}`, `activeGameRound()`, `awardGamePoints()`, `enableIntegrations(IntegrationProvider ...$providers): void`, `outgoingWebhookResolves(array $addresses = ['93.184.216.34']): void`.
  - Factories: `GameRoomFactory`, `TeamIntegrationFactory::slack()`, `telegram()`, `microsoftTeams()`, `mattermost()`, `webhook()`.
- Produces:
  - File-level helpers added to the same file: `p13dRoom(array $attributes = []): array`, `p13dMember(GameRoom $room, string $name): array`, `p13dTeamGamesPath(GameRoom $room): string`, `p13dOpenInvite(mixed $page): mixed`.
  - No product hook.

- [ ] **Step 1: Add the helpers and the guest, scores and leaderboard tests (steps 7, 9 and 10)**

In `tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php`, add this import, keeping the list in alphabetical order:

```php
use App\Enums\GameRoomAccess;
```

Insert these helpers after `p13dIcebreakerPlayer()` and before the first `it(`:

```php
/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     room: GameRoom,
 *     ada: User,
 *     adaPlayer: GamePlayer
 * }
 */
function p13dRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->create([
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    [$ada, $adaPlayer] = gameRoomHost($room);

    return [
        'room' => $room->fresh(),
        'ada' => p13dNamed($ada, 'Ada'),
        'adaPlayer' => $adaPlayer,
    ];
}

/**
 * @return array{0: User, 1: GamePlayer}
 */
function p13dMember(GameRoom $room, string $name): array
{
    [$user, $player] = gameRoomMember($room);

    return [p13dNamed($user, $name), $player];
}

function p13dTeamGamesPath(GameRoom $room): string
{
    return route('teams.games.index', [$room->team->workspace, $room->team], false);
}
```

Then append to the end of the file:

```php
it('[P13d-07] lets a visitor open the guest link of a link room, type a name and play', function () {
    ['room' => $room, 'ada' => $ada] = p13dRoom(['access' => GameRoomAccess::Link]);
    activeGameRound($room, ['word' => 'sprint']);
    $letter = fn (string $letter): string => "[role=\"group\"][aria-label=\"Letters\"] button:has-text(\"{$letter}\")";

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $c = visit(route('games.join.show', $room->guest_token, false));
    $c->assertSee('Friday fun')
        ->assertSee('You are invited to play Hangman. Choose the name other players will see.')
        ->fill('#name', 'Casey')
        ->click('Join')
        ->assertPathIs("/games/{$room->id}");
    $this->awaitRealtime($c);

    foreach ([$a, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="img"][aria-label="6 letters left to find"]')
            ->assertSeeIn('section[aria-labelledby="game-players"]', 'Casey')
            ->assertSeeIn('section[aria-labelledby="game-players"]', '(guest)');
    }

    $c->assertPresent('[aria-label="Language"]')
        ->assertNotPresent('[aria-label="Room menu"]')
        ->assertNotPresent('[aria-label="Game"]')
        ->assertNotPresent('[aria-label="Back to the team"]')
        ->click($letter('s'));

    $a->assertPresent('[role="img"][aria-label="5 letters left to find"]')
        ->assertSeeIn('ul[aria-label="Last letters"]', 'Casey picked S')
        ->click($letter('p'));

    $c->assertPresent('[role="img"][aria-label="4 letters left to find"]')
        ->assertSeeIn('ul[aria-label="Last letters"]', 'Ada picked P');

    $guest = GamePlayer::query()->where('game_room_id', $room->id)->where('guest_name', 'Casey')->sole();

    expect($guest->user_id)->toBeNull();
});

it('[P13d-09a] shows "+n" per scorer on the end card and the scores in both browsers, with the guest scoring in the room only', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13dRoom(['access' => GameRoomAccess::Link]);
    $round = activeGameRound($room, [
        'word' => 'sprint',
        'picked_letters' => ['s', 'p', 'r', 'i', 'n'],
        'picked_by' => array_fill(0, 5, $adaPlayer->id),
        'revealed_positions' => [0, 1, 2, 3, 4],
    ]);
    $board = 'section[aria-labelledby="team-leaderboard"]';

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $c = $this->awaitRealtime($this->joinAsGuest(route('games.join.show', $room->guest_token, false), 'Casey'));

    foreach ([$a, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="img"][aria-label="1 letters left to find"]');
    }

    $c->click('[role="group"][aria-label="Letters"] button:has-text("t")');

    foreach ([$a, $c] as $page) {
        $page->assertSee('Solved')
            ->assertSee('Casey found it!')
            ->assertSeeIn('ul[aria-label="Points of this round"]', '+6 Casey')
            ->assertSeeIn('ul[aria-label="Points of this round"]', '+5 Ada')
            ->click('[role="tab"]:has-text("Scores")')
            ->assertPresent('[role="tabpanel"] li:has-text("Casey") [aria-label="6 points"]')
            ->assertSeeIn('[role="tabpanel"] li:has-text("Casey")', '(guest)')
            ->assertPresent('[role="tabpanel"] li:has-text("Ada") [aria-label="5 points"]');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Solved)
        ->and(GamePoint::query()->where('game_room_id', $room->id)->whereNull('user_id')->sole()->points)->toBe(6)
        ->and(GamePoint::query()->where('player_id', $adaPlayer->id)->sole()->points)->toBe(5);

    $a->navigate(p13dTeamGamesPath($room))
        ->assertSeeIn("{$board} li:has-text(\"Ada\")", '5')
        ->assertCount("{$board} ol > li", 1)
        ->assertDontSeeIn($board, 'Casey');

    $c->navigate(p13dTeamGamesPath($room))
        ->assertPathIs('/login');
});

it('[P13d-09b] empties the room leaderboard on "Reset scores" while the team leaderboard keeps the points', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13dRoom();
    [$bob, $bobPlayer] = p13dMember($room, 'Bob');
    awardGamePoints($room, $adaPlayer, 7, true, ['created_at' => now()->subHour()]);
    awardGamePoints($room, $bobPlayer, 4, false, ['created_at' => now()->subHour()]);
    $board = 'section[aria-labelledby="team-leaderboard"]';

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->click('[role="tab"]:has-text("Scores")')
            ->assertPresent('[role="tabpanel"] li:has-text("Ada") [aria-label="7 points"]')
            ->assertPresent('[role="tabpanel"] li:has-text("Bob") [aria-label="4 points"]');
    }

    $b->assertDontSee('Reset scores');

    $a->click('Reset scores')
        ->assertSee('Scores in this room start again from zero. The team leaderboard keeps them.')
        ->click('[role="dialog"] button:has-text("Reset scores")')
        ->assertNotPresent('[role="dialog"]');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="tabpanel"]', 'No points yet.')
            ->assertNotPresent('[role="tabpanel"] ol');
    }

    expect($room->fresh()->scores_reset_at)->not->toBeNull()
        ->and(GamePoint::query()->where('game_room_id', $room->id)->count())->toBe(2);

    $a->navigate(p13dTeamGamesPath($room))
        ->assertSeeIn("{$board} li:has-text(\"Ada\")", '7')
        ->assertSeeIn("{$board} li:has-text(\"Bob\")", '4')
        ->assertCount("{$board} ol > li", 2);
});

it('[P13d-10a] shows a "2-week streak" badge to a member who scored in two consecutive weeks', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13dRoom();
    [, $bobPlayer] = p13dMember($room, 'Bob');
    awardGamePoints($room, $adaPlayer, 5, true, ['created_at' => now()->subWeek()]);
    awardGamePoints($room, $adaPlayer, 3, false, ['created_at' => now()]);
    awardGamePoints($room, $bobPlayer, 2, false, ['created_at' => now()]);
    $board = 'section[aria-labelledby="team-leaderboard"]';

    $page = $this->signIn($ada, p13dTeamGamesPath($room));

    $page->assertSee('Leaderboard')
        ->assertSeeIn("{$board} li:has-text(\"Ada\")", '2-week streak')
        ->assertSeeIn("{$board} li:has-text(\"Ada\")", '8')
        ->assertSeeIn("{$board} li:has-text(\"Bob\")", '2')
        ->assertDontSeeIn("{$board} li:has-text(\"Bob\")", 'streak');
});

it('[P13d-10b] switches the team leaderboard between "Last 30 days" and "All time"', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13dRoom();
    [, $bobPlayer] = p13dMember($room, 'Bob');
    awardGamePoints($room, $adaPlayer, 4, false, ['created_at' => now()]);
    awardGamePoints($room, $bobPlayer, 9, true, ['created_at' => now()->subDays(40)]);
    $board = 'section[aria-labelledby="team-leaderboard"]';
    $names = "[...document.querySelectorAll('section[aria-labelledby=\"team-leaderboard\"] ol > li span.font-medium')].map((name) => name.textContent).join(',')";

    $page = $this->signIn($ada, p13dTeamGamesPath($room));

    $page->assertSeeIn('[aria-label="Period"] [data-state="on"]', 'Last 30 days')
        ->assertScript($names, 'Ada')
        ->assertDontSeeIn($board, 'Bob')
        ->click('All time')
        ->assertSeeIn('[aria-label="Period"] [data-state="on"]', 'All time')
        ->assertScript($names, 'Bob,Ada')
        ->assertSeeIn("{$board} li:has-text(\"Bob\")", '9')
        ->click('Last 30 days')
        ->assertSeeIn('[aria-label="Period"] [data-state="on"]', 'Last 30 days')
        ->assertScript($names, 'Ada');
});
```

`[P13d-09a]` arranges a Hangman round in which five of the six letters of "sprint" are already picked by Ada, so the guest's single letter ends the round: letter picks are limited to a burst of three per player. The mask's label for one hidden letter is "1 letters left to find": the English string `:count letters left to find` has no singular form (`lang/en.json`).

- [ ] **Step 2: Run the guest, scores and leaderboard tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php --filter='P13d-07|P13d-09|P13d-10'`
Expected: PASS (5 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 3: Add the invite tests (step 12)**

In the same file, add these imports, keeping the list in alphabetical order:

```php
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
```

Insert this helper after `p13dTeamGamesPath()`:

```php
function p13dOpenInvite(mixed $page): mixed
{
    return $page->assertSee('Invite')
        ->click('Invite')
        ->assertSee('Invite to the room')
        ->assertSee('Post a link');
}
```

Then append to the end of the file:

```php
it('[P13d-12a] posts the room invite to Slack and to Telegram with a link that opens the room', function () {
    config(['queue.default' => 'database']);
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    Http::fake([
        'hooks.slack.com/*' => Http::response('ok'),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
    ]);
    ['room' => $room, 'ada' => $ada] = p13dRoom();
    [$bob] = p13dMember($room, 'Bob');
    TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    p13dOpenInvite($a)
        ->click('Post link to Slack')
        ->assertSee('The message is on its way.')
        ->assertSee('Sending to Slack…');

    $this->workQueue();

    $a->assertSee('Sent to Slack')
        ->click('Post link to Telegram')
        ->assertSee('Sending to Telegram…');

    $this->workQueue();

    $a->assertSee('Sent to Telegram')
        ->assertSee('Sent to Slack');

    Http::assertSent(fn (HttpRequest $request): bool => str_starts_with($request->url(), 'https://hooks.slack.com/')
        && str_contains((string) $request['text'], 'Ada invites you to play Hangman in "Friday fun" (Platform)')
        && str_ends_with((string) data_get($request->data(), 'blocks.1.elements.0.url'), "/games/{$room->id}"));

    Http::assertSent(fn (HttpRequest $request): bool => str_contains($request->url(), 'api.telegram.org')
        && str_contains($request->url(), '/sendMessage')
        && str_contains((string) $request['text'], "/games/{$room->id}")
        && ! str_contains((string) $request['text'], '/play/'));

    expect(IntegrationDelivery::query()->where('status', IntegrationDeliveryStatus::Sent)->count())->toBe(2);

    $b = $this->signIn($bob, "/games/{$room->id}");

    $b->assertPathIs("/games/{$room->id}")
        ->assertSeeIn('header > h1', 'Friday fun');
});

it('[P13d-12b] posts the guest join link of a link room when "Include the guest link" is ticked', function () {
    config(['queue.default' => 'database']);
    enableIntegrations(IntegrationProvider::Slack);
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    ['room' => $room, 'ada' => $ada] = p13dRoom(['access' => GameRoomAccess::Link]);
    TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    p13dOpenInvite($a)
        ->assertSee('Posted guest links stop working if you regenerate the link.')
        ->assertAriaAttribute('[role="dialog"] button[role="checkbox"]', 'checked', 'false')
        ->click('[role="dialog"] button[role="checkbox"]')
        ->assertAriaAttribute('[role="dialog"] button[role="checkbox"]', 'checked', 'true')
        ->click('Post link to Slack')
        ->assertSee('Sending to Slack…');

    $this->workQueue();

    $a->assertSee('Sent to Slack');

    Http::assertSent(fn (HttpRequest $request): bool => str_starts_with($request->url(), 'https://hooks.slack.com/')
        && str_ends_with((string) data_get($request->data(), 'blocks.1.elements.0.url'), "/play/{$room->guest_token}"));

    $visitor = visit("/play/{$room->guest_token}");

    $visitor->assertPathIs("/play/{$room->guest_token}")
        ->assertSee('Friday fun')
        ->assertSee('You are invited to play Hangman. Choose the name other players will see.')
        ->assertVisible('#name');
});

it('[P13d-12c] offers no guest link on a team room, says who can join, and shows "Invite" to room managers only', function () {
    enableIntegrations(IntegrationProvider::Slack);
    ['room' => $room, 'ada' => $ada] = p13dRoom();
    [$bob] = p13dMember($room, 'Bob');
    TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $b->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertDontSee('Invite')
        ->assertNotPresent('[aria-label="Copy guest link"]');

    p13dOpenInvite($a)
        ->assertSee('Only members of Platform can join.')
        ->assertSee('Post link to Slack')
        ->assertNotPresent('[role="dialog"] button[role="checkbox"]')
        ->assertDontSee('Include the guest link');
});

it('[P13d-12d] turns the delivery line to "Slack: failed — Reconnect Slack in the team settings." when the Slack channel is gone', function () {
    config(['queue.default' => 'database']);
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    Http::fake([
        'hooks.slack.com/*' => Http::response('channel_is_archived', 404),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
    ]);
    ['room' => $room, 'ada' => $ada] = p13dRoom();
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    p13dOpenInvite($a)
        ->click('Post link to Slack')
        ->assertSee('Sending to Slack…');

    $this->workQueue();

    $a->assertSee('Slack: failed — Reconnect Slack in the team settings.')
        ->assertDontSee('Post link to Slack')
        ->assertSee('Post link to Telegram');

    expect($slack->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Failed);
});

it('[P13d-12e] offers Microsoft Teams, Mattermost and the webhook when the team connected them, and posts to each', function () {
    config(['queue.default' => 'database']);
    enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost, IntegrationProvider::Webhook);
    outgoingWebhookResolves();
    Http::fake([
        'prod-12.westeurope.logic.azure.com*' => Http::response('', 202),
        'chat.example.com/*' => Http::response('ok'),
        'hooks.example.com/*' => Http::response('', 202),
    ]);
    ['room' => $room, 'ada' => $ada] = p13dRoom();
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $room->team_id]);
    TeamIntegration::factory()->mattermost()->create(['team_id' => $room->team_id]);
    TeamIntegration::factory()->webhook()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    p13dOpenInvite($a)
        ->assertDontSee('Post link to Slack')
        ->assertDontSee('Post link to Telegram')
        ->click('Post link to Microsoft Teams')
        ->assertSee('Sending to Microsoft Teams…');

    $this->workQueue();

    $a->assertSee('Sent to Microsoft Teams')
        ->click('Post link to Mattermost')
        ->assertSee('Sending to Mattermost…');

    $this->workQueue();

    $a->assertSee('Sent to Mattermost')
        ->click('Send link to webhook')
        ->assertSee('Sending to Webhook…');

    $this->workQueue();

    $a->assertSee('Sent to Webhook');

    Http::assertSent(fn (HttpRequest $request): bool => str_contains($request->url(), 'prod-12.westeurope.logic.azure.com')
        && str_contains($request->body(), $room->id));

    Http::assertSent(fn (HttpRequest $request): bool => str_starts_with($request->url(), 'https://chat.example.com/hooks/')
        && str_contains((string) $request['text'], "/games/{$room->id}"));

    Http::assertSent(fn (HttpRequest $request): bool => str_starts_with($request->url(), 'https://hooks.example.com/')
        && $request->hasHeader('X-Skrum-Event', 'game_room.link')
        && str_contains($request->body(), $room->id));

    expect(IntegrationDelivery::query()->where('status', IntegrationDeliveryStatus::Sent)->count())->toBe(3);
});
```

The invite endpoint accepts five posts a minute per user; no test makes more than three. `IntegrationDelivery::status` and `TeamIntegration::status` are cast to `IntegrationDeliveryStatus` and `IntegrationStatus`. If the delivery line does not change after `$this->workQueue()`, see the harness findings.

- [ ] **Step 4: Run the invite tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php --filter='P13d-12'`
Expected: PASS (5 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector` and keep its result.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php`
Expected: PASS (17 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php
git commit -m "test(browser): cover guest play, scores, leaderboards and invites of the games walkthrough"
```

### Task 8: Coverage table and residual checklist

**Files:**
- Modify: `docs/superpowers/walkthroughs/coverage.md` (summary rows, one section per walkthrough of this plan, notes)
- Modify: `docs/superpowers/walkthroughs/residual-manual-checklist.md` (one section per walkthrough of this plan that has residual steps)

**Interfaces:**
- Consumes: the test identifiers of the walkthrough tasks of this plan, as implemented.
- Produces: the rows acceptance criterion 5 of the spec asks for, for this plan's walkthroughs.

The rows below were written with the plan, before any test ran. Before writing them, read the walkthrough test files as implemented and the task reports: where a test was renamed, split, dropped, or changed status, change its row to match the code. A row is `auto` or `auto-substituted` only if its test exists and passes.

- [ ] **Step 1: Add the summary rows**

In `docs/superpowers/walkthroughs/coverage.md`, in the Summary table, add these rows before the `**Total**` row, and recompute the total row from all rows of the table (this plan adds 64 rows: 30 `auto`, 27 `auto-substituted`, 7 `residual`, as planned):

```markdown
| Plan 13a: games foundation | 11 | 5 | 5 | 1 |
| Plan 13b: Draw & Guess and Decoded | 20 | 10 | 8 | 2 |
| Plan 13c: Sprint in one GIF | 8 | 0 | 7 | 1 |
| Plan 13d: icebreaker, scores, invites | 25 | 15 | 7 | 3 |
```

- [ ] **Step 2: Add one section per walkthrough**

In the same file, insert these sections before the `## Notes` section:

````markdown
## Plan 13a: games foundation

Walkthrough: `docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P13a-01 | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10651 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto |
| P13a-02 | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10652 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto-substituted |
| P13a-03 | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10653 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto-substituted |
| P13a-04a | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10654 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto |
| P13a-04b | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10654 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto-substituted |
| P13a-05 | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10655 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto |
| P13a-06a | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10656 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto-substituted |
| P13a-06b | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10656 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto-substituted |
| P13a-07 | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10657 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto |
| P13a-08 | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10658 | (none) | residual |
| P13a-09 | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10659 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto |

## Plan 13b: Draw & Guess and Decoded

Walkthrough: `docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P13b-01 | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5573 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto |
| P13b-02 | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5574 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto |
| P13b-03 | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5575 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-04a | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5576 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-04b | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5576 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-04t | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5576 | (none) | residual |
| P13b-05a | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5577 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-05b | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5577 | (none) | residual |
| P13b-06 | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5578 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-07 | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5579 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto |
| P13b-08 | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5580 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto |
| P13b-09 | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5581 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto |
| P13b-10 | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5582 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto |
| P13b-11a | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5583 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-11b | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5583 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-11c | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5583 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto |
| P13b-12a | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5584 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto |
| P13b-12b | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5584 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto |
| P13b-13a | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5585 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-13b | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5585 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto |

## Plan 13c: Sprint in one GIF

Walkthrough: `docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P13c-01 | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3918 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-02 | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3919 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-02r | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3916 | (none) | residual |
| P13c-03 | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3920 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-04 | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3921 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-05a | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3922 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-05b | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3922 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-06 | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3923 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |

## Plan 13d: icebreaker, scores, invites

Walkthrough: `docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P13d-00p | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4429 | (none) | residual |
| P13d-01 | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4431 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php (`P13b-01` to `P13b-10`, Task 3) | auto-substituted |
| P13d-02 | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4432 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php (`P13b-01` to `P13b-10`, Task 3) | auto |
| P13d-03 | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4433 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php (`P13c-03`, `P13c-04`, `P13c-05a`) | auto-substituted |
| P13d-04 | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4434 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php (`P13a-01` to `P13a-05`, Task 1) | auto |
| P13d-05 | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4435 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php (`P13b-11a` to `P13b-13b`, Task 4) | auto |
| P13d-06a | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4436 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-06b | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4437 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-06c | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4438 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-06d | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4439 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto-substituted |
| P13d-06e | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4440 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-07 | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4441 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-08 | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4442 | (none) | residual |
| P13d-09a | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4444 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-09b | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4446 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-10a | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4447 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-10b | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4447 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-10c | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4447 | (none) | residual |
| P13d-11a | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4448 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-11b | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4448 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-12a | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4450 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto-substituted |
| P13d-12b | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4451 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto-substituted |
| P13d-12c | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4452 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto |
| P13d-12d | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4453 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto-substituted |
| P13d-12e | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4454 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php | auto-substituted |

````

- [ ] **Step 3: Add the notes**

In the same file, append these bullets to the `## Notes` section (drop a bullet whose difference turned out not to exist; add one for each difference found while implementing):

````markdown
- **P13a-02**: the walkthrough said "copy the guest link". The header has no field holding the link, only the icon button "Copy guest link", which writes to the clipboard and shows "Link copied". The test replaces `navigator.clipboard.writeText` in the host's page, presses the button, and reads what the product passed to it. The join link is `/play/{token}`. The suggestion "in the browser's language" is asserted for English only (the suite's browser locale), against `resources/games/guest-names/en.php`.
- **P13a-03**: "not visible in the page source or the network tab" is asserted on `content()` and on the snapshot JSON fetched from inside each page, for the host and the guest, before and after a reload. Hangman has no leader, so nobody receives the word. The word is fixed by binding the real `GameWordBook` with a one-word list, because the round is started with the "Start" button.
- **P13a-04b**: "the same letter twice shows a toast". A picked key is disabled for every player once the pick is broadcast, so the toast "This letter was already picked." only appears in a race. The test writes the first pick to the database without a broadcast and lets the guest press the still-enabled key.
- **P13a-06a / P13a-06b**: the browser's clock does not move with `travel()`. The tests assert the countdown badge before the travel and the end card after it, not the countdown reaching zero on screen.
- **P13a-07**: the walkthrough said the guest sees "Your access to this room has ended." "after the next action". Today the settings change broadcasts `game.room.changed`, the guest's page refetches its snapshot at once and shows the message without any action. The test asserts that, and also that the guest is sent to `/login` on a reload and that the old link is "no longer valid".
- **P13b-02**: the walkthrough said "Who draws?" is preselected on the guest. Feature spec §4.1 and `nextLeaderId()` preselect the next online player after the previous leader in join order, and the first online player when no round was led yet, which is the host in a new room. The test asserts the host is preselected, then chooses the guest in the picker. The rotation after a led round is asserted by `P13b-10`.
- **P13b-03 to P13b-09, P13b-10**: a second team member ("Bob Leader") is the drawer instead of the walkthrough's guest on a phone, so rounds can be arranged with factories. The guest's way into a Draw & Guess round is `P13b-02`.
- **P13b-04a, P13b-04b, P13b-05a, P13b-06, P13b-13a**: the canvas is driven by `PointerEvent`s dispatched with `script()` (with `setPointerCapture` replaced on the canvas element, because a synthetic pointer cannot be captured) and checked by reading pixels with `getImageData()`. "A long stroke keeps flowing without gaps" is asserted as: 451 points become two stored operations of 400 and 52 points, the second starting at the first one's last point, with the joint pixel painted on the viewer's canvas.
- **P13b-05a**: "compare screenshots" is replaced by three sampled pixels and a checksum of the whole canvas on both pages; the comparison across real devices is `P13b-05b`.
- **P13b-08**: "the button counts down to zero at half the letters" is asserted on a four-letter word ("lamp"): "(2 left)", "(1 left)", then "(0 left)" disabled.
- **P13b-11a / P13b-11b**: the walkthrough named 🚀 and 🌕 "from the picker". The quick row holds 👍 ❤️ 👏 🎉 🤔 👎 today, so 👍 comes from the quick row and 🚀 and 🌕 from the full list. The full list's data normally comes from `cdn.jsdelivr.net` through `EmojiDataController`; the tests put a three-emoji data set on a faked storage disk instead. The refused emoji is the keycap 1️⃣; the flag 🇫🇷 is not tested because the picker hides flags where the system font cannot draw them. `P13b-11b` also asserts that a full clue offers no sixth slot (the server message "A clue holds five emoji at most." cannot be reached from the interface).
- **P13b-11c**: not a walkthrough sentence of its own; it adds the guess path of a Decoded round (wrong guess shown to the clue giver, correct guess ends the round), which step 11 implies.
- **P13b-12b**: "Give up" ends a Hangman round with the outcome "Passed"; the test asserts the badge "Passed".
- **P13c-01 to P13c-06**: GIPHY is faked; the fake derives the returned ids from the search word so that two players never receive the same ids. The Tenor variant of the attribution line is not exercised (`P13c-02r`).
- **P13c-02**: "check the network tab: no other player's GIF id before the reveal" is asserted as: the id is absent from the other page's document, and absent from the JSON snapshot that the other page fetches from `/games/{room}/snapshot`. Payload redaction of the broadcasts stays covered by `tests/Feature/Games/SprintGifRedactionTest.php`.
- **P13c-03, P13c-05b, P13d-06d**: the one-minute wait is replaced by the `database` queue, a 61-second jump of the server clock and one run of the queue. The browser's own countdown does not move, so the tests do not assert "Time's up" in the header badge; they assert what the expiry did.
- **P13c-03**: "the host sets a new timer" is asserted as a new expiry job and a future `timer_ends_at`, not as a countdown value, because the browser's clock is 61 seconds behind the server's after the jump.
- **P13c-04**: the walkthrough has two players, who each have exactly one GIF to vote for; the test seeds a third answer by an offline member so that "changes the vote" has a second target. Answers are seeded with factories; picking them through the dialog is covered by `P13c-02`.
- **P13c-06**: today's interface has no control that starts the next round while a round is in its voting window ("Next round" is rendered only by the end card). The test sends `POST /games/{room}/rounds` from the host's signed-in page and asserts what both browsers show. The server rule is also covered by `tests/Feature/Games/SprintGifTest.php` ("closes the voting when the host starts the next round, but not before the reveal").
- **P13d-03**: step 3 of the plan 13d walkthrough restates the plan 13c walkthrough; it is covered by `P13c-03`, `P13c-04` and `P13c-05a`.
- **P13d-06a**: "and move to Icebreaker" needs no action: a retro created with the Icebreaker phase starts in it (`CreateRetro` uses `Retro::firstPhase()`).
- **P13d-06c**: the test switches to Decoded; the walkthrough does not name the target game.
- **P13d-09a**: the round is arranged one letter from the end because letter picks are rate-limited to a burst of three per player. The same test covers "guests score only in their room" (spec §4.7): the guest is on the room's Scores tab and absent from the team leaderboard, and the guest's browser is sent to `/login` when it opens the team's Games page.
- **P13d-10a**: the two weeks are arranged by seeding `game_points.created_at`, as the walkthrough allows.
- **P13d-11a**: the podium, "Show all" and "Replay" are checked for a member and for a guest who joins the completed retro through its guest link. The replay asserts that the canvas "Drawing of rocket" is shown, not what is painted on it; canvas content is covered by the Draw tests of Tasks 1–4.
- **P13d-12a, P13d-12b**: "the message opens `/games/{room}`" and "opens the guest join page" are asserted on the link that skrum sends to the faked provider, and by opening that path in a browser.
- **P13d-12d**: "Archive the Slack channel" is a faked `404 channel_is_archived` answer from the Slack webhook. The failed line is visible because Telegram is also connected: with Slack as the only channel the invite section disappears once Slack needs a reconnect (see "Notes for the lead").
- **P13d-12e**: the walkthrough says "Spec 8's channels (Teams, Mattermost, webhook) are not built yet and do not appear". Plan 14 has built them since. Following the games spec §3.1 ("each channel is offered independently"), the test asserts that the three channels appear when the team connected them, that each posts, and that Slack and Telegram do not appear when they are not connected.
````

If a defect was found and fixed under the Defect rule, add its line under `## Defects found`.

- [ ] **Step 4: Add the residual entries**

In `docs/superpowers/walkthroughs/residual-manual-checklist.md`, append a section per walkthrough of this plan (heading `## <walkthrough title>` as in the coverage table) and distribute these entries under them by identifier:

````markdown
- **P13a-08** — "Open 13 browser sessions (12 team/guest sessions online, then one more): the 13th shows 'This room is full.' with 'Try again'." Not automated: the cap counts players who are online on the real Reverb presence channel (`ReverbGamePresenceRoster` asks Reverb for the members of `presence-game.{room}`), so it needs thirteen live sockets; the suite opens at most four browser contexts in a test, the cap is the constant `GameRoom::MaxOnlinePlayers` with no configuration key to lower it, and the browser tests do not replace the presence roster. The refusal of a 13th member, the reconnection of a present member and the fail-open case are covered by `tests/Feature/Games/GameBroadcastAuthorizationTest.php`. Check by hand: create a link room; open it in twelve browser profiles or private windows (the host plus eleven guests through the guest link) and confirm the header shows "12 online"; join with a thirteenth: its page must show "This room is full.", "Up to 12 players can be online at once." and the button "Try again"; close one of the twelve and press "Try again": the thirteenth now enters the room.
- **P13b-04t** — "The guest draws slowly [on the phone] … then stays identical after the finger lifts." Not automated: the suite drives a synthetic mouse pointer; touch and pen input are out of scope (browser test spec §1). `[P13b-04a]` and `[P13b-04b]` cover the live line, the commit and the long stroke with a mouse pointer. Check by hand: start a Draw & Guess round with the drawer on a phone or tablet; draw slowly with a finger and confirm on a desktop browser that the line follows the finger while it moves, that the page does not scroll or zoom under the finger, that a second finger does not start a second line, and that the line is unchanged after the finger lifts.
- **P13b-05b** — "The fill stops at the same edge on both screens (compare screenshots)." Not automated: comparing the rendering of two real devices is a judgement of visual quality (browser test spec §1, "fill parity in the drawing game"). `[P13b-05a]` asserts that the drawer's and the viewer's canvases hold the same pixels, but both run in the same Chromium on the same machine. Check by hand: with the drawer on a phone and a guesser on a desktop (different screen densities), draw a closed shape with a thin gap-free outline, fill its inside, and take a screenshot of the canvas on each device; the fill must stop at the outline on both, leave no unfilled fringe inside it and not leak outside it; repeat with a shape whose outline has a visible gap and confirm the fill leaks through the gap identically on both.
- **P13c-02r** — "With `SKRUM_GIF_PROVIDER` and `SKRUM_GIF_API_KEY` set … (attribution "Powered by GIPHY"/"Tenor" visible)". Not automated: a search against the real GIPHY or Tenor service, with real images and the Tenor attribution, needs a real provider key, which spec §1 puts out of scope; the tests fake GIPHY. Check by hand: set `SKRUM_GIF_PROVIDER=giphy` and a real `SKRUM_GIF_API_KEY`, open a "Sprint in one GIF" round, search a word and confirm that animated results load, that the chosen GIF shows in "Your GIF", and that the dialog says "Powered by GIPHY"; repeat with `SKRUM_GIF_PROVIDER=tenor` and confirm "Powered by Tenor".
- **P13d-00p** — "desktop + phone". Not automated: the suite drives a desktop browser with a mouse; touch devices and the judgement of the layout on a phone are out of scope (spec §1). Check by hand: on a phone, open a room for each of the four games, play one round of each (draw with a finger, pick letters, type a guess, pick and vote for a GIF), and confirm that every control is reachable and that nothing overlaps or is cut off.
- **P13d-08** — "Player cap: open a 13th browser session on the same room: "This room is full."". Not automated: the cap is the constant `GameRoom::MaxOnlinePlayers = 12`, checked against the live Reverb member list of the room's presence channel when a socket is authorized; no configuration key lowers it, and the suite opens at most four browser contexts. The refusal itself is covered by `tests/Feature/Games/GameBroadcastAuthorizationTest.php` with a fake roster. Check by hand: open one `link` room in 12 separate browser sessions (private windows or profiles, each joined as a different guest), then open a 13th; it must show "This room is full." and "Up to 12 players can be online at once."; close one of the twelve, click "Try again" in the 13th and confirm that it enters the room.
- **P13d-10c** — ""All time" and "Last 30 days" switch the list, with a skeleton while loading". Not automated: the skeleton is shown only while one deferred request is pending, and the suite cannot hold a request open; `P13d-10b` covers the switch itself. Check by hand: open the team's Games page with the browser's network throttling set to "Slow 3G", and confirm that three pulsing grey bars show under "Leaderboard" on the first load and again after clicking "All time", until the list arrives.
````

- [ ] **Step 5: Check the table against the tests**

Run: `grep -ohE "\[P[0-9]+[a-z]?-[0-9]{2}[a-z]*\]" tests/Browser/Walkthroughs/*.php | sort -u | wc -l` and `grep -cE "^\| P[0-9]+[a-z]?-" docs/superpowers/walkthroughs/coverage.md`.
Expected: every identifier used in a test title appears in a row (alone or in a row that names its tests); every `auto` or `auto-substituted` row names an identifier that exists in a test title; `grep -cE "\| residual \|$" docs/superpowers/walkthroughs/coverage.md` equals `grep -c "^- \*\*P" docs/superpowers/walkthroughs/residual-manual-checklist.md`.

- [ ] **Step 6: Format the two documents and commit**

Run: `npx vp fmt docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md`, then check with `git diff --stat` that only these two files changed.

```bash
git add docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md
git commit -m "docs: add the plan 16d walkthroughs to the coverage table and the residual checklist"
```

### Task 9: Final verification

**Files:**
- Modify: `docs/superpowers/walkthroughs/coverage.md` (verification record at the end)

**Interfaces:**
- Consumes: everything produced by the tasks of this plan.
- Produces: the evidence that this plan's walkthroughs meet the spec's criterion 5 and leave criteria 1, 2, 6, 7, 9 and 10 intact.

Do not claim a result without the output of its command in front of you.

- [ ] **Step 1: Run the browser suite twice**

Run: `composer test:browser && composer test:browser`
Expected: PASS both times with the same number of tests; `lsof -i :8097` prints nothing afterwards. A test that passes once and fails once is flaky: find the missing wait and fix it before continuing.

- [ ] **Step 2: Run the architecture suite and the source scan**

Run: `composer test:arch`
Expected: PASS.

- [ ] **Step 3: Run the whole existing suite and the static checks**

Run: `composer test`, then `composer rector:check`, then `npm run types:check && npm run check`.
Expected: PASS; no browser test listed by `composer test`; Rector reports no change; `npm run check` lists no file touched by this plan.

- [ ] **Step 4: Check what product code changed**

Run: `git diff <first commit of this plan>^..HEAD -- app routes resources/js | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vE "data-test|data-realtime|realtimeState"`
Expected: nothing, except the re-wrapped lines around an added attribute and any `fix(...)` commit made under the Defect rule (list those in the record).

- [ ] **Step 5: Record the verification**

Append to `docs/superpowers/walkthroughs/coverage.md`:

```markdown
## Verification of plan 16d

Date: <YYYY-MM-DD>

| Check | Evidence |
|---|---|
| Browser suite, twice | <n> tests, <seconds> s and <seconds> s |
| Arch suite and source scan | green |
| `composer test` | green, no browser test listed |
| Rector, types, lint | clean |
| Coverage rows of this plan | <n> rows: <n> `auto`, <n> `auto-substituted`, <n> `residual` |
| Product diff | only `data-test` / `data-realtime` (and these defect fixes: <list or "none">) |
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/walkthroughs/coverage.md
git commit -m "docs: record the verification of plan 16d"
```

---

## Appendix: notes from drafting

Nothing in this plan was executed while it was written. The notes below record what was read, what could not be verified, and the fallback for each doubt. Where a note says "the lead", read "whoever executes the plan".

### From `16d-1-games-foundation-draw.md`

**Facts that contradict the brief or the assignment**

- There is no configuration key for the player cap: `app/Models/GameRoom.php:54` (`public const MaxOnlinePlayers = 12;`), read at `app/Http/Controllers/BroadcastAuthorizationsController.php:155`. Lowering it would need product code, so step 8 is `residual`. If the lead prefers an automated row, the only route that changes no product code is binding `App\Contracts\GamePresenceRoster` to a class that returns twelve foreign ids (as `fakeGameRoster()` in `tests/Pest.php` does); that makes the "This room is full." page reachable with one browser context, but it is exactly the "fake presence roster" that plan 16a's Global Constraints forbid in browser tests, so I did not use it.
- The guest link is not in an input (brief §3.6 "read the input's `value()`"): `resources/js/components/games/room-header.tsx:24-35` only calls `navigator.clipboard.writeText(room.guestUrl)`. `[P13a-02]` replaces `writeText` in the page.
- The guest join URL is `/play/{guestToken}` (`routes/web.php:476`), not `/games/join/…`.
- `$this->workQueue()` does not exist in `tests/Browser/Support/InteractsWithBrowser.php` today; Task 2 states the dependency on plan 16b Task 1 and gives the local fallback.
- A fake rules class was not needed. Words are fixed two ways: by factory (`activeGameRound($room, ['word' => …])`) wherever the test starts mid-round, and by binding the real `App\Support\Games\GameWordBook` with a one-word list (`app()->instance(GameWordBook::class, new GameWordBook(words: […]))`) in the three tests that press "Start" (`P13a-03`, `P13a-06a`, `P13b-02`). `DrawGameWord` receives the book from the container and `GameRulesRegistry` is rebuilt on every resolution (`app/Providers/AppServiceProvider.php:49`), so the instance is used.

**Hooks**

None. No `data-test` attribute and no `data-realtime` addition is needed for these four tasks; no `.tsx` file changes, so no `npm run build` step is in the tasks.

**Dependencies on other sections**

- Plan 16b Task 1: `$this->workQueue()` (used by `[P13a-06a]` only).
- `tests/Pest.php` helpers `teamMember`, `gameRoomHost`, `gameRoomMember`, `activeGameRound`, `gamePayloadExposesWord` (existing).
- Whoever drafts plans 13c and 13d in the same plan 16d must not redeclare `p13a*` or `p13b*` functions.

**Rate limits the tests respect**

Letters and guesses: burst of three per player, then one per second (`GameLettersController`, `GameGuessesController`). No test makes more than three picks or three guesses per player. Drawing operations: burst of 20; the largest test sends three.

**UNVERIFIED items and their fallbacks**

- UNVERIFIED: synthetic `PointerEvent`s dispatched with `script()` reach React's `onPointerDown`/`onPointerMove`/`onPointerUp` on the canvas, and replacing `canvas.setPointerCapture` on the element avoids the `NotFoundError` a synthetic pointer id would raise at `drawing-canvas.tsx:270`. Fallback: commit strokes through the real endpoint from inside the drawer's page (`fetch` `POST /games/{room}/rounds/{round}/drawing-ops` with the page's XSRF cookie and `X-Socket-ID`), keep the pixel assertions on the viewer, and move the live-preview half of `P13b-04a` to the residual checklist.
- UNVERIFIED: the centre pixel of a live preview line is exactly `23 23 23 255`. Fallback written in Task 3 Step 4 (assert "not white" for the one pre-commit assertion).
- UNVERIFIED: `getImageData()` on the product's canvas through a second `getContext('2d')` call returns the painted pixels (it should: the same context object is returned).
- UNVERIFIED: replacing `navigator.clipboard.writeText` by assignment works in the plugin's Chromium context, and `navigator.clipboard` exists on `http://127.0.0.1`. Fallback written in Task 1 Step 2 (read `room.guestUrl` from the snapshot).
- UNVERIFIED: `script()` returns the resolved value of a promise as a PHP string or int (`Webpage::script()` returns `page->evaluate()`; the harness findings only say that it awaits a promise). `[P13b-03]` compares a status with `toBe(403)` and several tests pass an int to `assertScript()` for a fetched length; if numbers come back as floats, cast in the script with `String(…)` and compare strings.
- UNVERIFIED: `app()->instance(GameWordBook::class, …)` made in the test survives the per-request reset of `BrowserTestCase` (`forgetScopedInstances()` only drops scoped bindings, so it should). Each test that relies on it asserts the stored word, so a failure is explicit. Fallback: press "Start" without fixing the word and read the word from the database (`GameRound::query()->sole()->word`) for the assertions.
- UNVERIFIED: `Storage::fake()` plus a hand-written three-emoji emojibase data set is accepted by `frimousse` (fields read from its bundled source: `emoji`, `label`, `group`, `version`, `tags`, `subgroup`; `groups`, `subgroups`, `skinTones`). Fallback: `Http::fake(['cdn.jsdelivr.net/*' => …])` with the same two bodies and `Content-Type: application/json`, leaving the disk empty; or, if the list cannot be made to render, keep the quick-row part of `P13b-11a` and move the full-list parts of `P13b-11a` and `P13b-11b` to the residual checklist.
- UNVERIFIED: `content()` returns the live DOM including the Inertia page data; the tests only assert the word's absence from it, and the positive control is the snapshot JSON.
- UNVERIFIED: the lazy expiry of `[P13a-06b]` relies on no request reaching the room between `travel()` and the host's reload (the pages do not poll). If a page does send a request in between, the `ended_at` null assertion before the reload fails; remove that one assertion.
- UNVERIFIED: `assertSee('0:5')` matches the countdown badge by substring ("0:59"…"0:50"); it needs the assertion to run within ten seconds of setting the timer, which the 20-second timeout does not guarantee on a very slow run. Fallback: assert `assertPresent('header [data-slot="badge"].tabular-nums')` instead.
- UNVERIFIED: ordering of players in `p13bRoom()`: the host's `created_at` is moved five minutes back so that "join order" does not depend on two UUIDs created in the same millisecond.

### From `16d-2-gif-icebreaker.md`

Facts that contradict the brief or the assignment:

- GIF configuration lives in `config/services.php` (`'gifs' => ['provider', 'key', 'rating']`, line 106), not in `config/skrum.php`, which has no GIF key. The provider is enabled by `services.gifs.provider` in `giphy|tenor` and a non-empty `services.gifs.key` (`app/Support/Gifs/GifCatalog.php:20-33`).
- The 13th session: no configuration key exists. `GameRoom::MaxOnlinePlayers = 12` (`app/Models/GameRoom.php:54`) is compared with the live roster in `app/Http/Controllers/BroadcastAuthorizationsController.php:155`; `app/Support/Games/ReverbGamePresenceRoster.php` reads the roster from Reverb (`/channels/presence-game.{room}/users`) and returns `null` (fail open) when Reverb cannot be reached. Row `P13d-08` is residual, the same decision as the foundation section.
- Plan 13c step 6 cannot be driven through the interface: `StartRoundControls` is rendered only by `resources/js/components/games/round-end-card.tsx` (lines 69 and 97), never while a round is active. `P13c-06` uses a `fetch()` from the host's page. If the lead prefers not to count a scripted request as a substitution, change the row to `residual` with the reason "no control in the interface; server rule covered by `tests/Feature/Games/SprintGifTest.php:218`", and drop the test. This may also be a product gap against the plan 13c text ("`outcomeOnNextRound` lets "Next round" close a round in its voting window", plan 13c line 7); the games spec §4.2 only describes the endpoint.
- Possible product defect, not asserted by any test: when Slack is the team's only share channel and a post fails with a reconnect error, `ShareOptions::channels()` reports no channel, `RoomInviteButton` returns `null` (`resources/js/components/games/room-invite-button.tsx:15-17`) and `PostLinkSection` returns `null` (`resources/js/components/integrations/share/post-link-section.tsx:41-43`), so the line "Slack: failed — Reconnect Slack in the team settings." is never shown. `P13d-12d` connects Telegram too, as the walkthrough does, so the line stays visible.
- Plan 13d step 12's last bullet is out of date (Teams, Mattermost and the webhook exist); see the coverage note for `P13d-12e`.
- A retro with the Icebreaker phase starts in Icebreaker (`app/Actions/Retros/CreateRetro.php:44`).

Hooks: none. No `data-test` or `data-realtime` attribute is added by Tasks 5 to 7.

Dependencies on other sections:

- `$this->workQueue()` from plan 16b Task 1 (used by `P13c-03`, `P13c-05b`, `P13d-06d`, `P13d-12a`, `P13d-12b`, `P13d-12d`, `P13d-12e`). It must rebind a fresh request before `queue:work --once`, as `p10bWorkQueueOutsideAnyRequest()` does, so that broadcasts made by the job reach every page.
- Coverage rows `P13d-01`, `P13d-02`, `P13d-04` and `P13d-05` need the ids and the file names of the Hangman, Draw and Decoded tests of Tasks 1–4: P13d-01 needs the live strokes, fill and mid-round join tests; P13d-02 the near-miss and correct-guess tests; P13d-04 the accented-word test; P13d-05 the refused-clue test. "A fill looks identical on both" in P13d-01 is a visual judgement and probably has a residual row in Tasks 1–4; if so, P13d-01 needs a matching residual row.
- Tasks 6 and 7 share one file; Task 7 depends on the helpers `p13dNamed()` of Task 6 and on the imports Task 6 leaves in place (`GameKind`, `GameRoundOutcome`, `GamePlayer`, `GamePoint`, `GameRoom`, `Team`, `User`).

UNVERIFIED items and their fallbacks:

- UNVERIFIED: `script()` returns the resolved value of a promise to PHP (used for the snapshot body in `P13c-02` and the status in `P13c-06`). The plugin's `script()` returns `page->evaluate()` and the harness findings say it awaits a promise, but no existing test reads the returned value. Fallback: store the result on `window` inside the script (`window.__p13c = body`) and read it with `assertScript('window.__p13c.includes("partyone")', false)`.
- UNVERIFIED: the GIF proxy works against the fake (`Http::fake` with `withOptions(['stream' => true])`, a one-pixel GIF body, `Storage::fake()` on the default disk). The tests assert the `img` elements and their `src`, not that the image decoded, so a failing proxy does not fail a test; it only leaves broken images in screenshots. Fallback: none needed.
- UNVERIFIED: binding `GameWordBook` with `app()->instance()` in the test reaches the request that starts the round (`P13c-01`, `P13c-06`). `tests/Feature/Games/SprintGifSupportTest.php` does the same for feature requests. Fallback: read the question from the database and assert on that text, without assuming which question comes second.
- UNVERIFIED: `DB::table('jobs')->count()` is exactly 1 after a timer is set (`P13c-03`, `P13c-05b`, `P13d-06d`). Game and retro events are `ShouldBroadcastNow`, so no broadcast job is queued; `P10b-08a` relies on the same fact for poker. Fallback: drop the count assertions and keep the outcome assertions.
- UNVERIFIED: `P13c-06`'s XSRF cookie read (`XSRF-TOKEN` is not HttpOnly in Laravel) and the `201` status. Fallback: see the first bullet of "Facts that contradict".
- UNVERIFIED: hovering `[role="group"][aria-label="Letters"]` then `main.relative` produces a cursor on the other page in the Icebreaker stage (`P13d-06b`); it is the plan 10b idiom applied to `IcebreakerStage`, whose `main.relative` is the cursor layer's container. Fallback: hover `section[aria-label="Icebreaker game"]` then `main.relative`.
- UNVERIFIED: the Results view of a completed retro accepts a guest who joins after completion and lets that guest open "Replay" (`P13d-11a`). `RetroJoinsController::store` does not check the phase, and `GET /games/{room}/rounds/{round}` creates the player on the first request. Fallback: split the guest half into its own test and, if joining a completed retro is refused, mark "A guest of the retro sees the same section" `residual`.
- UNVERIFIED: a job that calls `$this->fail()` leaves `queue:work --once` with a successful exit code, so `$this->workQueue()` does not fail in `P13d-12d`. Fallback: in that test only, leave the queue on `sync` (remove the `config()` line and the `workQueue()` call, and drop the "Sending to Slack…" assertion).
- UNVERIFIED: the Microsoft Teams body contains the room id (`P13d-12e` asserts `str_contains($request->body(), $room->id)`); the adaptive-card shape was not read. Fallback: assert only the host of the request.
