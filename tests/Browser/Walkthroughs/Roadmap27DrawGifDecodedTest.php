<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use App\Support\Games\GameWordBook;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{room: GameRoom, ada: User, adaPlayer: GamePlayer, bob: User, bobPlayer: GamePlayer}
 */
function rm27dRoom(GameKind $game, array $attributes = []): array
{
    $room = GameRoom::factory()->game($game)->linkAccess()->create(['name' => 'Lunch', ...$attributes]);
    [$ada, $adaPlayer] = gameRoomHost($room);
    [$bob, $bobPlayer] = gameRoomMember($room);

    $room->forceFill(['created_by_user_id' => $ada->id])->save();
    $ada->forceFill(['name' => 'Ada Host', 'locale' => 'en'])->save();
    $bob->forceFill(['name' => 'Bob', 'locale' => 'en'])->save();

    return ['room' => $room->fresh(), 'ada' => $ada, 'adaPlayer' => $adaPlayer, 'bob' => $bob, 'bobPlayer' => $bobPlayer];
}

/**
 * @param  array<int, string>  $words
 */
function rm27dWords(array $words): void
{
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => array_map(
        fn (string $word): array => ['word' => $word, 'drawable' => true, 'theme' => 'objects'],
        $words,
    )]));
}

function rm27dFakeGifs(): void
{
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'browser-gif-key', 'rating' => 'pg']]);

    Storage::fake();

    Http::fake([
        'api.giphy.com/*' => function (HttpRequest $request) {
            $endpoint = basename((string) parse_url($request->url(), PHP_URL_PATH));

            if (in_array($endpoint, ['trending', 'search'], true)) {
                return Http::response(['data' => [gameGiphyItem('partyone'), gameGiphyItem('partytwo')]]);
            }

            return Http::response(['data' => gameGiphyItem($endpoint)]);
        },
        'media.giphy.com/*' => fn () => Http::response(
            base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
            200,
            ['Content-Type' => 'image/gif'],
        ),
    ]);
}

function rm27dTile(string $gifId): string
{
    return "[data-slot=\"gif-tile\"]:has(img[src=\"/gifs/{$gifId}/preview\"])";
}

function rm27dStroke(mixed $page, float $row): void
{
    $page->script(<<<JS
        () => {
            const canvas = document.querySelector('canvas[aria-label="Your drawing"]');
            const box = canvas.getBoundingClientRect();
            canvas.setPointerCapture = () => {};
            const event = (type, x, buttons) => new PointerEvent(type, {
                bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons,
                clientX: box.left + box.width * x, clientY: box.top + box.height * {$row},
            });
            canvas.dispatchEvent(event("pointerdown", 0.2, 1));
            canvas.dispatchEvent(event("pointermove", 0.5, 1));
            canvas.dispatchEvent(event("pointermove", 0.8, 1));
            canvas.dispatchEvent(event("pointerup", 0.8, 0));
            return true;
        }
        JS);
}

const Rm27dGuess = 'input[aria-label="Your guess"]';

it('[R27-17] lets every guesser find the drawing, shows each finder with time and points, and ends the round when all have found it', function () {
    rm27dWords(['rocket']);
    ['room' => $room, 'ada' => $ada, 'bob' => $bob] = rm27dRoom(GameKind::DrawAndGuess);

    $drawer = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $drawer->assertPresent('[role="group"][aria-label="3 online"]')
        ->assertSeeIn('button[aria-label="Who draws?"]', 'Ada Host')
        ->click('[data-slot="round-start-card"] button:has-text("Start")')
        ->assertSee('Your word to draw')
        ->assertSee('rocket');

    $bobPage->fill(Rm27dGuess, 'Rocket')
        ->click('form:has(input[aria-label="Your guess"]) button[type="submit"]')
        ->assertSee('You found it: ROCKET')
        ->assertNotPresent(Rm27dGuess);

    foreach ([$drawer, $guest] as $page) {
        $page->assertSeeIn('[data-slot="draw-found-by"]', 'Found by · 1 / 2')
            ->assertSeeIn('[data-slot="draw-found-by"]', 'Bob')
            ->assertSeeIn('[data-slot="draw-found-by"]', '+10')
            ->assertSee('Bob found it!')
            ->assertSeeIn('[data-slot="player-row"]:has-text("Bob")', 'found · 0:');
    }

    $drawer->assertSeeIn('[data-slot="draw-found-by"]', 'You earn +5 per finder')
        ->assertDisabled('button:has-text("New word (1)")');
    $guest->assertDontSee('rocket')
        ->assertSeeIn('[data-slot="player-row"]:has-text("Visitor")', 'guessing…')
        ->assertSeeIn('[data-slot="player-row"]:has-text("Ada Host")', 'drawing');

    expect(gamePayloadExposesWord($this->snapshotOf($guest, "/games/{$room->id}/snapshot"), 'rocket'))->toBeFalse();

    $guest->fill(Rm27dGuess, 'rocket')
        ->click('form:has(input[aria-label="Your guess"]) button[type="submit"]');

    foreach ([$drawer, $bobPage, $guest] as $page) {
        $page->assertSeeIn('[data-slot="round-end-card"]', 'rocket')
            ->assertSeeIn('[data-slot="round-end-card"] [aria-label="Points of this round"]', '+10 Bob')
            ->assertSeeIn('[data-slot="round-end-card"] [aria-label="Points of this round"]', '+10 Visitor')
            ->assertSeeIn('[data-slot="round-end-card"] [aria-label="Points of this round"]', '+10 Ada Host');
    }

    $round = GameRound::query()->sole();

    expect($round->outcome)->toBe(GameRoundOutcome::Guessed)
        ->and(GamePoint::query()->where('game_round_id', $round->id)->sum('points'))->toEqual(30);
});

it('[R27-18] gives the drawer one new word, live to the guessers as a new mask, and redoes an undone stroke', function () {
    rm27dWords(['rocket', 'umbrella']);
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'adaPlayer' => $adaPlayer] = rm27dRoom(GameKind::DrawAndGuess);
    $round = activeGameRound($room, ['word' => 'rocket', 'leader_player_id' => $adaPlayer->id, 'number' => 1, 'guessers_total' => 1]);

    $drawer = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $guesser->assertPresent('[role="img"][aria-label="6 letters left to find"]');

    rm27dStroke($drawer, 0.3);
    rm27dStroke($drawer, 0.6);

    $drawer->assertDisabled('[aria-label="Redo"]')
        ->click('[aria-label="Undo"]')
        ->assertEnabled('[aria-label="Redo"]')
        ->click('[aria-label="Redo"]')
        ->assertDisabled('[aria-label="Redo"]');

    retry(20, fn () => expect($round->fresh()->drawing)->toHaveCount(2), 250);

    $drawer->click('button:has-text("New word (1)")')
        ->assertSee('umbrella')
        ->assertDisabled('button:has-text("New word (0)")');

    $guesser->assertPresent('[role="img"][aria-label="8 letters left to find"]')
        ->assertDontSee('umbrella');

    expect($round->fresh())
        ->word->toBe('umbrella')
        ->word_changes->toBe(1)
        ->drawing->toBe([]);
});

it('[R27-19] counts down to the next automatic letter and reveals it on time', function () {
    config(['queue.default' => 'database']);
    rm27dWords(['rocket']);
    ['room' => $room, 'ada' => $ada, 'bob' => $bob] = rm27dRoom(GameKind::DrawAndGuess, ['auto_hints' => true]);

    $drawer = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $drawer->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('[data-slot="round-start-card"] button:has-text("Start")');

    $guesser->assertSeeIn('[data-slot="auto-hint-countdown"]', 'next letter in 0:')
        ->assertPresent('[role="img"][aria-label="6 letters left to find"]');

    $this->travel(21)->seconds();
    $this->workQueue();

    $guesser->assertPresent('[role="img"][aria-label="5 letters left to find"]');

    expect(GameRound::query()->sole()->revealed_positions)->toHaveCount(1);
});

it('[R27-20] sends a GIF with its caption, hidden from the others until the reveal, then shown under the GIF', function () {
    rm27dFakeGifs();
    ['room' => $room, 'ada' => $ada, 'bob' => $bob] = rm27dRoom(GameKind::SprintGif, ['gif_votes' => 2, 'gif_authors_hidden' => true]);
    activeGifRound($room, ['number' => 1, 'votes_allowed' => 2, 'authors_hidden' => true]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $member->fill('[data-slot="gif-answer-stage"] [data-slot="gif-picker"] [aria-label="Search GIPHY"]', 'party')
        ->click('[data-slot="gif-picker"] [role="option"]:has(img[src="/gifs/partyone/preview"])')
        ->assertSeeIn('[data-slot="gif-your-pick"]', 'Draft')
        ->fill('[data-slot="gif-caption-field"] input', 'CI on Friday at 6 pm')
        ->assertSeeIn('[data-slot="gif-caption-count"]', '20 / 60')
        ->click('Send my GIF')
        ->assertSeeIn('[data-slot="gif-your-pick"]', 'Sent');

    $host->assertSeeIn('[data-slot="player-row"]:has-text("Bob")', 'GIF picked')
        ->assertDontSee('CI on Friday at 6 pm');

    expect(GameGifAnswer::query()->sole()->caption)->toBe('CI on Friday at 6 pm');

    $host->click('Reveal the GIFs');

    foreach ([$host, $member] as $page) {
        $page->assertSeeIn(rm27dTile('partyone'), 'CI on Friday at 6 pm');
    }

    $host->assertSeeIn(rm27dTile('partyone'), 'Hidden until the votes close')
        ->assertDontSeeIn(rm27dTile('partyone'), 'Bob');
});

it('[R27-21] spends a budget of two votes, never on one\'s own GIF, keeps the authors hidden, then crowns the winner and ranks the rest', function () {
    rm27dFakeGifs();
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = rm27dRoom(GameKind::SprintGif);
    [$cleo, $cleoPlayer] = gameRoomMember($room);
    $cleo->forceFill(['name' => 'Cleo', 'locale' => 'en'])->save();
    $round = activeGifRound($room, ['number' => 1, 'votes_allowed' => 2, 'authors_hidden' => true, 'revealed_at' => now()->startOfSecond()]);

    foreach ([[$adaPlayer, 'partyone', 'Deploy day'], [$bobPlayer, 'coffeeone', 'CI on Friday at 6 pm'], [$cleoPlayer, 'tadaone', 'Green build']] as [$player, $gifId, $caption]) {
        GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $player->id, 'gif_id' => $gifId, 'caption' => $caption]);
    }

    $bobAnswer = GameGifAnswer::query()->where('player_id', $bobPlayer->id)->sole();
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $cleoPlayer->id, 'answer_id' => $bobAnswer->id]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $host->assertSeeIn('[data-slot="gif-vote-budget"]', 'Your votes')
        ->assertSeeIn('[data-slot="gif-vote-budget"]', '0 / 2 used')
        ->assertNotPresent(rm27dTile('partyone').' [data-slot="gif-vote-button"]')
        ->assertSeeIn(rm27dTile('partyone'), 'Your GIF')
        ->assertSeeIn(rm27dTile('coffeeone'), 'Hidden until the votes close')
        ->assertDontSeeIn(rm27dTile('coffeeone'), 'Bob')
        ->click(rm27dTile('coffeeone').' [data-slot="gif-vote-button"]')
        ->assertAriaAttribute(rm27dTile('coffeeone').' [data-slot="gif-vote-button"]', 'pressed', 'true')
        ->click(rm27dTile('tadaone').' [data-slot="gif-vote-button"]')
        ->assertSeeIn('[data-slot="gif-vote-budget"]', '2 / 2 used');

    $member->assertSeeIn(rm27dTile('partyone'), 'Hidden until the votes close')
        ->assertSeeIn('[data-slot="gif-vote-budget"]', '0 / 2 used')
        ->click(rm27dTile('partyone').' [data-slot="gif-vote-button"]')
        ->assertSeeIn('[data-slot="gif-vote-budget"]', '1 / 2 used');

    expect(GameGifVote::query()->where('voter_player_id', $adaPlayer->id)->count())->toBe(2);

    $host->click('Finish round');

    foreach ([$host, $member] as $page) {
        $page->assertSeeIn('[data-slot="gif-podium-winner"]', 'Winner')
            ->assertSeeIn('[data-slot="gif-podium-winner"]', 'Bob wins the round')
            ->assertSeeIn('[data-slot="gif-podium-winner"]', '“CI on Friday at 6 pm” · 2 votes out of 4')
            ->assertSeeIn('[data-slot="gif-ranking"]', 'Ada Host')
            ->assertSeeIn('[data-slot="gif-ranking"]', 'Cleo');
    }

    expect(GamePoint::query()->where('player_id', $bobPlayer->id)->sole())
        ->points->toBe(4)
        ->is_win->toBeTrue();
});

it('[R27-22] lists the done puzzles of a Decoded game with their clue, word and finder, the current one and the coming slots', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = rm27dRoom(GameKind::Decoded, ['rounds_per_game' => 4]);
    GameRound::factory()->game(GameKind::Decoded)->ended(GameRoundOutcome::Guessed)->create([
        'game_room_id' => $room->id, 'word' => 'pizza', 'clue' => ['🍕'], 'number' => 1, 'rounds_total' => 4,
        'leader_player_id' => $adaPlayer->id, 'winner_player_id' => $bobPlayer->id, 'started_at' => now()->subMinutes(6),
    ]);
    GameRound::factory()->game(GameKind::Decoded)->ended(GameRoundOutcome::TimedOut)->create([
        'game_room_id' => $room->id, 'word' => 'rain', 'clue' => ['🌧️'], 'number' => 2, 'rounds_total' => 4,
        'leader_player_id' => $bobPlayer->id, 'started_at' => now()->subMinutes(3),
    ]);
    activeGameRound($room, ['word' => 'rocket', 'clue' => ['🚀'], 'number' => 3, 'rounds_total' => 4, 'leader_player_id' => $adaPlayer->id]);

    $guesser = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $rows = '[data-slot="decoded-puzzles"] li';

    $guesser->assertSeeIn('[data-slot="decoded-puzzles"] h2', 'Puzzles')
        ->assertSeeIn('[data-slot="decoded-puzzles"]', '3 / 4')
        ->assertCount($rows, 4)
        ->assertAttribute("{$rows}:nth-child(1)", 'data-state', 'done')
        ->assertSeeIn("{$rows}:nth-child(1)", 'pizza')
        ->assertSeeIn("{$rows}:nth-child(1)", 'Found by Bob')
        ->assertPresent("{$rows}:nth-child(1) [role=\"img\"][aria-label=\"Clue: 🍕\"]")
        ->assertSeeIn("{$rows}:nth-child(2)", 'rain')
        ->assertSeeIn("{$rows}:nth-child(2)", 'Not found')
        ->assertAttribute("{$rows}:nth-child(3)", 'aria-current', 'step')
        ->assertSeeIn("{$rows}:nth-child(3)", 'In progress')
        ->assertDontSeeIn("{$rows}:nth-child(3)", 'rocket')
        ->assertAttribute("{$rows}:nth-child(4)", 'data-state', 'next')
        ->assertSeeIn("{$rows}:nth-child(4)", 'Puzzle 4')
        ->assertSeeIn("{$rows}:nth-child(4)", 'Hidden until its turn')
        ->assertSeeIn('[data-slot="round-info"]', 'Round 3 of 4');
});
