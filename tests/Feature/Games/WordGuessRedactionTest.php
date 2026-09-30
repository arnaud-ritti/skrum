<?php

use App\Enums\GameKind;
use App\Events\Games\GameBroadcastEvent;
use App\Events\Games\GameClueChanged;
use App\Events\Games\GameDrawingOpAdded;
use App\Events\Games\GameGuessMade;
use App\Events\Games\GameHintRevealed;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameTimerChanged;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

const GuessedWord = 'labyrinth';

beforeEach(function () {
    Event::fake();
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => GuessedWord, 'drawable' => true]]]));
});

dataset('redacted guessing games', [GameKind::DrawAndGuess, GameKind::Decoded]);

/**
 * @return Collection<int, GameBroadcastEvent>
 */
function wordGuessRoundBroadcasts(): Collection
{
    return collect([
        GameRoundStarted::class,
        GameHintRevealed::class,
        GameDrawingOpAdded::class,
        GameClueChanged::class,
        GameGuessMade::class,
        GameTimerChanged::class,
        GameRoomChanged::class,
    ])
        ->flatMap(fn (string $class) => Event::dispatched($class))
        ->map(fn (array $arguments): GameBroadcastEvent => $arguments[0]);
}

/**
 * @param  array<mixed>  $payload
 */
function wordGuessPayloadHasPointsKey(array $payload): bool
{
    foreach ($payload as $key => $value) {
        if ($key === 'points') {
            return true;
        }

        if (is_array($value) && wordGuessPayloadHasPointsKey($value)) {
            return true;
        }
    }

    return false;
}

/**
 * A round started by the host with a member as leader, after the leader
 * revealed a hint and acted on the board.
 *
 * @return array{room: GameRoom, host: User, leader: User, guesser: User, guestCookie: array<string, string>, round: GameRound, startResponse: array<string, mixed>}
 */
function redactedWordGuessRound(GameKind $game): array
{
    $room = GameRoom::factory()->game($game)->linkAccess()->create();
    [$host] = gameRoomHost($room);
    [$leader, $leaderPlayer] = gameRoomMember($room);
    [$guesser] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $startResponse = test()->actingAs($host)
        ->postJson(route('games.rounds.store', $room), ['leader_player_id' => $leaderPlayer->id])
        ->assertCreated()
        ->json();

    $round = GameRound::query()->sole();

    test()->actingAs($leader)->postJson(route('games.rounds.hints.store', [$room, $round]))->assertOk();

    $game === GameKind::DrawAndGuess
        ? test()->actingAs($leader)->postJson(route('games.rounds.drawing-ops.store', [$room, $round]), [
            'client_op_id' => 'op-1',
            'op' => ['type' => 'stroke', 'color' => 'black', 'size' => 4, 'points' => [[10, 10], [20, 20]]],
        ])->assertCreated()
        : test()->actingAs($leader)->putJson(route('games.rounds.clue.update', [$room, $round]), ['clue' => ['🌀', '🧭']])->assertOk();

    test()->actingAs($guesser)->postJson(route('games.rounds.guesses.store', [$room, $round]), ['text' => 'maze'])->assertOk();

    return [
        'room' => $room,
        'host' => $host,
        'leader' => $leader,
        'guesser' => $guesser,
        'guestCookie' => gameGuestCookie($guest),
        'round' => $round,
        'startResponse' => $startResponse,
    ];
}

it('keeps the word out of every non-leader snapshot, page and response', function (GameKind $game) {
    $table = redactedWordGuessRound($game);

    expect(gamePayloadExposesWord($table['startResponse'], GuessedWord))->toBeFalse();

    foreach ([$table['host'], $table['guesser']] as $user) {
        $snapshot = $this->actingAs($user)->getJson(route('games.snapshot.show', $table['room']))->assertOk()->json();

        expect(gamePayloadExposesWord($snapshot, GuessedWord))->toBeFalse()
            ->and(gamePayloadJson($snapshot))->not->toContain('drawing_points')
            ->not->toContain('drawingPoints')
            ->and(wordGuessPayloadHasPointsKey(Arr::except($snapshot['round'], ['drawing'])))->toBeFalse();
    }

    $this->actingAs($table['guesser'])
        ->get(route('games.show', $table['room']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('snapshot.round.id', $table['round']->id)
            ->where('snapshot', fn ($snapshot) => ! gamePayloadExposesWord($snapshot->toArray(), GuessedWord)));

    app('auth')->forgetGuards();

    $guestSnapshot = $this->withCookies($table['guestCookie'])->withCredentials()->getJson(route('games.snapshot.show', $table['room']))->assertOk()->json();

    expect(gamePayloadExposesWord($guestSnapshot, GuessedWord))->toBeFalse();
})->with('redacted guessing games');

it('gives the word to the leader in the snapshot and the secret endpoint', function (GameKind $game) {
    $table = redactedWordGuessRound($game);

    $this->actingAs($table['leader'])->getJson(route('games.snapshot.show', $table['room']))->assertJsonPath('round.word', GuessedWord);
    $this->actingAs($table['leader'])->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))->assertJsonPath('word', GuessedWord);

    foreach ([$table['host'], $table['guesser']] as $user) {
        $this->actingAs($user)->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))->assertForbidden();
    }
})->with('redacted guessing games');

it('keeps the word out of every broadcast while the round is active', function (GameKind $game) {
    redactedWordGuessRound($game);

    $broadcasts = wordGuessRoundBroadcasts();

    expect($broadcasts->map(fn (GameBroadcastEvent $event) => $event->broadcastAs())->unique()->values()->all())
        ->toContain('game.round.started', 'game.hint.revealed', 'game.guess.made')
        ->and($broadcasts->contains(fn (GameBroadcastEvent $event) => gamePayloadExposesWord($event->broadcastWith(), GuessedWord)))->toBeFalse()
        ->and($broadcasts->reject(fn (GameBroadcastEvent $event) => $event instanceof GameDrawingOpAdded)
            ->contains(fn (GameBroadcastEvent $event) => wordGuessPayloadHasPointsKey($event->broadcastWith())))->toBeFalse();
})->with('redacted guessing games');

it('keeps active rounds out of history and round detail', function (GameKind $game) {
    $table = redactedWordGuessRound($game);

    $this->actingAs($table['guesser'])->getJson(route('games.rounds.index', $table['room']))->assertOk()->assertExactJson([]);
    $this->actingAs($table['guesser'])->getJson(route('games.rounds.show', [$table['room'], $table['round']]))->assertNotFound();
})->with('redacted guessing games');

it('never serializes the text of a correct guess', function (GameKind $game) {
    $table = redactedWordGuessRound($game);
    $typed = 'LaByRiNtH';

    $guessResponse = $this->actingAs($table['guesser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => $typed])
        ->assertOk()
        ->assertJsonPath('result', 'correct')
        ->json();

    $payloads = [
        $guessResponse,
        $this->actingAs($table['host'])->getJson(route('games.snapshot.show', $table['room']))->json(),
        $this->actingAs($table['host'])->getJson(route('games.rounds.index', $table['room']))->json(),
        $this->actingAs($table['host'])->getJson(route('games.rounds.show', [$table['room'], $table['round']]))->json(),
        ...wordGuessRoundBroadcasts()->map(fn (GameBroadcastEvent $event) => $event->broadcastWith())->all(),
        ...collect(Event::dispatched(GameRoundEnded::class))->map(fn (array $arguments) => $arguments[0]->broadcastWith())->all(),
    ];

    foreach ($payloads as $payload) {
        expect(str_contains(gamePayloadJson($payload), $typed))->toBeFalse();
    }

    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => $event->payload['word'] === GuessedWord);
})->with('redacted guessing games');

it('shows a near-miss text to everyone but flags it for its guesser only', function () {
    $table = redactedWordGuessRound(GameKind::DrawAndGuess);

    $this->actingAs($table['guesser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'labyrint'])
        ->assertOk()
        ->assertJsonPath('result', 'near');

    $hostGuesses = $this->actingAs($table['host'])->getJson(route('games.snapshot.show', $table['room']))->json('round.guesses');
    $guesserGuesses = $this->actingAs($table['guesser'])->getJson(route('games.snapshot.show', $table['room']))->json('round.guesses');

    expect(collect($hostGuesses)->firstWhere('text', 'labyrint'))->not->toHaveKey('veryClose')
        ->and(collect($guesserGuesses)->firstWhere('text', 'labyrint')['veryClose'])->toBeTrue()
        ->and(collect($guesserGuesses)->firstWhere('text', 'maze'))->not->toHaveKey('veryClose');

    Event::assertDispatched(GameGuessMade::class, fn (GameGuessMade $event) => $event->payload['text'] === 'labyrint'
        && ! str_contains(gamePayloadJson($event->broadcastWith()), 'veryClose'));
});

it('reveals the word to everyone once the round ends', function (GameKind $game) {
    $table = redactedWordGuessRound($game);

    $this->actingAs($table['host'])->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))->assertOk();

    $this->actingAs($table['guesser'])
        ->getJson(route('games.snapshot.show', $table['room']))
        ->assertJsonPath('round', null)
        ->assertJsonPath('history.0.word', GuessedWord);

    $this->actingAs($table['guesser'])
        ->getJson(route('games.rounds.show', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('word', GuessedWord)
        ->assertJsonMissingPath('guesses');
})->with('redacted guessing games');
