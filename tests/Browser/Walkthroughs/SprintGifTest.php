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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

function sprintGifFakeGifs(): void
{
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'browser-gif-key', 'rating' => 'pg']]);

    Storage::fake();

    Http::fake([
        'api.giphy.com/*' => function (HttpRequest $request) {
            $endpoint = basename((string) parse_url($request->url(), PHP_URL_PATH));

            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);

            if ($endpoint === 'trending') {
                return Http::response(['data' => [giphyItem('trendone'), giphyItem('trendtwo')]]);
            }

            if ($endpoint === 'search') {
                $word = preg_replace('/[^a-z]/', '', strtolower((string) ($query['q'] ?? '')));

                return Http::response(['data' => [giphyItem("{$word}one"), giphyItem("{$word}two")]]);
            }

            return Http::response(['data' => giphyItem($endpoint)]);
        },
        'media.giphy.com/*' => fn () => Http::response(
            base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
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
function sprintGifWalkthroughRoom(GameKind $game = GameKind::SprintGif): array
{
    $room = GameRoom::factory()->game($game)->linkAccess()->create(['name' => 'Friday fun']);
    [$ada, $adaPlayer] = gameRoomHost($room);

    return [
        'room' => $room->fresh(),
        'ada' => renamedUser($ada, 'Ada'),
        'adaPlayer' => $adaPlayer,
    ];
}

function sprintGifAnswer(GameRound $round, GamePlayer $player, string $gifId): GameGifAnswer
{
    return GameGifAnswer::factory()->create([
        'game_round_id' => $round->id,
        'player_id' => $player->id,
        'gif_id' => $gifId,
    ]);
}

function sprintGifTile(string $gifId): string
{
    return "figure:has(img[src=\"/gifs/{$gifId}/preview\"])";
}

const SprintGifPicker = '[data-slot="gif-answer-stage"] [data-slot="gif-picker"]';
const SprintGifYourPick = '[data-slot="gif-your-pick"]';

function sprintGifResult(string $gifId): string
{
    return SprintGifPicker." [role=\"option\"]:has(img[src=\"/gifs/{$gifId}/preview\"])";
}

function sprintGifDraft(mixed $page, string $query, string $gifId): mixed
{
    return $page->assertNotPresent('[role="dialog"]')
        ->assertSeeIn(SprintGifPicker, 'Powered by GIPHY')
        ->fill(SprintGifPicker.' [aria-label="Search GIPHY"]', $query)
        ->assertPresent(sprintGifResult($gifId))
        ->click(sprintGifResult($gifId))
        ->assertSeeIn(SprintGifYourPick, 'Draft')
        ->assertSeeIn(sprintGifTile($gifId), 'Your GIF');
}

function sprintGifPick(mixed $page, string $query, string $gifId): mixed
{
    return sprintGifDraft($page, $query, $gifId)
        ->click('Send my GIF')
        ->assertSeeIn(SprintGifYourPick, 'Sent')
        ->assertDontSeeIn(SprintGifYourPick, 'Draft');
}

it('lets the host switch to Sprint in one GIF, start, shuffle and edit the question until the first answer', function () {
    sprintGifFakeGifs();
    $questions = ['Which GIF sums up the sprint?', 'How did the sprint feel?'];
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => $questions]));
    ['room' => $room, 'ada' => $ada] = sprintGifWalkthroughRoom(GameKind::Hangman);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $c = $this->awaitRealtime($this->joinAsGuest(route('games.join.show', $room->guest_token, false), 'Casey'));

    foreach ([$a, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $c->assertSeeIn('header:has(h1)', 'Hangman')
        ->assertSee('Waiting for the host to start.');

    $a->click('[role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]:has-text("Sprint in one GIF")')
        ->assertSeeIn('#game-stage-title', 'Sprint in one GIF')
        ->assertNotPresent('[data-slot="game-left"] [role="radiogroup"]')
        ->click('[data-slot="game-left"] button:has-text("Choose a game")')
        ->assertAriaAttribute('[role="dialog"] [role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]:has-text("Sprint in one GIF")', 'checked', 'true')
        ->assertSeeIn('[role="dialog"] [role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]:has-text("Sprint in one GIF")', 'In play')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

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

    sprintGifPick($c, 'party', 'partyone');

    $a->assertSeeIn('ul[aria-label="Answers"]', 'Casey answered')
        ->assertDontSee('Shuffle question')
        ->assertDontSee('Edit question');

    expect($room->fresh()->game)->toBe(GameKind::SprintGif)
        ->and($round->fresh()->question)->toBe('Which GIF is our sprint in one picture?')
        ->and($round->gifAnswers()->count())->toBe(1);
});

it('lets each player search, pick, change and remove a GIF while the other only ever gets a placeholder', function () {
    sprintGifFakeGifs();
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = sprintGifWalkthroughRoom();
    $round = activeGifRound($room);
    $snapshotPath = "/games/{$room->id}/snapshot";
    $documentHas = fn (string $gifId): string => "document.documentElement.outerHTML.includes(\"{$gifId}\")";

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $c = $this->awaitRealtime($this->joinAsGuest(route('games.join.show', $room->guest_token, false), 'Casey'));

    foreach ([$a, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSee('How did the sprint feel?')
            ->assertSee('No GIFs yet.');
    }

    sprintGifDraft($a, 'party', 'partytwo')
        ->assertDontSee('Change GIF')
        ->assertAriaAttribute(sprintGifResult('partytwo'), 'selected', 'true');

    expect($round->gifAnswers()->count())->toBe(0);

    $c->assertSee('No GIFs yet.')
        ->assertNotPresent('ul[aria-label="Answers"]');

    $a->click(SprintGifYourPick.' button:has-text("Change")')
        ->assertNotPresent(sprintGifTile('partytwo'))
        ->assertSeeIn(SprintGifYourPick, 'Choose a GIF')
        ->assertScript('document.activeElement.getAttribute("aria-label")', 'Search GIPHY');

    sprintGifPick($a, 'party', 'partyone');

    $a->assertSeeIn(sprintGifTile('partyone'), 'Your GIF')
        ->assertScript('document.querySelector("figure img").naturalWidth', 1)
        ->assertSee('Change GIF')
        ->assertSee('Remove GIF');

    $c->assertSeeIn('ul[aria-label="Answers"]', 'Ada answered')
        ->assertNotPresent('figure:has(img)')
        ->assertScript($documentHas('partyone'), false);

    $body = json_encode($this->snapshotOf($c, $snapshotPath), JSON_THROW_ON_ERROR);

    expect($body)->toContain('"answered":true')
        ->not->toContain('partyone');

    $a->click('Change GIF')
        ->assertScript('document.activeElement.getAttribute("aria-label")', 'Search GIPHY');

    sprintGifDraft($a, 'coffee', 'coffeeone');

    expect($round->gifAnswers()->where('player_id', $adaPlayer->id)->sole()->gif_id)->toBe('partyone');

    $a->click('Send my GIF')
        ->assertSeeIn(SprintGifYourPick, 'Sent');

    $a->assertSeeIn(sprintGifTile('coffeeone'), 'Your GIF')
        ->assertNotPresent(sprintGifTile('partyone'));

    $c->assertSeeIn('ul[aria-label="Answers"]', 'Ada answered')
        ->assertScript($documentHas('coffeeone'), false);

    expect(json_encode($this->snapshotOf($c, $snapshotPath), JSON_THROW_ON_ERROR))->not->toContain('coffeeone')
        ->and($round->gifAnswers()->where('player_id', $adaPlayer->id)->sole()->gif_id)->toBe('coffeeone');

    $a->click('Remove GIF')
        ->assertSeeIn(SprintGifYourPick, 'Choose a GIF')
        ->assertDontSee('Your GIF');

    $c->assertNotPresent('ul[aria-label="Answers"]')
        ->assertSee('No GIFs yet.');

    expect($round->gifAnswers()->count())->toBe(0);

    sprintGifPick($c, 'tada', 'tadaone');

    $c->assertSeeIn(sprintGifTile('tadaone'), 'Your GIF');

    $a->assertSeeIn('ul[aria-label="Answers"]', 'Casey answered')
        ->assertNotPresent('figure:has(img)')
        ->assertScript($documentHas('tadaone'), false);

    expect(json_encode($this->snapshotOf($a, $snapshotPath), JSON_THROW_ON_ERROR))->not->toContain('tadaone')
        ->and($round->gifAnswers()->sole()->gif_id)->toBe('tadaone');
});

it('reveals the GIFs to everyone when the one-minute timer runs out, without closing the round', function () {
    config(['queue.default' => 'database']);
    sprintGifFakeGifs();
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = sprintGifWalkthroughRoom();
    [$bob, $bobPlayer] = namedGamePlayer($room, 'Bob');
    $round = activeGifRound($room);
    sprintGifAnswer($round, $adaPlayer, 'partyone');
    sprintGifAnswer($round, $bobPlayer, 'coffeeone');

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
            ->assertPresent(sprintGifTile('partyone'))
            ->assertPresent(sprintGifTile('coffeeone'))
            ->assertSee('0 of 2 voted')
            ->assertNotPresent('[data-slot="gif-results"]')
            ->assertDontSee('Change GIF');
    }

    $a->assertSeeIn(sprintGifTile('partyone'), 'Your GIF')
        ->assertSeeIn(sprintGifTile('coffeeone'), 'by Bob')
        ->assertSee('Finish round');

    $b->assertSeeIn(sprintGifTile('partyone'), 'by Ada')
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

it('lets each player vote for another GIF, change and retract the vote, with a live tally and no counts', function () {
    sprintGifFakeGifs();
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = sprintGifWalkthroughRoom();
    [$bob, $bobPlayer] = namedGamePlayer($room, 'Bob');
    [, $cleoPlayer] = namedGamePlayer($room, 'Cleo');
    $round = activeGifRound($room, ['revealed_at' => now()->startOfSecond()]);
    sprintGifAnswer($round, $adaPlayer, 'partyone');
    sprintGifAnswer($round, $bobPlayer, 'coffeeone');
    sprintGifAnswer($round, $cleoPlayer, 'tadaone');
    $favourite = fn (string $gifId): string => sprintGifTile($gifId).' button';

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSee('Vote for your favourite GIF.')
            ->assertSee('0 of 2 voted')
            ->assertCount('figure:has(img)', 3);
    }

    $b->assertSeeIn(sprintGifTile('coffeeone'), 'Your GIF')
        ->assertNotPresent($favourite('coffeeone'))
        ->assertSeeIn($favourite('partyone'), 'Favourite')
        ->click($favourite('partyone'))
        ->assertSeeIn($favourite('partyone'), 'Your favourite')
        ->assertAriaAttribute($favourite('partyone'), 'pressed', 'true');

    $a->assertSee('1 of 2 voted')
        ->assertNotPresent('[data-slot="gif-results"]')
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
        ->assertNotPresent('[data-slot="gif-results"]');

    expect($round->fresh()->ended_at)->toBeNull();
});

it('shows the vote counts and "+2" per vote to everyone when the host finishes the round, and the same counts in the history', function () {
    sprintGifFakeGifs();
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = sprintGifWalkthroughRoom();
    [$bob, $bobPlayer] = namedGamePlayer($room, 'Bob');
    $round = activeGifRound($room, ['revealed_at' => now()->startOfSecond()]);
    $adaAnswer = sprintGifAnswer($round, $adaPlayer, 'partyone');
    sprintGifAnswer($round, $bobPlayer, 'coffeeone');
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
            ->assertNotPresent('[data-slot="gif-results"]');
    }

    $a->click('Finish round');

    foreach ([$a, $b] as $page) {
        $page->assertSee('Revealed')
            ->assertSee('How did the sprint feel?')
            ->assertSeeIn(sprintGifTile('partyone'), '1 vote')
            ->assertSeeIn(sprintGifTile('partyone'), '+2')
            ->assertSeeIn(sprintGifTile('partyone'), 'by Ada')
            ->assertSeeIn(sprintGifTile('coffeeone'), '0 votes')
            ->assertDontSeeIn(sprintGifTile('coffeeone'), '+2')
            ->assertDontSee('Vote for your favourite GIF.');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed)
        ->and(GamePoint::query()->where('player_id', $adaPlayer->id)->sole()->points)->toBe(2)
        ->and(GamePoint::query()->where('player_id', $bobPlayer->id)->sole()->points)->toBe(0);

    $b->click('History')
        ->assertSee('Last rounds')
        ->click('[role="dialog"] button:has-text("How did the sprint feel?")')
        ->assertSeeIn('[role="dialog"] '.sprintGifTile('partyone'), '1 vote')
        ->assertSeeIn('[role="dialog"] '.sprintGifTile('coffeeone'), '0 votes');
});

it('closes the voting round with its counts when the timer runs out during voting', function () {
    config(['queue.default' => 'database']);
    sprintGifFakeGifs();
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = sprintGifWalkthroughRoom();
    [$bob, $bobPlayer] = namedGamePlayer($room, 'Bob');
    $round = activeGifRound($room, ['revealed_at' => now()->startOfSecond()]);
    $adaAnswer = sprintGifAnswer($round, $adaPlayer, 'partyone');
    sprintGifAnswer($round, $bobPlayer, 'coffeeone');
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
            ->assertSeeIn(sprintGifTile('partyone'), '1 vote')
            ->assertSeeIn(sprintGifTile('partyone'), '+2')
            ->assertSeeIn(sprintGifTile('coffeeone'), '0 votes')
            ->assertDontSee('Vote for your favourite GIF.');
    }

    $a->assertSee('Next round');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed)
        ->and(GamePoint::query()->where('player_id', $adaPlayer->id)->sole()->points)->toBe(2);
});

it('closes a round in its voting window with its points when the host starts the next round from a page that has not seen it', function () {
    sprintGifFakeGifs();
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['Which GIF sums up the sprint?', 'How did the sprint feel?']]));
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = sprintGifWalkthroughRoom();
    [$bob, $bobPlayer] = namedGamePlayer($room, 'Bob');

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $this->awaitResync($a)->assertSee('Ready to play?');

    $round = activeGifRound($room, ['revealed_at' => now()->startOfSecond()]);
    $adaAnswer = sprintGifAnswer($round, $adaPlayer, 'partyone');
    GameGifVote::factory()->create([
        'game_round_id' => $round->id,
        'voter_player_id' => $bobPlayer->id,
        'answer_id' => $adaAnswer->id,
    ]);

    $this->awaitRealtime($b->navigate("/games/{$room->id}"))
        ->assertSee('How did the sprint feel?')
        ->assertSee('Vote for your favourite GIF.')
        ->assertSee('1 of 2 voted');

    $a->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertSee('Ready to play?')
        ->click('Start');

    foreach ([$a, $b] as $page) {
        $page->assertSee('Which GIF sums up the sprint?')
            ->assertSee('Pick a GIF that answers the question.')
            ->assertDontSee('Vote for your favourite GIF.');
    }

    $b->assertNotPresent('[data-slot="game-left"] [role="tab"]')
        ->assertNotPresent('[data-slot="game-right"] [role="tab"]')
        ->assertPresent('[data-slot="game-right"] [data-slot="gif-your-pick"]')
        ->assertPresent('[data-slot="game-right"] [data-slot="room-scores"] li:has-text("Ada") [aria-label="2 points"]')
        ->assertNotPresent('[data-slot="game-left"] [data-slot="player-points"]');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed)
        ->and(GamePoint::query()->where('player_id', $adaPlayer->id)->sole()->points)->toBe(2)
        ->and(GameRound::query()->where('game_room_id', $room->id)->whereNull('ended_at')->sole()->question)->toBe('Which GIF sums up the sprint?');
});
