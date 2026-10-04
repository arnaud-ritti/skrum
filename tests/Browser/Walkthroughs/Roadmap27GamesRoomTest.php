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
function rm27Room(array $attributes = []): array
{
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Lunch', 'game' => GameKind::Hangman, ...$attributes]);
    [$ada, $adaPlayer] = gameRoomHost($room);

    $room->forceFill(['created_by_user_id' => $ada->id])->save();
    $ada->forceFill(['name' => 'Ada Host', 'locale' => 'en'])->save();

    return ['room' => $room->fresh(), 'ada' => $ada, 'adaPlayer' => $adaPlayer];
}

function rm27OnlyWord(string $word): void
{
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => $word, 'drawable' => true, 'theme' => 'work']]]));
}

function rm27Key(string $letter): string
{
    return "[role=\"group\"][aria-label=\"Letters\"] button:has-text(\"{$letter}\")";
}

function rm27Setting(string $label): string
{
    return "[data-slot=\"game-settings-card\"] div:has(> label:text-is(\"{$label}\")) > :last-child";
}

function rm27Choose(mixed $page, string $label, string $option): mixed
{
    return $page->click(rm27Setting($label))
        ->click("[role=\"option\"]:has-text(\"{$option}\")")
        ->assertSeeIn(rm27Setting($label), $option);
}

const Rm27WordGuess = '[data-slot="hangman-word-guess"] input';

it('[R27-01] lets a room manager change the game settings, reaches the other manager live, and shows no card to a guest', function () {
    ['room' => $room, 'ada' => $ada] = rm27Room();
    $workspaceAdmin = workspaceManager($room->team->workspace);
    $workspaceAdmin->forceFill(['name' => 'Wanda Admin', 'locale' => 'en'])->save();

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $admin = $this->awaitRealtime($this->signIn($workspaceAdmin, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertSeeIn('[data-slot="game-settings-card"] h3', 'Game settings')
        ->assertSeeIn(rm27Setting('Word theme'), 'All words')
        ->assertSeeIn(rm27Setting('Time per turn'), 'Off')
        ->assertSeeIn(rm27Setting('Rounds'), 'Endless')
        ->assertAriaAttribute(rm27Setting('Take turns'), 'checked', 'false')
        ->assertAriaAttribute(rm27Setting('Guests allowed'), 'checked', 'true')
        ->assertDontSee('Changes apply from the next round.');

    $guest->assertNotPresent('[data-slot="game-settings-card"]');

    rm27Choose($host, 'Word theme', 'Food');
    rm27Choose($host, 'Time per turn', '30 s');
    rm27Choose($host, 'Rounds', '3');
    $host->click(rm27Setting('Take turns'))
        ->assertAriaAttribute(rm27Setting('Take turns'), 'checked', 'true');

    $admin->assertSeeIn(rm27Setting('Word theme'), 'Food')
        ->assertSeeIn(rm27Setting('Time per turn'), '30 s')
        ->assertSeeIn(rm27Setting('Rounds'), '3')
        ->assertAriaAttribute(rm27Setting('Take turns'), 'checked', 'true');

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

it('[R27-02] numbers the rounds of a game, says "Game over" after the last one, and starts the next game at round 1', function () {
    ['room' => $room, 'ada' => $ada] = rm27Room(['rounds_per_game' => 2]);

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

it('[R27-03] plays hangman in turns: only the player of the turn picks a letter, and every letter passes the turn live', function () {
    rm27OnlyWord('quartz');
    ['room' => $room, 'ada' => $ada] = rm27Room(['takes_turns' => true]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('Start');

    $host->assertSeeIn('[data-slot="hangman-turn-banner"]', 'Your turn, Ada Host — pick a letter')
        ->assertAttribute('[data-slot="hangman-turn-banner"]', 'data-mine', 'true');
    $guest->assertSeeIn('[data-slot="hangman-turn-banner"]', "Ada Host's turn")
        ->assertSeeIn('[role="group"][aria-label="Letters"]', "Ada Host's turn")
        ->assertAriaAttribute(rm27Key('q'), 'disabled', 'true')
        ->assertAriaAttribute(Rm27WordGuess, 'disabled', 'true')
        ->assertSeeIn('[data-slot="turn-order"] h3', 'Speaking order')
        ->assertSeeIn('[data-slot="turn-order"]', 'Next: Visitor');

    $host->click(rm27Key('q'))
        ->assertAttribute(rm27Key('q'), 'data-state', 'hit')
        ->assertSeeIn('[data-slot="hangman-turn-banner"]', "Visitor's turn")
        ->assertAriaAttribute(rm27Key('u'), 'disabled', 'true');

    $guest->assertSeeIn('[data-slot="hangman-turn-banner"]', 'Your turn, Visitor — pick a letter')
        ->assertAttribute(rm27Key('q'), 'data-state', 'hit')
        ->click(rm27Key('x'))
        ->assertAttribute(rm27Key('x'), 'data-state', 'miss')
        ->assertSeeIn('[data-slot="hangman-turn-banner"]', "Ada Host's turn");

    $host->assertSeeIn('[data-slot="hangman-turn-banner"]', 'Your turn, Ada Host — pick a letter')
        ->assertAttribute(rm27Key('x'), 'data-state', 'miss');

    $round = GameRound::query()->sole();

    expect($round->turn_player_id)->toBe($room->host_player_id);
});

it('[R27-04] costs a life for a wrong whole word shown in "Last moves", and solves the round for a right one', function () {
    rm27OnlyWord('quartz');
    ['room' => $room, 'ada' => $ada] = rm27Room();

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('Start');

    $guest->assertAttribute(Rm27WordGuess, 'aria-label', 'Guess the whole word (+5 pts, −1 life if wrong)')
        ->fill(Rm27WordGuess, 'laptop')
        ->click('[data-slot="hangman-word-guess"] button[type="submit"]')
        ->assertSeeIn('[data-slot="hangman-word-guess"] [role="status"]', 'Missed: −1 life')
        ->assertValue(Rm27WordGuess, '');

    $host->assertSeeIn('ul[aria-label="Last moves"]', 'Visitor tries LAPTOP — missed')
        ->assertSee('1 of 6 misses');

    $host->fill(Rm27WordGuess, 'Quartz')
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

it('[R27-05] counts the turn down on the stage and passes an expired turn to the next player for both', function () {
    config(['queue.default' => 'database']);
    rm27OnlyWord('quartz');
    ['room' => $room, 'ada' => $ada] = rm27Room(['takes_turns' => true, 'turn_seconds' => 30]);

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

it('[R27-06] shows the eight game cards with their duration and players, and the reason a card is not available', function () {
    ['room' => $room, 'ada' => $ada] = rm27Room();

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

it('[R27-07] keeps the turn banner and the whole-word field above the docked keyboard at 390 pixels', function () {
    ['room' => $room, 'ada' => $ada] = rm27Room(['takes_turns' => true]);
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
        ->assertVisible(Rm27WordGuess)
        ->assertAriaAttribute(Rm27WordGuess, 'disabled', 'true')
        ->assertPresent('[data-slot="game-footer"] [role="group"][aria-label="Letters"]')
        ->assertScript("document.querySelector('[data-slot=\"hangman-word-guess\"]').getBoundingClientRect().bottom <= document.querySelector('[role=\"group\"][aria-label=\"Letters\"]').getBoundingClientRect().top", true)
        ->assertScript("[...document.querySelectorAll('[role=\"group\"][aria-label=\"Letters\"] button')].every((key) => key.getAttribute('aria-disabled') === 'true')", true)
        ->assertSeeIn('[data-slot="round-info"]', 'Round 1 · endless');
});

it('[R27-08] draws the settings card and the turn banner in the dark theme', function () {
    ['room' => $room, 'ada' => $ada] = rm27Room(['takes_turns' => true]);
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
        ->assertScript("getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)'", true)
        ->assertScript("getComputedStyle(document.querySelector('[data-slot=\"game-settings-card\"]')).color !== getComputedStyle(document.querySelector('[data-slot=\"game-settings-card\"]')).backgroundColor", true)
        ->assertScript("(() => { const [r, g, b] = getComputedStyle(document.querySelector('[data-slot=\"game-settings-card\"]')).backgroundColor.match(/\\d+/g).map(Number); return r + g + b < 3 * 128; })()", true);
});

it('[R27-09] speaks French to a French host and English to an English one on the same room', function () {
    ['room' => $room, 'ada' => $ada] = rm27Room(['rounds_per_game' => 3]);
    [$bob] = gameRoomMember($room);
    $bob->forceFill(['name' => 'Bob', 'locale' => 'en'])->save();
    $ada->forceFill(['locale' => 'fr'])->save();
    activeGameRound($room, ['word' => 'quartz', 'number' => 2, 'rounds_total' => 3]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $host->assertSeeIn('[data-slot="round-info"]', 'Manche 2 sur 3')
        ->assertSeeIn('[data-slot="game-settings-card"] h3', 'Paramètres de la partie')
        ->assertAttribute(Rm27WordGuess, 'aria-label', 'Tenter le mot entier (+5 pts, −1 vie si raté)');

    $member->assertSeeIn('[data-slot="round-info"]', 'Round 2 of 3')
        ->assertAttribute(Rm27WordGuess, 'aria-label', 'Guess the whole word (+5 pts, −1 life if wrong)')
        ->assertNotPresent('[data-slot="game-settings-card"]');
});
