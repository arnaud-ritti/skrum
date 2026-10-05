<?php

use App\Actions\Retros\ChangeRetroPhase;
use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Exceptions\ModelInvariantViolation;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\TopicNote;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('keeps the behaviour of today on a retro with none of the new values', function () {
    $retro = Retro::factory()->create()->fresh();

    expect($retro->timer_paused_seconds)->toBeNull()
        ->and($retro->topic_seconds)->toBeNull()
        ->and($retro->max_votes_per_card)->toBeNull()
        ->and($retro->roti_revealed_at)->toBeNull()
        ->and($retro->maxVotesPerCard())->toBeNull()
        ->and($retro->votingFinishedIds())->toBeEmpty();
});

it('never puts who is writing in the board snapshot', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['is_anonymous' => true]);
    [, $participant] = retroMember($retro);
    $participant->update(['writing_until' => now()->addSeconds(8)]);

    $snapshot = boardSnapshot($retro, $participant->fresh());

    expect(json_encode($snapshot))->not->toContain('writing_until')
        ->and(json_encode($snapshot))->not->toContain('writingUntil');
});

it('lets the vote limit win over a higher cap per card', function () {
    $retro = Retro::factory()->create(['votes_per_participant' => 3, 'max_votes_per_card' => 5]);

    expect($retro->maxVotesPerCard())->toBe(3);

    $retro->update(['max_votes_per_card' => 2]);

    expect($retro->fresh()->maxVotesPerCard())->toBe(2);
});

it('refuses a timer that both runs and is paused', function () {
    $retro = Retro::factory()->create();

    expect(fn () => $retro->update(['timer_ends_at' => now()->addMinute(), 'timer_paused_seconds' => 30]))
        ->toThrow(ModelInvariantViolation::class);
});

it('keeps one note per topic and deletes it with its card', function () {
    $retro = Retro::factory()->create();
    $card = topicCard($retro);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    expect(fn () => DB::transaction(fn () => TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id])))
        ->toThrow(UniqueConstraintViolationException::class);

    $card->delete();

    expect(TopicNote::query()->count())->toBe(0);
});

it('forgets the topic of an action item whose card is deleted', function () {
    $retro = Retro::factory()->create();
    $card = topicCard($retro);
    $item = ActionItem::factory()->create(['team_id' => $retro->team_id, 'retro_id' => $retro->id, 'card_id' => $card->id]);

    $card->delete();

    expect($item->fresh()->card_id)->toBeNull();
});

it('puts the new values in the board snapshot', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create([
        'timer_paused_seconds' => 90,
        'topic_seconds' => 300,
        'votes_per_participant' => 5,
        'max_votes_per_card' => 2,
    ]);
    [, $participant] = retroMember($retro);
    $participant->update(['voting_finished_at' => now()]);
    $card = topicCard($retro, ['discussed_at' => now()]);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'body' => 'Ship smaller', 'version' => 2]);
    $item = ActionItem::factory()->create(['team_id' => $retro->team_id, 'retro_id' => $retro->id, 'card_id' => $card->id]);

    $snapshot = boardSnapshot($retro, $participant->fresh());

    expect($snapshot['retro'])->toMatchArray([
        'timerPausedSeconds' => 90,
        'topicSeconds' => 300,
        'maxVotesPerCard' => 2,
        'maxVotesPerCardSetting' => 2,
    ])
        ->and($snapshot['voting'])->toBe(['finishedIds' => [$participant->id]])
        ->and(collect($snapshot['cards'])->firstWhere('id', $card->id)['discussedAt'])->toBeString()
        ->and($snapshot['topicNotes'])->toHaveCount(1)
        ->and($snapshot['topicNotes'][0])->toMatchArray(['cardId' => $card->id, 'body' => 'Ship smaller', 'version' => 2])
        ->and(collect($snapshot['actionItems'])->firstWhere('id', $item->id)['cardId'])->toBe($card->id)
        ->and($snapshot['roti'])->toMatchArray(['revealed' => false, 'results' => null]);
});

it('gives the ROTI results once revealed or completed, never before', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [, $participant] = retroMember($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => 4]);
    $snapshot = fn () => boardSnapshot($retro, $participant->fresh());

    expect($snapshot()['roti']['results'])->toBeNull();

    $retro->update(['roti_revealed_at' => now()]);

    expect($snapshot()['roti'])->toMatchArray(['revealed' => true])
        ->and($snapshot()['roti']['results'])->toMatchArray(['average' => 4.0, 'respondents' => 1]);
});

it('sends the paused seconds and the time per topic with the timer', function () {
    $retro = Retro::factory()->create(['timer_paused_seconds' => 42, 'topic_seconds' => 300]);

    expect(TimerChanged::of($retro)->broadcastWith())->toBe([
        'timerEndsAt' => null,
        'timerPausedSeconds' => 42,
        'topicSeconds' => 300,
    ]);
});

it('starts each voting round with nobody finished', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $participant] = retroMember($retro);
    $participant->update(['voting_finished_at' => now()]);

    DB::transaction(fn () => resolve(ChangeRetroPhase::class)->handle(Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail(), RetroPhase::Voting));

    expect($participant->fresh()->voting_finished_at)->toBeNull();
});

it('hides the ROTI again when the phase is entered again', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Actions)->create(['roti_revealed_at' => now()]);

    DB::transaction(fn () => resolve(ChangeRetroPhase::class)->handle(Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail(), RetroPhase::Roti));

    expect($retro->fresh()->roti_revealed_at)->toBeNull();
});

it('hides the ROTI when the facilitator goes back from a revealed ROTI', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create(['roti_revealed_at' => now()]);
    [, $participant] = retroMember($retro);

    DB::transaction(fn () => resolve(ChangeRetroPhase::class)->handle(Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail(), RetroPhase::Actions));

    $snapshot = boardSnapshot($retro, $participant->fresh());

    expect($retro->fresh()->roti_revealed_at)->toBeNull()
        ->and($snapshot['roti']['revealed'])->toBeFalse()
        ->and($snapshot['roti']['results'])->toBeNull();
});

it('clears every timer column when the retro is completed', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create(['timer_paused_seconds' => 60, 'topic_seconds' => 300, 'roti_revealed_at' => now()]);

    DB::transaction(fn () => resolve(ChangeRetroPhase::class)->handle(Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail(), RetroPhase::Completed));

    $completed = $retro->fresh();

    expect($completed->timer_ends_at)->toBeNull()
        ->and($completed->timer_paused_seconds)->toBeNull()
        ->and($completed->topic_seconds)->toBeNull()
        ->and($completed->roti_revealed_at)->not->toBeNull();
});
