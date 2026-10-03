<?php

use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('remembers the duration started in Discussing as the time per topic', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 300])
        ->assertOk()
        ->assertJsonPath('topicSeconds', 300);

    expect($retro->fresh()->topic_seconds)->toBe(300);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => null])
        ->assertOk()
        ->assertJsonPath('topicSeconds', null);

    expect($retro->fresh()->topic_seconds)->toBeNull();
});

it('leaves the time per topic alone when a timer starts in another phase', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Actions)->create(['topic_seconds' => 300]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertOk();

    expect($retro->fresh()->topic_seconds)->toBe(300);
});

it('restarts the timer for the time per topic when the shared topic changes', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['topic_seconds' => 300, 'timer_paused_seconds' => 12]);
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro);
    $second = topicCard($retro);
    $retro->update(['highlighted_card_id' => $first->id]);
    $expectedEnd = now()->addSeconds(300)->startOfSecond()->toIso8601String();

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $second->id])
        ->assertOk()
        ->assertJsonPath('highlightedCardId', $second->id)
        ->assertJsonPath('timer', ['timerEndsAt' => $expectedEnd, 'timerPausedSeconds' => null, 'topicSeconds' => 300]);

    expect($retro->fresh()->timer_paused_seconds)->toBeNull();
    Event::assertDispatched(fn (TimerChanged $event) => $event->timerEndsAt === $expectedEnd);
});

it('restarts nothing without a time per topic, on a cleared highlight, on the same topic or in Actions', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro);
    $second = topicCard($retro);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $first->id])->assertOk();

    $retro->update(['topic_seconds' => 300]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $first->id])->assertOk();
    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => null])->assertOk();

    $retro->update(['phase' => RetroPhase::Actions]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $second->id])->assertOk();

    Event::assertNotDispatched(TimerChanged::class);
    expect($retro->fresh()->timer_ends_at)->toBeNull();
});
