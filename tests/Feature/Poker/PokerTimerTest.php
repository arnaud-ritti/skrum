<?php

use App\Actions\Poker\AutoRevealPokerRound;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerTimerChanged;
use App\Jobs\RevealPokerRoundOnTimer;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00'));
});

/**
 * @return array{0: PokerGame, 1: User, 2: PokerRound}
 */
function timedTable(bool $autoReveal = false): array
{
    $game = PokerGame::factory()->create(['auto_reveal' => $autoReveal]);
    [$user] = pokerFacilitator($game);

    return [$game, $user, openPokerRound($game)];
}

function runTimerJob(PokerRound $round, string $timerEndsAt): void
{
    new RevealPokerRoundOnTimer($round->id, $timerEndsAt)->handle(resolve(AutoRevealPokerRound::class));
}

it('sets and clears the timer as facilitator', function () {
    [$game, $user, $round] = timedTable();

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 90])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => '2026-10-05T10:01:30+00:00']);

    expect($round->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-05T10:01:30+00:00');

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => null])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => null]);

    expect($round->fresh()->timer_ends_at)->toBeNull();
});

it('lets only the facilitator set the timer', function () {
    [$game, , $round] = timedTable();
    [$memberUser] = pokerMember($game);

    $this->actingAs($memberUser)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 60])
        ->assertForbidden();

    expect($round->fresh()->timer_ends_at)->toBeNull();
});

it('accepts 10 seconds to one hour', function (mixed $seconds, bool $valid) {
    [$game, $user, $round] = timedTable();

    $response = $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => $seconds]);

    $valid ? $response->assertOk() : $response->assertUnprocessable()->assertJsonValidationErrors('seconds');
})->with([
    'too short' => [9, false],
    'shortest' => [10, true],
    'longest' => [3600, true],
    'too long' => [3601, false],
    'not a number' => ['soon', false],
]);

it('requires the seconds field', function () {
    [$game, $user, $round] = timedTable();

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('seconds');
});

it('sets timers only on the open latest round of the current task', function (string $case) {
    [$game, $user, $round] = timedTable();

    $target = match ($case) {
        'revealed' => tap($round)->update(['revealed_at' => now()]),
        'older' => tap($round, fn () => PokerRound::factory()->create(['poker_task_id' => $round->poker_task_id, 'number' => 2])),
        'not current' => PokerRound::factory()->create([
            'poker_task_id' => PokerTask::factory()->create(['poker_game_id' => $game->id])->id,
        ]),
    };

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $target]), ['seconds' => 60])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Voting is closed for this round.');

    expect($target->fresh()->timer_ends_at)->toBeNull();
})->with(['revealed', 'older', 'not current']);

it('refuses timers on an ended game', function () {
    [$game, $user, $round] = timedTable();
    $game->update(['ended_at' => now()]);

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 60])
        ->assertForbidden();

    expect($round->fresh()->timer_ends_at)->toBeNull();
    Event::assertNotDispatched(PokerTimerChanged::class);
});

it('broadcasts the new end time', function () {
    [$game, $user, $round] = timedTable();

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 30])
        ->assertOk();

    Event::assertDispatched(fn (PokerTimerChanged $event) => $event->broadcastAs() === 'timer.changed'
        && $event->broadcastWith() === ['roundId' => $round->id, 'timerEndsAt' => '2026-10-05T10:00:30+00:00']);
});

it('starts a re-vote round without a timer', function () {
    [$game, $user, $round] = timedTable();
    [, $member] = pokerMember($game);
    pokerVote($round, $member, '5');

    $this->actingAs($user)->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 60])->assertOk();
    $this->actingAs($user)->postJson(route('poker.rounds.reveal.store', [$game, $round]))->assertOk();
    $this->actingAs($user)->postJson(route('poker.tasks.rounds.store', [$game, $round->task]))->assertCreated();

    expect($round->task->rounds()->where('number', 2)->sole()->timer_ends_at)->toBeNull()
        ->and($round->fresh()->timer_ends_at)->not->toBeNull();
});

it('schedules the reveal job at the end of the timer', function () {
    Queue::fake();
    [$game, $user, $round] = timedTable();

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 45])
        ->assertOk();

    Queue::assertPushed(RevealPokerRoundOnTimer::class, fn (RevealPokerRoundOnTimer $job) => $job->roundId === $round->id
        && $job->timerEndsAt === '2026-10-05T10:00:45+00:00'
        && $job->delay instanceof DateTimeInterface
        && CarbonImmutable::instance($job->delay)->equalTo(CarbonImmutable::parse('2026-10-05 10:00:45')));
});

it('schedules nothing when the timer is cleared', function () {
    Queue::fake();
    [$game, $user, $round] = timedTable();

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => null])
        ->assertOk();

    Queue::assertNothingPushed();
});

it('reveals at expiry when auto-reveal is on', function () {
    [$game, $user, $round] = timedTable(autoReveal: true);
    fakePokerRoster(null);
    [, $member] = pokerMember($game);
    pokerVote($round, $member, '5');

    $endsAt = $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 30])
        ->json('timerEndsAt');

    runTimerJob($round, $endsAt);

    expect($round->fresh()->revealed_at)->toBeNull();

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:30'));
    runTimerJob($round, $endsAt);

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::Timer);
});

it('only lets the time run out when auto-reveal is off', function () {
    [$game, $user, $round] = timedTable(autoReveal: false);
    [, $member] = pokerMember($game);
    pokerVote($round, $member, '5');

    $endsAt = $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 30])
        ->json('timerEndsAt');

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:01:00'));
    runTimerJob($round, $endsAt);

    expect($round->fresh()->revealed_at)->toBeNull();
});

it('ignores a timer job made stale by a change, a clear, a re-vote or a task switch', function (string $change) {
    [$game, $user, $round] = timedTable(autoReveal: true);
    fakePokerRoster(null);
    [, $member] = pokerMember($game);
    pokerVote($round, $member, '5');
    $otherTask = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $endsAt = $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 30])
        ->json('timerEndsAt');

    match ($change) {
        'change' => $this->actingAs($user)
            ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 120])
            ->assertOk(),
        'clear' => $this->actingAs($user)
            ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => null])
            ->assertOk(),
        're-vote' => tap($this->actingAs($user), function ($test) use ($game, $round) {
            $test->postJson(route('poker.rounds.reveal.store', [$game, $round]))->assertOk();
            $test->postJson(route('poker.tasks.rounds.store', [$game, $round->task]))->assertCreated();
        }),
        'task switch' => $this->actingAs($user)
            ->putJson(route('poker.current-task.update', $game), ['task_id' => $otherTask->id])
            ->assertNoContent(),
    };

    $this->travelTo(CarbonImmutable::parse($change === 'change' ? '2026-10-05 10:02:01' : '2026-10-05 10:00:31'));
    runTimerJob($round, $endsAt);

    if ($change === 're-vote') {
        expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::Manual)
            ->and($round->task->rounds()->where('number', 2)->sole()->revealed_at)->toBeNull();

        return;
    }

    expect($round->fresh()->revealed_at)->toBeNull()
        ->and($otherTask->rounds()->whereNotNull('revealed_at')->exists())->toBeFalse();
})->with(['change', 'clear', 're-vote', 'task switch']);

it('ignores a job for a deleted round', function () {
    [$game, , $round] = timedTable(autoReveal: true);
    $roundId = $round->id;
    $round->task->delete();
    Event::fake();

    new RevealPokerRoundOnTimer($roundId, '2026-10-05T10:00:30+00:00')->handle(resolve(AutoRevealPokerRound::class));

    Event::assertNothingDispatched();
});
