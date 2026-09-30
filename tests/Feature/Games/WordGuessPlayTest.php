<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameGuessMade;
use App\Events\Games\GameHintRevealed;
use App\Events\Games\GameRoundEnded;
use App\Models\GameGuess;
use App\Models\GamePoint;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

dataset('guessing games', [GameKind::DrawAndGuess, GameKind::Decoded]);

it('gives the word to the leader only', function (GameKind $game) {
    $table = wordGuessTable($game);
    $guest = gameRoomGuest($table['room']);

    $this->actingAs($table['leaderUser'])
        ->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertExactJson(['word' => 'rocket']);

    foreach ([$table['hostUser'], $table['guesserUser']] as $user) {
        $this->actingAs($user)->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))->assertForbidden();
    }

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))
        ->assertForbidden();
})->with('guessing games');

it('refuses the secret of an ended round', function () {
    $table = wordGuessTable();
    $table['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    $this->actingAs($table['leaderUser'])
        ->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))
        ->assertConflict();
});

it('reveals one letter per hint for the leader', function (GameKind $game) {
    $table = wordGuessTable($game);

    $response = $this->actingAs($table['leaderUser'])
        ->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('roundId', $table['round']->id);

    $mask = $response->json('mask');
    $shown = array_keys(array_filter($mask, fn (?string $letter) => $letter !== null));

    expect($shown)->toHaveCount(1)
        ->and($mask[$shown[0]])->toBe(mb_str_split('rocket')[$shown[0]])
        ->and($table['round']->fresh()->revealed_positions)->toBe($shown);

    Event::assertDispatched(GameHintRevealed::class, fn (GameHintRevealed $event) => $event->mask === $mask
        && ! gamePayloadExposesWord($event->broadcastWith(), 'rocket'));
})->with('guessing games');

it('stops at half the letters', function () {
    $table = wordGuessTable();

    $this->actingAs($table['leaderUser']);

    foreach (range(1, 3) as $hint) {
        $this->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))->assertOk();
    }

    $this->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['hint' => __('No more letters can be revealed for this word.')]);

    expect($table['round']->fresh()->revealed_positions)->toHaveCount(3);
});

it('never reveals a separator and counts letters only', function (string $word, int $hints, array $separators) {
    $table = wordGuessTable(GameKind::Decoded, $word);

    $this->actingAs($table['leaderUser']);

    foreach (range(1, $hints) as $hint) {
        $this->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))->assertOk();
    }

    $this->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))->assertUnprocessable();

    expect(array_intersect($table['round']->fresh()->revealed_positions, $separators))->toBe([]);
})->with([
    'hyphen' => ['to-do', 2, [2]],
    'apostrophe' => ["l'été", 2, [1]],
    'space' => ['stand up', 3, [5]],
    'three letters' => ['bug', 1, []],
]);

it('keeps hints to the leader', function () {
    $table = wordGuessTable();

    $this->actingAs($table['hostUser'])
        ->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))
        ->assertForbidden();

    expect($table['round']->fresh()->revealed_positions)->toBe([]);
});

it('broadcasts a wrong guess to the others', function (GameKind $game) {
    $table = wordGuessTable($game);

    $response = $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'planet'])
        ->assertOk()
        ->assertJsonPath('result', 'wrong')
        ->assertJsonPath('ended', null);

    $guess = GameGuess::query()->sole();

    expect($response->json('guessId'))->toBe($guess->id)
        ->and($guess->text)->toBe('planet')
        ->and($guess->is_near_miss)->toBeFalse()
        ->and($guess->is_correct)->toBeFalse();

    Event::assertDispatched(GameGuessMade::class, fn (GameGuessMade $event) => $event->broadcastWith() === [
        'roundId' => $table['round']->id,
        'guessId' => $guess->id,
        'playerId' => $table['guesser']->id,
        'text' => 'planet',
    ]);
})->with('guessing games');

it('tells only the guesser that a guess was very close', function () {
    $table = wordGuessTable();

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rockt'])
        ->assertOk()
        ->assertJsonPath('result', 'near');

    expect(GameGuess::query()->sole()->is_near_miss)->toBeTrue();

    Event::assertDispatched(GameGuessMade::class, fn (GameGuessMade $event) => $event->broadcastWith()['text'] === 'rockt'
        && ! str_contains(gamePayloadJson($event->broadcastWith()), 'near')
        && ! str_contains(gamePayloadJson($event->broadcastWith()), 'veryClose'));
});

it('accepts a correct guess whatever its case, accents and spacing', function (GameKind $game) {
    $table = wordGuessTable($game);

    $response = $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => '  RoCkÉt '])
        ->assertOk()
        ->assertJsonPath('result', 'correct')
        ->assertJsonPath('ended.outcome', 'guessed')
        ->assertJsonPath('ended.word', 'rocket')
        ->assertJsonPath('ended.winnerPlayerId', $table['guesser']->id)
        ->assertJsonPath('ended.leaderPlayerId', $table['leader']->id);

    expect($table['round']->fresh())
        ->outcome->toBe(GameRoundOutcome::Guessed)
        ->winner_player_id->toBe($table['guesser']->id)
        ->and(GameGuess::query()->sole()->is_correct)->toBeTrue()
        ->and(GamePoint::query()->where('player_id', $table['guesser']->id)->sole()->points)->toBe(10)
        ->and(str_contains(gamePayloadJson($response->json()), 'RoCkÉt'))->toBeFalse();

    Event::assertNotDispatched(GameGuessMade::class);
    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => ! str_contains(gamePayloadJson($event->payload), 'RoCkÉt'));
})->with('guessing games');

it('lets guests guess', function () {
    $table = wordGuessTable();
    $guest = gameRoomGuest($table['room']);

    $this->withCookies(gameGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertOk()
        ->assertJsonPath('ended.winnerPlayerId', $guest->id);
});

it('keeps the leader from guessing', function () {
    $table = wordGuessTable();

    $this->actingAs($table['leaderUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertForbidden()
        ->assertJsonPath('message', __('You are leading this round, so you cannot guess.'));

    expect(GameGuess::query()->count())->toBe(0)
        ->and($table['round']->fresh()->isActive())->toBeTrue();
});

it('refuses a guess after the round ended', function () {
    $table = wordGuessTable();
    $table['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Guessed])->save();

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertConflict()
        ->assertJsonPath('message', __('This round is over.'));

    expect(GameGuess::query()->count())->toBe(0)
        ->and(GamePoint::query()->count())->toBe(0);
});

it('refuses guesses in Hangman', function () {
    $table = wordGuessTable(GameKind::Hangman);

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertUnprocessable();
});

it('validates the guess text', function (mixed $text) {
    $table = wordGuessTable();

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => $text])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('text');

    expect(GameGuess::query()->count())->toBe(0);
})->with([
    'empty' => '',
    'only spaces' => '    ',
    'too long' => str_repeat('a', 51),
    'not text' => [['rocket']],
]);

it('slows down a player guessing too fast', function () {
    $table = wordGuessTable();

    $this->actingAs($table['guesserUser']);

    foreach (['one', 'two', 'three'] as $text) {
        $this->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => $text])->assertOk();
    }

    $this->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'four'])
        ->assertTooManyRequests()
        ->assertJsonPath('message', __('Slow down a little.'));

    $this->travel(4)->seconds();

    $this->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'four'])->assertOk();
});

it('lets the leader or the host pass', function (string $who) {
    $table = wordGuessTable();
    $actor = $who === 'leader' ? $table['leaderUser'] : $table['hostUser'];

    $this->actingAs($actor)
        ->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'passed')
        ->assertJsonPath('ended.word', 'rocket');

})->with(['leader', 'host']);

it('keeps passing to the leader and the host', function () {
    $table = wordGuessTable();

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))
        ->assertForbidden();

    expect($table['round']->fresh()->isActive())->toBeTrue();
});
