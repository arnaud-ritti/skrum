<?php

use App\Enums\GameKind;
use App\Events\Games\GameBroadcastEvent;
use App\Events\Games\GameLetterPicked;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameTimerChanged;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

const RedactedWord = 'labyrinth';

beforeEach(function () {
    Event::fake();
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => RedactedWord, 'drawable' => false]]]));
});

/**
 * Every game event dispatched before the round ended (the fake keys events
 * by their concrete class, so each class is read on its own).
 *
 * @return Collection<int, GameBroadcastEvent>
 */
function activeRoundBroadcasts(): Collection
{
    return collect([GameRoundStarted::class, GameLetterPicked::class, GameRoomChanged::class, GameTimerChanged::class])
        ->flatMap(fn (string $class) => Event::dispatched($class))
        ->map(fn (array $arguments): GameBroadcastEvent => $arguments[0]);
}

/**
 * @return array{room: GameRoom, host: User, member: User, guestCookie: array<string, string>, round: GameRound, startResponse: array<string, mixed>}
 */
function redactedHangmanRound(): array
{
    $room = GameRoom::factory()->game(GameKind::Hangman)->linkAccess()->create();
    [$host] = gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $startResponse = test()->actingAs($host)->postJson(route('games.rounds.store', $room))->assertCreated()->json();

    return [
        'room' => $room,
        'host' => $host,
        'member' => $member,
        'guestCookie' => gameGuestCookie($guest),
        'round' => GameRound::query()->sole(),
        'startResponse' => $startResponse,
    ];
}

it('keeps the word out of every snapshot while the round is active', function () {
    $table = redactedHangmanRound();

    foreach ([$table['host'], $table['member']] as $user) {
        $snapshot = $this->actingAs($user)->getJson(route('games.snapshot.show', $table['room']))->assertOk()->json();

        expect(gamePayloadExposesWord($snapshot, RedactedWord))->toBeFalse()
            ->and(payloadJson($snapshot))->not->toContain('pickedBy')
            ->and(payloadJson($snapshot))->not->toContain('"points"');
    }

    resolve('auth')->forgetGuards();

    $guestSnapshot = $this->withCookies($table['guestCookie'])->withCredentials()
        ->getJson(route('games.snapshot.show', $table['room']))->assertOk()->json();

    expect(gamePayloadExposesWord($guestSnapshot, RedactedWord))->toBeFalse();
});

it('keeps the word out of the room page, the start response and the start broadcast', function () {
    $table = redactedHangmanRound();

    expect(gamePayloadExposesWord($table['startResponse'], RedactedWord))->toBeFalse();

    $this->actingAs($table['member'])
        ->get(route('games.show', $table['room']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('snapshot.round.id', $table['round']->id)
            ->where('snapshot', fn ($snapshot) => ! gamePayloadExposesWord(json_decode(json_encode($snapshot), true), RedactedWord)));

    expect(activeRoundBroadcasts())->not->toBeEmpty()
        ->and(activeRoundBroadcasts()->contains(fn (GameBroadcastEvent $event) => gamePayloadExposesWord($event->broadcastWith(), RedactedWord)))->toBeFalse();
});

it('keeps active rounds out of history and round detail', function () {
    $table = redactedHangmanRound();

    $history = $this->actingAs($table['member'])->getJson(route('games.rounds.index', $table['room']))->assertOk()->json();

    expect($history)->toBe([]);

    $this->actingAs($table['member'])->getJson(route('games.rounds.show', [$table['room'], $table['round']]))->assertNotFound();
});

it('keeps the word out of letter broadcasts until the word is solved', function () {
    $table = redactedHangmanRound();

    $this->actingAs($table['member'])
        ->postJson(route('games.rounds.letters.store', [$table['room'], $table['round']]), ['letter' => 'a'])
        ->assertOk()
        ->assertJsonPath('ended', null);

    expect(Event::dispatched(GameLetterPicked::class))->toHaveCount(1)
        ->and(activeRoundBroadcasts()->contains(fn (GameBroadcastEvent $event) => gamePayloadExposesWord($event->broadcastWith(), RedactedWord)))->toBeFalse();
});

it('hides the word and pickers from model serialization', function () {
    $table = redactedHangmanRound();

    $json = $table['round']->fresh()->toJson();

    expect(gamePayloadExposesWord($json, RedactedWord))->toBeFalse()
        ->and($json)->not->toContain('picked_by');
});

it('reveals the word to everyone once the round ends', function () {
    $table = redactedHangmanRound();

    $this->actingAs($table['host'])->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))->assertOk();

    Event::assertDispatched(fn (GameRoundEnded $event) => $event->payload['word'] === RedactedWord);

    $this->actingAs($table['member'])
        ->getJson(route('games.snapshot.show', $table['room']))
        ->assertOk()
        ->assertJsonPath('round', null)
        ->assertJsonPath('history.0.word', RedactedWord);

    $this->actingAs($table['member'])
        ->getJson(route('games.rounds.show', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('word', RedactedWord);
});
