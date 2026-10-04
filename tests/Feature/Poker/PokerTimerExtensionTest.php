<?php

use App\Actions\Poker\AutoRevealPokerRound;
use App\Events\Poker\PokerTimerChanged;
use App\Jobs\RevealPokerRoundOnTimer;
use App\Models\PokerGame;
use App\Models\PokerRound;
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
function extendableTable(?int $secondsLeft = 60): array
{
    $game = PokerGame::factory()->create(['auto_reveal' => true]);
    [$user] = pokerFacilitator($game);
    $round = openPokerRound($game);

    $round->update(['timer_ends_at' => $secondsLeft === null ? null : now()->addSeconds($secondsLeft)]);

    return [$game, $user, $round];
}

it('moves the end of a running timer by two minutes', function () {
    [$game, $user, $round] = extendableTable(60);

    $this->actingAs($user)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => '2026-10-05T10:03:00+00:00']);

    expect($round->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-05T10:03:00+00:00');
});

it('broadcasts the new end to the others', function () {
    [$game, $user, $round] = extendableTable(60);

    $this->actingAs($user)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->assertOk();

    Event::assertDispatched(fn (PokerTimerChanged $event) => $event->broadcastAs() === 'timer.changed'
        && $event->broadcastWith() === ['roundId' => $round->id, 'timerEndsAt' => '2026-10-05T10:03:00+00:00']);
});

it('schedules the reveal job at the new end', function () {
    Queue::fake();
    [$game, $user, $round] = extendableTable(60);

    $this->actingAs($user)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->assertOk();

    Queue::assertPushed(RevealPokerRoundOnTimer::class, fn (RevealPokerRoundOnTimer $job) => $job->roundId === $round->id
        && $job->timerEndsAt === '2026-10-05T10:03:00+00:00'
        && $job->delay instanceof DateTimeInterface
        && CarbonImmutable::instance($job->delay)->equalTo(CarbonImmutable::parse('2026-10-05 10:03:00')));
});

it('lets the job of the old end do nothing and the job of the new end reveal', function () {
    [$game, $user, $round] = extendableTable(60);
    fakePokerRoster(null);
    [, $member] = pokerMember($game);
    pokerVote($round, $member, '5');
    $oldEnd = $round->timer_ends_at->toIso8601String();

    $newEnd = $this->actingAs($user)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->json('timerEndsAt');

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:01:00'));
    (new RevealPokerRoundOnTimer($round->id, $oldEnd))->handle(resolve(AutoRevealPokerRound::class));

    expect($round->fresh()->revealed_at)->toBeNull();

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:03:00'));
    (new RevealPokerRoundOnTimer($round->id, $newEnd))->handle(resolve(AutoRevealPokerRound::class));

    expect($round->fresh()->revealed_at)->not->toBeNull();
});

it('refuses when no timer runs', function (?int $secondsLeft) {
    [$game, $user, $round] = extendableTable($secondsLeft);

    $this->actingAs($user)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');
})->with([
    'no timer' => [null],
    'ended timer' => [-5],
]);

it('refuses when more than one hour would remain', function () {
    [$game, $user, $round] = extendableTable(3600 - 119);

    $this->actingAs($user)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');

    expect($round->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-05T10:58:01+00:00');
});

it('accepts an extension that leaves exactly one hour', function () {
    [$game, $user, $round] = extendableTable(3600 - 120);

    $this->actingAs($user)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->assertOk();
});

it('lets only the facilitator extend the timer', function () {
    [$game, , $round] = extendableTable(60);
    [$memberUser] = pokerMember($game);

    $this->actingAs($memberUser)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->assertForbidden();

    expect($round->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-05T10:01:00+00:00');
});

it('refuses on an ended game', function () {
    [$game, $user, $round] = extendableTable(60);
    $game->update(['ended_at' => now()]);

    $this->actingAs($user)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->assertForbidden();
});

it('refuses on a revealed round', function () {
    [$game, $user, $round] = extendableTable(60);
    $round->update(['revealed_at' => now()]);

    $this->actingAs($user)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Voting is closed for this round.');
});

it('refuses a user who is not a player of the game', function () {
    [$game, , $round] = extendableTable(60);
    $outsider = User::factory()->create();

    $status = $this->actingAs($outsider)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->status();

    expect($status)->toBeIn([403, 404])
        ->and($round->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-05T10:01:00+00:00');
});

it('refuses a round that belongs to another game', function () {
    [$game, $user] = extendableTable(60);
    [, , $roundOfOtherGame] = extendableTable(60);

    $status = $this->actingAs($user)
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $roundOfOtherGame]))
        ->status();

    expect($status)->toBeIn([403, 404, 422])
        ->and($roundOfOtherGame->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-05T10:01:00+00:00');
});

it('refuses a guest', function () {
    [$game, , $round] = extendableTable(60);
    $game->update(['guest_access_enabled' => true]);
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->postJson(route('poker.rounds.timer.extension.store', [$game, $round]))
        ->assertForbidden();

    expect($round->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-05T10:01:00+00:00');
});
