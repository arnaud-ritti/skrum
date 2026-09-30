<?php

use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerRoundChanged;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('reveals as facilitator only', function () {
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['memberPlayer'], '5');
    $url = route('poker.rounds.reveal.store', [$table['game'], $table['round']]);

    $this->actingAs($table['member'])->postJson($url)->assertForbidden();

    expect($table['round']->fresh()->revealed_at)->toBeNull();

    $this->actingAs($table['facilitator'])->postJson($url)
        ->assertOk()
        ->assertJsonPath('id', $table['round']->id)
        ->assertJsonPath('revealReason', 'manual');

    $round = $table['round']->fresh();

    expect($round->revealed_at)->not->toBeNull()
        ->and($round->reveal_reason)->toBe(PokerRevealReason::Manual);

    Event::assertDispatched(PokerRoundChanged::class, fn (PokerRoundChanged $event) => $event->gameId === $table['game']->id);
});

it('needs a vote to reveal', function () {
    $table = pokerRevealTable();

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$table['game'], $table['round']]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['round' => 'Nobody has voted yet.']);

    expect($table['round']->fresh()->revealed_at)->toBeNull();
    Event::assertNotDispatched(PokerRoundChanged::class);
});

it('reveals once', function () {
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['memberPlayer'], '5');
    $url = route('poker.rounds.reveal.store', [$table['game'], $table['round']]);

    $this->actingAs($table['facilitator'])->postJson($url)->assertOk();

    $this->actingAs($table['facilitator'])->postJson($url)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'Voting is closed for this round.']);
});

it('answers the revealed round with every value', function () {
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    pokerVote($table['round'], $table['memberPlayer'], '8');

    $response = $this->actingAs($table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$table['game'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('votesCount', 2)
        ->assertJsonPath('myVote', '5')
        ->assertJsonPath('result.average', 6.5)
        ->assertJsonPath('result.nearestCard', '8')
        ->assertJsonPath('result.consensus', false);

    expect(collect($response->json('votes'))->pluck('value', 'playerId')->all())->toEqual([
        $table['facilitatorPlayer']->id => '5',
        $table['memberPlayer']->id => '8',
    ]);
});

it('starts a new round only after reveal and keeps old rounds', function () {
    $table = pokerRevealTable();
    $task = $table['round']->task;
    pokerVote($table['round'], $table['memberPlayer'], '5');
    $url = route('poker.tasks.rounds.store', [$table['game'], $task]);

    $this->actingAs($table['facilitator'])->postJson($url)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Reveal the votes before starting a new round.']);

    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);

    $this->actingAs($table['member'])->postJson($url)->assertForbidden();

    $this->actingAs($table['facilitator'])->postJson($url)
        ->assertCreated()
        ->assertJsonPath('number', 2)
        ->assertJsonPath('votesCount', 0)
        ->assertJsonPath('revealedAt', null)
        ->assertJsonPath('timerEndsAt', null);

    expect($task->rounds()->count())->toBe(2)
        ->and($table['round']->votes()->count())->toBe(1)
        ->and($table['game']->fresh()->latestRoundOfCurrentTask()?->number)->toBe(2);

    Event::assertDispatched(PokerRoundChanged::class);
});

it('refuses reveal, re-vote and estimate on tasks without a round or not current', function () {
    $table = pokerRevealTable();
    $game = $table['game'];
    $withoutRound = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.rounds.store', [$game, $withoutRound]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Select this task first.']);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$game, $withoutRound]), ['value' => '5'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['value' => 'Reveal the votes before setting an estimate.']);

    $game->forceFill(['current_task_id' => $withoutRound->id])->save();

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.rounds.store', [$game, $withoutRound]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Reveal the votes before starting a new round.']);

    $elsewhere = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $openElsewhere = PokerRound::factory()->create(['poker_task_id' => $elsewhere->id]);
    pokerVote($openElsewhere, $table['memberPlayer'], '3');

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$game, $openElsewhere]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'Voting is closed for this round.']);

    $revealedElsewhere = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    PokerRound::factory()->revealed()->create(['poker_task_id' => $revealedElsewhere->id]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.rounds.store', [$game, $revealedElsewhere]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Select this task first.']);

    expect($openElsewhere->fresh()->revealed_at)->toBeNull()
        ->and($revealedElsewhere->rounds()->count())->toBe(1)
        ->and($withoutRound->rounds()->count())->toBe(0)
        ->and($withoutRound->fresh()->estimate)->toBeNull();
});
