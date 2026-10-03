<?php

use App\Actions\Games\RevealHintLetter;
use App\Actions\Games\ScheduleAutoHints;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameHintRevealed;
use App\Jobs\RevealAutoHint;
use App\Models\GameRoom;
use App\Support\Games\GameWordBook;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-27 10:00:00'));
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => 'rocket', 'drawable' => true, 'theme' => 'work']]]));
});

it('spreads the hints over the turn, or gives one every 20 seconds without a time per turn', function () {
    expect(ScheduleAutoHints::interval(null, 3))->toBe(20)
        ->and(ScheduleAutoHints::interval(80, 3))->toBe(20)
        ->and(ScheduleAutoHints::interval(30, 3))->toBe(10)
        ->and(ScheduleAutoHints::interval(180, 2))->toBe(60);
});

it('schedules one job per hint when the room gives hints on its own', function () {
    $room = GameRoom::factory()->game(GameKind::DrawAndGuess)->create(['auto_hints' => true, 'turn_seconds' => 80]);
    [$user] = gameRoomHost($room);
    [, $leader] = gameRoomMember($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $leader->id])
        ->assertCreated()
        ->assertJsonPath('round.hintSeconds', 20);

    Queue::assertPushed(RevealAutoHint::class, 3);
    Queue::assertPushed(RevealAutoHint::class, fn (RevealAutoHint $job) => $job->hint === 3);
});

it('schedules nothing without auto hints, or for hangman', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create(['auto_hints' => true]);
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated()->assertJsonPath('round.hintSeconds', null);

    Queue::assertNotPushed(RevealAutoHint::class);
});

it('reveals a letter when fewer than its number are shown, never beyond half the word, and says so', function () {
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', ['hint_seconds' => 20]);
    $round = $table['round'];

    (new RevealAutoHint($round->id, 1))->handle(resolve(RevealHintLetter::class));
    (new RevealAutoHint($round->id, 1))->handle(resolve(RevealHintLetter::class));

    expect($round->fresh()->revealed_positions)->toHaveCount(1);

    foreach ([2, 3, 4] as $hint) {
        (new RevealAutoHint($round->id, $hint))->handle(resolve(RevealHintLetter::class));
    }

    expect($round->fresh()->revealed_positions)->toHaveCount(3);
    Event::assertDispatchedTimes(GameHintRevealed::class, 3);
});

it('reveals nothing once the round ended', function () {
    $table = wordGuessTable(GameKind::Decoded, 'rocket', ['hint_seconds' => 20]);
    $table['round']->forceFill(['outcome' => GameRoundOutcome::Passed, 'ended_at' => now()])->save();

    (new RevealAutoHint($table['round']->id, 1))->handle(resolve(RevealHintLetter::class));

    expect($table['round']->fresh()->revealed_positions)->toBe([]);
});
