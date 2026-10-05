<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Facades\DB;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{room: GameRoom, ada: User, adaPlayer: GamePlayer}
 */
function gamesRoomRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Lunch', 'game' => GameKind::Hangman, ...$attributes]);
    [$ada, $adaPlayer] = gameRoomHost($room);

    $room->forceFill(['created_by_user_id' => $ada->id])->save();
    $ada->forceFill(['name' => 'Ada Host', 'locale' => 'en'])->save();

    return ['room' => $room->fresh(), 'ada' => $ada, 'adaPlayer' => $adaPlayer];
}

function gamesRoomOnlyWord(string $word): void
{
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => $word, 'drawable' => true, 'theme' => 'work']]]));
}

function gamesRoomSetting(string $label): string
{
    return "[data-slot=\"game-settings-card\"] div:has(> label:text-is(\"{$label}\")) > :last-child";
}

function gamesRoomChoose(mixed $page, string $label, string $option): mixed
{
    return $page->click(gamesRoomSetting($label))
        ->click("[role=\"option\"]:has-text(\"{$option}\")")
        ->assertSeeIn(gamesRoomSetting($label), $option);
}

const GamesRoomWordGuess = '[data-slot="hangman-word-guess"] input';

it('lets a room manager change the game settings, reaches the other manager live, and shows no card to a guest', function () {
    ['room' => $room, 'ada' => $ada] = gamesRoomRoom();
    $workspaceAdmin = workspaceManager($room->team->workspace);
    $workspaceAdmin->forceFill(['name' => 'Wanda Admin', 'locale' => 'en'])->save();

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $admin = $this->awaitRealtime($this->signIn($workspaceAdmin, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertSeeIn('[data-slot="game-settings-card"] h3', 'Game settings')
        ->assertSeeIn(gamesRoomSetting('Word theme'), 'All words')
        ->assertSeeIn(gamesRoomSetting('Time per turn'), 'Off')
        ->assertSeeIn(gamesRoomSetting('Rounds'), 'Endless')
        ->assertAriaAttribute(gamesRoomSetting('Take turns'), 'checked', 'false')
        ->assertAriaAttribute(gamesRoomSetting('Guests allowed'), 'checked', 'true')
        ->assertDontSee('Changes apply from the next round.');

    $guest->assertNotPresent('[data-slot="game-settings-card"]');

    gamesRoomChoose($host, 'Word theme', 'Food');
    gamesRoomChoose($host, 'Time per turn', '30 s');
    gamesRoomChoose($host, 'Rounds', '3');
    $host->click(gamesRoomSetting('Take turns'))
        ->assertAriaAttribute(gamesRoomSetting('Take turns'), 'checked', 'true');

    $admin->assertSeeIn(gamesRoomSetting('Word theme'), 'Food')
        ->assertSeeIn(gamesRoomSetting('Time per turn'), '30 s')
        ->assertSeeIn(gamesRoomSetting('Rounds'), '3')
        ->assertAriaAttribute(gamesRoomSetting('Take turns'), 'checked', 'true');

    expect($room->fresh())
        ->word_themes->toBe(['food'])
        ->turn_seconds->toBe(30)
        ->rounds_per_game->toBe(3)
        ->takes_turns->toBeTrue();

    $guest->assertNotPresent('[data-slot="game-settings-card"]');

    $host->click('Start');

    foreach ([$host, $admin, $guest] as $page) {
        $page->assertSeeIn('[data-slot="round-info"]', 'Round 1 of 3 · Theme: Food');
    }

    $host->assertSee('Changes apply from the next round.');
});

it('numbers the rounds of a game, says "Game over" after the last one, and starts the next game at round 1', function () {
    ['room' => $room, 'ada' => $ada] = gamesRoomRoom(['rounds_per_game' => 2]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->click('Start');

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('[data-slot="round-info"]', 'Round 1 of 2');
    }

    $host->click('Give up');

    foreach ([$host, $guest] as $page) {
        $page->assertPresent('[data-slot="round-end-card"]')
            ->assertDontSeeIn('[data-slot="round-end-card"]', 'Game over');
    }

    $host->click('Next round');

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('[data-slot="round-info"]', 'Round 2 of 2');
    }

    $host->click('Give up');

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('[data-slot="round-end-card"] h3', 'Game over');
    }

    $host->assertSeeIn('[data-slot="round-end-card"] button', 'New game')
        ->click('New game');

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('[data-slot="round-info"]', 'Round 1 of 2');
    }

    expect(GameRound::query()->oldest('started_at')->orderBy('id')->pluck('number')->all())->toBe([1, 2, 1]);
});

it('plays hangman in turns: only the player of the turn picks a letter, and every letter passes the turn live', function () {
    gamesRoomOnlyWord('quartz');
    ['room' => $room, 'ada' => $ada] = gamesRoomRoom(['takes_turns' => true]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('Start');

    $host->assertSeeIn('[data-slot="hangman-turn-banner"]', 'Your turn, Ada Host — pick a letter')
        ->assertAttribute('[data-slot="hangman-turn-banner"]', 'data-mine', 'true');
    $guest->assertSeeIn('[data-slot="hangman-turn-banner"]', "Ada Host's turn")
        ->assertSeeIn('[role="group"][aria-label="Letters"]', "Ada Host's turn")
        ->assertAriaAttribute(letterKey('q'), 'disabled', 'true')
        ->assertAriaAttribute(GamesRoomWordGuess, 'disabled', 'true')
        ->assertSeeIn('[data-slot="turn-order"] h3', 'Speaking order')
        ->assertSeeIn('[data-slot="turn-order"]', 'Next: Visitor');

    $host->click(letterKey('q'))
        ->assertAttribute(letterKey('q'), 'data-state', 'hit')
        ->assertSeeIn('[data-slot="hangman-turn-banner"]', "Visitor's turn")
        ->assertAriaAttribute(letterKey('u'), 'disabled', 'true');

    $guest->assertSeeIn('[data-slot="hangman-turn-banner"]', 'Your turn, Visitor — pick a letter')
        ->assertAttribute(letterKey('q'), 'data-state', 'hit')
        ->click(letterKey('x'))
        ->assertAttribute(letterKey('x'), 'data-state', 'miss')
        ->assertSeeIn('[data-slot="hangman-turn-banner"]', "Ada Host's turn");

    $host->assertSeeIn('[data-slot="hangman-turn-banner"]', 'Your turn, Ada Host — pick a letter')
        ->assertAttribute(letterKey('x'), 'data-state', 'miss');

    $round = GameRound::query()->sole();

    expect($round->turn_player_id)->toBe($room->host_player_id);
});

it('elides the French turn banner before a name that starts with a vowel', function () {
    gamesRoomOnlyWord('quartz');
    ['room' => $room, 'ada' => $ada] = gamesRoomRoom(['takes_turns' => true]);
    $ada->forceFill(['name' => 'Marc', 'locale' => 'fr'])->save();

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Inès'));

    $host->assertPresent('[role="group"][aria-label="2 en ligne"]')
        ->click('Commencer');

    $frenchLetter = fn (string $letter): string => "[role=\"group\"][aria-label=\"Lettres\"] button:has-text(\"{$letter}\")";

    $host->click($frenchLetter('q'))
        ->assertSeeIn('[data-slot="hangman-turn-banner"]', "Tour d'Inès");

    $guest->click(letterKey('x'));

    $host->assertSeeIn('[data-slot="hangman-turn-banner"]', 'À toi de jouer, Marc');
    $host->click($frenchLetter('u'))
        ->assertSeeIn('[data-slot="hangman-turn-banner"]', "Tour d'Inès");
});

it('costs a life for a wrong whole word shown in "Last moves", and solves the round for a right one', function () {
    gamesRoomOnlyWord('quartz');
    ['room' => $room, 'ada' => $ada] = gamesRoomRoom();

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('Start');

    $guest->assertAttribute(GamesRoomWordGuess, 'aria-label', 'Guess the whole word (+5 pts, −1 life if wrong)')
        ->fill(GamesRoomWordGuess, 'laptop')
        ->click('[data-slot="hangman-word-guess"] button[type="submit"]')
        ->assertSeeIn('[data-slot="hangman-word-guess"] [role="status"]', 'Missed: −1 life')
        ->assertValue(GamesRoomWordGuess, '');

    $host->assertSeeIn('ul[aria-label="Last moves"]', 'Visitor tries LAPTOP — missed')
        ->assertSee('1 of 6 misses');

    $host->fill(GamesRoomWordGuess, 'Quartz')
        ->click('[data-slot="hangman-word-guess"] button[type="submit"]');

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('[data-slot="round-end-card"]', 'quartz')
            ->assertSeeIn('[data-slot="round-end-card"]', 'Ada Host found it!')
            ->assertSeeIn('[data-slot="round-end-card"] [aria-label="Points of this round"]', '+5 Ada Host');
    }

    $round = GameRound::query()->sole();

    expect($round->outcome)->toBe(GameRoundOutcome::Solved)
        ->and($round->winner_player_id)->toBe($room->host_player_id)
        ->and($round->misses)->toBe(1);
});

it('counts the turn down on the stage and passes an expired turn to the next player for both', function () {
    config(['queue.default' => 'database']);
    gamesRoomOnlyWord('quartz');
    ['room' => $room, 'ada' => $ada] = gamesRoomRoom(['takes_turns' => true, 'turn_seconds' => 30]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('Start');

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('[data-slot="turn-timer"]', "Ada Host's turn")
            ->assertSeeIn('[data-slot="turn-timer"]', '0:')
            ->assertSeeIn('[data-slot="turn-order"]', 'Next: Visitor · 30 s per turn');
    }

    expect(DB::table('jobs')->count())->toBe(1);

    $this->travel(31)->seconds();
    $this->workQueue();

    $guest->assertSeeIn('[data-slot="hangman-turn-banner"]', 'Your turn, Visitor — pick a letter')
        ->assertSeeIn('[data-slot="turn-timer"]', "Visitor's turn");
    $host->assertSeeIn('[data-slot="hangman-turn-banner"]', "Visitor's turn")
        ->assertSee('0 of 6 misses');

    expect(GameRound::query()->sole())
        ->misses->toBe(0)
        ->ended_at->toBeNull();
});

it('shows the eight game cards with their duration and players, and the reason a card is not available', function () {
    ['room' => $room, 'ada' => $ada] = gamesRoomRoom();

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $cards = '[role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]';

    $host->assertCount($cards, 8);

    foreach ([
        'Hangman' => ['5–10 min', '1-30'],
        'Draw & Guess' => ['10 min', '2-12'],
        'Decoded' => ['5 min', '2-30'],
        'Sprint in one GIF' => ['5 min', '1-30'],
        'Two truths and a lie' => ['10 min', '3-15'],
        'Mood weather' => ['3 min · anonymous', '1-30'],
        'Guess who?' => ['8 min', '3-15'],
        'Quick question' => ['2 min / person', '1-12'],
    ] as $game => [$duration, $players]) {
        $host->assertSeeIn("{$cards}:has-text(\"{$game}\")", $duration)
            ->assertSeeIn("{$cards}:has-text(\"{$game}\")", $players);
    }

    $host->assertSeeIn("{$cards}:has-text(\"Sprint in one GIF\")", 'Not available')
        ->click("{$cards}:has-text(\"Mood weather\")")
        ->assertSeeIn('#game-stage-title', 'Mood weather')
        ->assertSeeIn('[data-slot="game-settings-card"]', 'Answers are anonymous.');

    expect($room->fresh()->game)->toBe(GameKind::MoodWeather);
});

it('keeps the turn banner and the whole-word field above the docked keyboard at 390 pixels', function () {
    ['room' => $room, 'ada' => $ada] = gamesRoomRoom(['takes_turns' => true]);
    $guestPlayer = gameRoomGuest($room);
    activeGameRound($room, [
        'word' => 'quartz',
        'number' => 1,
        'turn_order' => [$guestPlayer->id, $room->host_player_id],
        'turn_player_id' => $guestPlayer->id,
    ]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $host->resize(390, 844)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->assertVisible('[data-slot="hangman-turn-banner"]')
        ->assertVisible(GamesRoomWordGuess)
        ->assertAriaAttribute(GamesRoomWordGuess, 'disabled', 'true')
        ->assertPresent('[data-slot="game-footer"] [role="group"][aria-label="Letters"]')
        ->assertScript("document.querySelector('[data-slot=\"hangman-word-guess\"]').getBoundingClientRect().bottom <= document.querySelector('[role=\"group\"][aria-label=\"Letters\"]').getBoundingClientRect().top", true)
        ->assertScript("[...document.querySelectorAll('[role=\"group\"][aria-label=\"Letters\"] button')].every((key) => key.getAttribute('aria-disabled') === 'true')", true)
        ->assertSeeIn('[data-slot="round-info"]', 'Round 1 · endless');
});

it('draws the settings card and the turn banner in the dark theme', function () {
    ['room' => $room, 'ada' => $ada] = gamesRoomRoom(['takes_turns' => true]);
    activeGameRound($room, [
        'word' => 'quartz',
        'number' => 1,
        'turn_order' => [$room->host_player_id],
        'turn_player_id' => $room->host_player_id,
    ]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}", ['colorScheme' => 'dark']));

    $host->assertScript("document.documentElement.classList.contains('dark')", true)
        ->assertVisible('[data-slot="game-settings-card"]')
        ->assertVisible('[data-slot="hangman-turn-banner"]')
        ->assertScript('getComputedStyle(document.body).backgroundColor', 'oklch(0.165 0.008 55)')
        ->assertScript("getComputedStyle(document.querySelector('[data-slot=\"game-settings-card\"]')).backgroundColor", 'oklch(0.205 0.009 55)');
});

it('speaks French to a French host and English to an English one on the same room', function () {
    ['room' => $room, 'ada' => $ada] = gamesRoomRoom(['rounds_per_game' => 3]);
    [$bob] = gameRoomMember($room);
    $bob->forceFill(['name' => 'Bob', 'locale' => 'en'])->save();
    $ada->forceFill(['locale' => 'fr'])->save();
    activeGameRound($room, ['word' => 'quartz', 'number' => 2, 'rounds_total' => 3]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $host->assertSeeIn('[data-slot="round-info"]', 'Manche 2 sur 3')
        ->assertSeeIn('[data-slot="game-settings-card"] h3', 'Paramètres de la partie')
        ->assertAttribute(GamesRoomWordGuess, 'aria-label', 'Tenter le mot entier (+5 pts, −1 vie si raté)');

    $member->assertSeeIn('[data-slot="round-info"]', 'Round 2 of 3')
        ->assertAttribute(GamesRoomWordGuess, 'aria-label', 'Guess the whole word (+5 pts, −1 life if wrong)')
        ->assertNotPresent('[data-slot="game-settings-card"]');
});
