<?php

use App\Actions\Poker\AutoRevealPokerRound;
use App\Jobs\RevealPokerRoundOnTimer;
use App\Models\PokerTask;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00.400'));
});

it('starts the first round of a selected task with the task timer', function () {
    Bus::fake([RevealPokerRoundOnTimer::class]);
    $table = pokerRevealTable();
    $table['game']->update(['task_timer_seconds' => 180]);
    $task = PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.current-task.update', $table['game']), ['task_id' => $task->id])
        ->assertNoContent();

    $round = $task->rounds()->sole();

    expect($round->timer_ends_at->toIso8601String())->toBe('2026-10-05T10:03:00+00:00');

    Bus::assertDispatched(fn (RevealPokerRoundOnTimer $job): bool => $job->roundId === $round->id && $job->timerEndsAt === '2026-10-05T10:03:00+00:00');
});

it('starts a re-vote round with the task timer', function () {
    Bus::fake([RevealPokerRoundOnTimer::class]);
    $table = pokerRevealTable();
    $table['game']->update(['task_timer_seconds' => 60]);
    $table['round']->update(['revealed_at' => now()]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.rounds.store', [$table['game'], $table['round']->poker_task_id]))
        ->assertCreated();

    $round = $table['round']->task->latestRound()->firstOrFail();

    expect($round->number)->toBe(2)
        ->and($round->timer_ends_at->toIso8601String())->toBe('2026-10-05T10:01:00+00:00');

    Bus::assertDispatched(fn (RevealPokerRoundOnTimer $job): bool => $job->roundId === $round->id);
});

it('starts no timer without the setting', function () {
    Bus::fake([RevealPokerRoundOnTimer::class]);
    $table = pokerRevealTable();
    $task = PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.current-task.update', $table['game']), ['task_id' => $task->id])
        ->assertNoContent();

    expect($task->rounds()->sole()->timer_ends_at)->toBeNull();

    Bus::assertNotDispatched(RevealPokerRoundOnTimer::class);
});

it('reveals at the task timer expiry with auto reveal only', function (bool $autoReveal, bool $revealed) {
    $table = pokerRevealTable();
    $table['game']->update(['task_timer_seconds' => 60, 'auto_reveal' => $autoReveal]);
    fakePokerRoster([$table['memberPlayer']->id, $table['facilitatorPlayer']->id]);
    $task = PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.current-task.update', $table['game']), ['task_id' => $task->id])
        ->assertNoContent();

    $round = $task->rounds()->sole();
    pokerVote($round, $table['memberPlayer'], '3');

    $this->travel(61)->seconds();

    new RevealPokerRoundOnTimer($round->id, $round->timer_ends_at->toIso8601String())
        ->handle(resolve(AutoRevealPokerRound::class));

    expect($round->fresh()->isRevealed())->toBe($revealed);
})->with([
    'auto reveal on' => [true, true],
    'auto reveal off' => [false, false],
]);
