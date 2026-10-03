<?php

use App\Enums\GameKind;
use App\Events\Games\GameWordChanged;
use App\Models\GameGuess;
use Illuminate\Support\Facades\Event;

beforeEach(fn () => Event::fake());

it('gives the drawer another word once, clears the drawing and the hints, and tells the others the new mask only', function () {
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', [
        'guessers_total' => 1,
        'revealed_positions' => [0],
        'drawing' => [['type' => 'fill', 'color' => 'black', 'x' => 1, 'y' => 1]],
        'drawing_points' => 1,
    ]);
    $uri = route('games.rounds.wordChanges.store', [$table['room'], $table['round']]);

    $response = $this->actingAs($table['leaderUser'])->postJson($uri)
        ->assertOk()
        ->assertJsonPath('roundId', $table['round']->id)
        ->assertJsonPath('wordChangesLeft', 0);

    $word = $response->json('word');
    $round = $table['round']->fresh();

    expect($word)->not->toBe('rocket')
        ->and($round->word)->toBe($word)
        ->and($round->revealed_positions)->toBe([])
        ->and($round->drawing)->toBe([])
        ->and($round->word_changes)->toBe(1)
        ->and($response->json('mask'))->not->toContain(mb_str_split($word)[0]);

    Event::assertDispatched(fn (GameWordChanged $event) => $event->payload['roundId'] === $round->id
        && $event->payload['mask'] === $response->json('mask')
        && ! gamePayloadExposesWord($event->broadcastWith(), $word));

    $this->actingAs($table['leaderUser'])->postJson($uri)
        ->assertConflict()
        ->assertJsonPath('message', __('You have already changed the word.'));
});

it('refuses a new word once someone found it, and from anyone but the drawer', function () {
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', ['guessers_total' => 2]);
    $uri = route('games.rounds.wordChanges.store', [$table['room'], $table['round']]);

    $this->actingAs($table['guesserUser'])->postJson($uri)->assertForbidden();
    $this->actingAs($table['hostUser'])->postJson($uri)->assertForbidden();

    GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id, 'text' => 'rocket', 'is_correct' => true, 'hints' => 0]);

    $this->actingAs($table['leaderUser'])->postJson($uri)
        ->assertConflict()
        ->assertJsonPath('message', __('Someone has already found the word.'));
});

it('refuses a new word in Decoded', function () {
    $table = wordGuessTable(GameKind::Decoded);

    $this->actingAs($table['leaderUser'])
        ->postJson(route('games.rounds.wordChanges.store', [$table['room'], $table['round']]))
        ->assertUnprocessable();
});
