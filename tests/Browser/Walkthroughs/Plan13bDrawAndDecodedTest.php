<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoomChanged;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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
        'ada' => renamedUser($ada, 'Ada Host'),
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
        'bob' => renamedUser($bob, 'Bob Leader'),
        'bobPlayer' => $bobPlayer,
        'round' => activeGameRound($room, ['word' => $word, 'leader_player_id' => $bobPlayer->id, ...$roundAttributes]),
    ];
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
        ->click('form:has(input[aria-label="Your guess"]) button[type="submit"]');
}

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

it('[P13b-01] waits for another player when the host switches to Draw & Guess alone', function () {
    ['room' => $room, 'ada' => $ada] = p13bRoom(GameKind::Hangman);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $host->assertSee('Ready to play?')
        ->assertButtonEnabled('Start')
        ->click('[role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]:has-text("Draw & Guess")')
        ->assertSeeIn('#game-stage-title', 'Draw & Guess')
        ->assertNotPresent('[data-slot="game-left"] [role="radiogroup"]')
        ->click('[data-slot="game-left"] button:has-text("Choose a game")')
        ->assertAriaAttribute('[role="dialog"] [role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]:has-text("Draw & Guess")', 'checked', 'true')
        ->assertSeeIn('[role="dialog"] [role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]:has-text("Draw & Guess")', 'In play')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Waiting for another player')
        ->assertButtonDisabled('Start')
        ->assertNotPresent('button[aria-label="Who draws?"]');

    expect($room->fresh()->game)->toBe(GameKind::DrawAndGuess);
});

it('[P13b-02] lets the host choose the drawer once a guest has joined and starts the round', function () {
    onlyGameWord('lantern');
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
        ->assertSee("You're drawing — guesses are read-only for you.");

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

it('[P13b-04a] shows a line to the other player while it is drawn and keeps it after the pointer lifts', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'round' => $round] = p13bTable(GameKind::DrawAndGuess, 'lantern');

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $viewer = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $drawer->assertVisible('canvas[aria-label="Your drawing"]');
    $viewer->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertScript(canvasPixelScript('The drawing', 400, 300), '255 255 255 255');

    p13bPointer($drawer, 'pointerdown', [[0.25, 0.5]]);
    p13bPointer($drawer, 'pointermove', [[0.35, 0.5], [0.5, 0.5], [0.65, 0.5], [0.75, 0.5]]);

    $viewer->assertScript(canvasPixelScript('The drawing', 400, 300), '23 23 23 255');

    expect($round->fresh()->drawing)->toBeArray()->toBeEmpty();

    p13bPointer($drawer, 'pointerup', [[0.75, 0.5]]);

    $drawer->assertScript(p13bDrawingLengthScript($room), 1)
        ->assertScript(canvasPixelScript('Your drawing', 400, 300), '23 23 23 255')
        ->assertEnabled('[aria-label="Undo"]');

    $viewer->assertScript(canvasPixelScript('The drawing', 400, 300), '23 23 23 255')
        ->assertScript(canvasPixelScript('The drawing', 400, 100), '255 255 255 255');

    $this->awaitRealtime($viewer->navigate("/games/{$room->id}"))
        ->assertScript(canvasPixelScript('The drawing', 400, 300), '23 23 23 255')
        ->assertScript(canvasPixelScript('The drawing', 400, 100), '255 255 255 255');

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
        ->assertScript(canvasPixelScript('The drawing', 240, 240), '255 255 255 255');

    p13bPointer($drawer, 'pointerdown', [$path[0]]);
    p13bPointer($drawer, 'pointermove', array_slice($path, 1));
    p13bPointer($drawer, 'pointerup', [$path[450]]);

    $drawer->assertScript(p13bDrawingLengthScript($room), 2);

    foreach ([240, 399, 432] as $x) {
        $viewer->assertScript(canvasPixelScript('The drawing', $x, 240), '23 23 23 255');
    }

    $viewer->assertScript(canvasPixelScript('The drawing', 600, 240), '255 255 255 255');

    $this->awaitRealtime($viewer->navigate("/games/{$room->id}"));

    foreach ([240, 399, 432] as $x) {
        $viewer->assertScript(canvasPixelScript('The drawing', $x, 240), '23 23 23 255');
    }

    $viewer->assertScript(canvasPixelScript('The drawing', 600, 240), '255 255 255 255');

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
        ->click('[aria-label="Coral"]')
        ->assertAriaAttribute('[aria-label="Coral"]', 'pressed', 'true')
        ->click('[aria-label="Fill"]')
        ->assertAriaAttribute('[aria-label="Fill"]', 'pressed', 'true');

    p13bPointer($drawer, 'pointerdown', [[0.5, 0.5]]);

    $drawer->assertScript(p13bDrawingLengthScript($room), 2);

    foreach ([[$drawer, 'Your drawing'], [$viewer, 'The drawing']] as [$page, $label]) {
        $page->assertScript(canvasPixelScript($label, 400, 300), '122 52 45 255')
            ->assertScript(canvasPixelScript($label, 240, 300), '23 23 23 255')
            ->assertScript(canvasPixelScript($label, 100, 100), '255 255 255 255');
    }

    $viewer->assertScript(p13bChecksumScript('The drawing'), (string) $drawer->script(p13bChecksumScript('Your drawing')));

    $drawer->click('[aria-label="Undo"]');

    foreach ([[$drawer, 'Your drawing'], [$viewer, 'The drawing']] as [$page, $label]) {
        $page->assertScript(canvasPixelScript($label, 400, 300), '255 255 255 255')
            ->assertScript(canvasPixelScript($label, 240, 300), '23 23 23 255');
    }

    expect($round->fresh()->drawing)->toHaveCount(1);

    $drawer->click('button:has-text("Clear")')
        ->assertSee('Click again to clear');

    expect($round->fresh()->drawing)->toHaveCount(1);

    $drawer->click('button:has-text("Click again to clear")');

    foreach ([[$drawer, 'Your drawing'], [$viewer, 'The drawing']] as [$page, $label]) {
        $page->assertScript(canvasPixelScript($label, 240, 300), '255 255 255 255');
    }

    $drawer->assertDisabled('[aria-label="Undo"]');

    expect($round->fresh()->drawing)->toBeArray()->toBeEmpty();
});

it('[P13b-05c] does not show a cleared stroke again to a viewer whose room was refreshed after the stroke', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob] = p13bTable(GameKind::DrawAndGuess, 'lantern');

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $viewer = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $drawer->assertVisible('canvas[aria-label="Your drawing"]');
    $viewer->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertScript(canvasPixelScript('The drawing', 400, 300), '255 255 255 255');

    p13bPointer($drawer, 'pointerdown', [[0.25, 0.5]]);
    p13bPointer($drawer, 'pointermove', [[0.5, 0.5], [0.75, 0.5]]);

    $viewer->assertScript(canvasPixelScript('The drawing', 400, 300), '23 23 23 255');

    p13bPointer($drawer, 'pointerup', [[0.75, 0.5]]);

    $drawer->assertScript(p13bDrawingLengthScript($room), 1)
        ->click('[aria-label="Coral"]')
        ->click('[aria-label="Fill"]')
        ->assertAriaAttribute('[aria-label="Fill"]', 'pressed', 'true');

    p13bPointer($drawer, 'pointerdown', [[0.5, 0.2]]);

    $viewer->assertScript(canvasPixelScript('The drawing', 400, 100), '122 52 45 255');

    GameRoom::query()->whereKey($room->id)->update(['name' => 'Renamed room']);
    app()->instance('request', Request::create(url('/')));
    broadcast(new GameRoomChanged($room));

    $viewer->assertSeeIn('header:has(h1) h1', 'Renamed room');

    $drawer->click('button:has-text("Clear")')
        ->assertSee('Click again to clear')
        ->click('button:has-text("Click again to clear")');

    $viewer->assertScript(canvasPixelScript('The drawing', 400, 100), '255 255 255 255');

    expect($viewer->script('() => '.canvasPixelScript('The drawing', 400, 300)))->toBe('255 255 255 255');
});

it('[P13b-06] shows the committed drawing at once to a player who joins in the middle of the round', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob] = p13bTable(GameKind::DrawAndGuess, 'lantern', [
        'drawing' => [p13bLine()],
        'drawing_points' => 2,
    ]);
    $cleo = renamedUser(teamMember($room->team), 'Cleo Late');

    $drawer = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $guesser->assertPresent('[role="group"][aria-label="2 online"]');

    $late = $this->awaitRealtime($this->signIn($cleo, "/games/{$room->id}"));

    $late->assertSee('Bob Leader is drawing')
        ->assertScript(canvasPixelScript('The drawing', 400, 300), '23 23 23 255')
        ->assertScript(canvasPixelScript('The drawing', 400, 100), '255 255 255 255')
        ->assertVisible('input[aria-label="Your guess"]');

    $drawer->assertPresent('[role="group"][aria-label="3 online"]')
        ->assertSeeIn('section[aria-labelledby="game-players"]', 'Cleo Late');
});

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
            ->assertNotPresent('[role="tab"]')
            ->assertPresent('[data-slot="game-left"] section[aria-labelledby="game-players"] li:has-text("Ada Host") [aria-label="10 points"]')
            ->assertPresent('[data-slot="game-left"] section[aria-labelledby="game-players"] li:has-text("Bob Leader") [aria-label="5 points"]');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Guessed)
        ->and($round->fresh()->winner_player_id)->toBe($adaPlayer->id)
        ->and(GameGuess::query()->where('game_round_id', $round->id)->where('is_correct', true)->pluck('text')->all())->toBe(['LÀNTERN']);
});

it('[P13b-10] preselects the next online player as the drawer of the next round', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = p13bRoom(GameKind::DrawAndGuess);
    [$bob, $bobPlayer] = gameRoomMember($room);
    renamedUser($bob, 'Bob Leader');
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
    $answer = '[data-slot="decoded-answer"]';

    $leader = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guesser = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $leader->assertSee('You know the word, so you cannot guess.')
        ->assertNotPresent('input[aria-label="Your guess"]')
        ->assertSeeIn('[data-slot="game-right"] [data-slot="decoded-leaderboard"]', 'Round leaderboard');

    $guesser->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertPresent('[role="img"][aria-label="Clue: 🚀 🌕"]');

    p13bGuess($guesser, 'planet');

    $guesser->assertSeeIn($answer, 'Your attempts · 1')
        ->assertSeeIn($answer, 'planet');
    $leader->assertSeeIn($answer, 'Ada Host · planet');

    p13bGuess($guesser, 'Rocket');

    $guesser->assertSee('You found it!');

    foreach ([$leader, $guesser] as $page) {
        $page->assertSee('Guessed')
            ->assertSee('rocket')
            ->assertSee('Ada Host found it!')
            ->assertNotPresent($answer);
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Guessed)
        ->and($round->fresh()->winner_player_id)->toBe($adaPlayer->id);
});

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
    renamedUser($bob, 'Bob Leader');
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
        ->assertScript(canvasPixelScript('Drawing of lantern', 400, 300), '23 23 23 255')
        ->assertScript(canvasPixelScript('Drawing of lantern', 400, 100), '255 255 255 255')
        ->assertNotPresent('[role="dialog"] [role="toolbar"]')
        ->assertNotPresent('[role="dialog"] canvas.cursor-crosshair');

    p13bPointer($page, 'pointerdown', [[0.25, 0.2]], 'Drawing of lantern');
    p13bPointer($page, 'pointermove', [[0.5, 0.2], [0.75, 0.2]], 'Drawing of lantern');
    p13bPointer($page, 'pointerup', [[0.75, 0.2]], 'Drawing of lantern');

    $page->script('() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');

    $page->assertScript(canvasPixelScript('Drawing of lantern', 400, 120), '255 255 255 255')
        ->assertScript(canvasPixelScript('Drawing of lantern', 400, 300), '23 23 23 255');
});

it('[P13b-13b] shows the clue of a Decoded round in the history', function () {
    ['room' => $room, 'ada' => $ada] = p13bRoom(GameKind::Decoded);
    [$bob, $bobPlayer] = gameRoomMember($room);
    renamedUser($bob, 'Bob Leader');
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
