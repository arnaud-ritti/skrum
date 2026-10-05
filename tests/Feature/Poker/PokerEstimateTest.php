<?php

use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array<string, mixed>
 */
function estimateReadyTable(PokerDeck $deck, string $facilitatorValue, string $memberValue): array
{
    $table = pokerRevealTable($deck);
    pokerVote($table['round'], $table['facilitatorPlayer'], $facilitatorValue);
    pokerVote($table['round'], $table['memberPlayer'], $memberValue);
    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);
    $table['task'] = $table['round']->task;

    return $table;
}

it('sets the estimate after reveal', function () {
    $table = estimateReadyTable(PokerDeck::Fibonacci, '5', '8');
    $url = route('poker.tasks.estimate.update', [$table['game'], $table['task']]);

    $this->actingAs($table['member'])->putJson($url, ['value' => '8'])->assertForbidden();

    $this->actingAs($table['facilitator'])->putJson($url, ['value' => '8'])
        ->assertOk()
        ->assertJsonPath('id', $table['task']->id)
        ->assertJsonPath('estimate', '8');

    $task = $table['task']->fresh();

    expect($task->estimate)->toBe('8')
        ->and($task->estimate_numeric)->toBe(8.0)
        ->and($task->estimated_at)->not->toBeNull();

    Event::assertDispatched(fn (PokerTaskSaved $event) => $event->gameId === $table['game']->id
        && $event->task['estimate'] === '8');
});

it('rejects special and foreign cards as estimates', function (string $value) {
    $table = estimateReadyTable(PokerDeck::Fibonacci, '5', '8');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $table['task']]), ['value' => $value])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['value' => 'Choose a card from the deck.']);

    expect($table['task']->fresh()->estimate)->toBeNull();
})->with(['?', '☕', '7', 'XL']);

it('needs a countable vote', function () {
    $table = estimateReadyTable(PokerDeck::Fibonacci, '?', '☕');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $table['task']]), ['value' => '5'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['value' => 'No vote can be counted as an estimate.']);

    expect($table['task']->fresh()->estimate)->toBeNull();
});

it('needs a revealed latest round', function () {
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['memberPlayer'], '5');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $table['round']->task]), ['value' => '5'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['value' => 'Reveal the votes before setting an estimate.']);
});

it('clears the estimate at any time', function () {
    $table = pokerRevealTable();
    $task = PokerTask::factory()->estimated('5')->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => null])
        ->assertOk()
        ->assertJsonPath('estimate', null)
        ->assertJsonPath('estimatedAt', null);

    $task->refresh();

    expect($task->estimate)->toBeNull()
        ->and($task->estimate_numeric)->toBeNull()
        ->and($task->estimated_at)->toBeNull();
});

it('stores no numeric estimate for T-shirt decks', function () {
    $table = estimateReadyTable(PokerDeck::Tshirt, 'M', 'L');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $table['task']]), ['value' => 'M'])
        ->assertOk();

    expect($table['task']->fresh()->estimate_numeric)->toBeNull();
});

it('stores half a point for the modified Fibonacci ½ card', function () {
    $table = estimateReadyTable(PokerDeck::ModifiedFibonacci, '½', '1');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $table['task']]), ['value' => '½'])
        ->assertOk();

    expect($table['task']->fresh()->estimate_numeric)->toBe(0.5);
});

it('dispatches PokerTaskEstimated only when a card is set or changed', function () {
    $table = estimateReadyTable(PokerDeck::Fibonacci, '5', '8');
    $url = route('poker.tasks.estimate.update', [$table['game'], $table['task']]);
    $this->actingAs($table['facilitator']);

    $this->putJson($url, ['value' => '?'])->assertUnprocessable();
    Event::assertNotDispatched(PokerTaskEstimated::class);

    $this->putJson($url, ['value' => '8'])->assertOk();
    Event::assertDispatchedTimes(PokerTaskEstimated::class, 1);

    $this->putJson($url, ['value' => '8'])->assertOk();
    Event::assertDispatchedTimes(PokerTaskEstimated::class, 1);

    $this->putJson($url, ['value' => '5'])->assertOk();
    Event::assertDispatchedTimes(PokerTaskEstimated::class, 2);

    $this->putJson($url, ['value' => null])->assertOk();
    Event::assertDispatchedTimes(PokerTaskEstimated::class, 2);

    Event::assertDispatched(fn (PokerTaskEstimated $event) => $event->task->is($table['task']));
});
