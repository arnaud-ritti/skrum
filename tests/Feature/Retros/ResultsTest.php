<?php

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Survey;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Support\Facades\DB;

function resultsOf(Retro $retro, Participant $viewer): ?array
{
    return resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['results'];
}

function fakeHealthSummary(): array
{
    return [
        'statements' => [['key' => 'vision', 'label' => 'Vision', 'text' => 'The vision is clear', 'isBuiltin' => true, 'average' => 7.5, 'count' => 2]],
        'score' => 7.5,
        'participation' => ['respondents' => 2, 'participants' => 3],
        'topStrength' => null,
        'growthArea' => null,
        'alignment' => ['value' => 9, 'level' => 'high', 'label' => 'High team consensus'],
        'assessment' => ['band' => 'good', 'title' => 'Good', 'sentence' => 'Keep the momentum going.'],
    ];
}

it('only builds results once the retro is completed', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [, $viewer] = retroMember($retro);

    expect(resultsOf($retro, $viewer))->toBeNull();
})->with([RetroPhase::Writing, RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Actions, RetroPhase::Roti]);

it('lists every participant and leaves games and summary empty', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->anonymous()->create();
    [, $viewer] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $results = resultsOf($retro, $viewer);

    expect(collect($results['participants'])->pluck('id')->sort()->values()->all())->toBe(collect([$viewer->id, $guest->id])->sort()->values()->all())
        ->and(collect($results['participants'])->firstWhere('id', $guest->id))->toMatchArray(['name' => $guest->guest_name, 'isGuest' => true])
        ->and($results['games'])->toBeNull()
        ->and($results['summary'])->toBeNull();
});

it('reports the roti distribution and average from the first rating', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 4]);

    expect(resultsOf($retro, $viewer)['roti'])->toBe([
        'distribution' => [
            ['score' => 1, 'count' => 0],
            ['score' => 2, 'count' => 0],
            ['score' => 3, 'count' => 0],
            ['score' => 4, 'count' => 1],
            ['score' => 5, 'count' => 0],
        ],
        'average' => 4.0,
        'respondents' => 1,
    ]);

    RotiVote::factory()->count(2)->create(['retro_id' => $retro->id, 'score' => 5]);

    expect(resultsOf($retro, $viewer)['roti']['average'])->toBe(4.7);
});

it('has no roti average without ratings', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);

    expect(resultsOf($retro, $viewer)['roti'])->toMatchArray(['average' => null, 'respondents' => 0]);
});

it('adds the health summary and the team trend for members', function () {
    $trend = [['retroId' => 'r1', 'title' => 'Retro 1', 'completedAt' => '2026-09-01T10:00:00+00:00', 'score' => 7.5, 'url' => '/retros/r1', 'delta' => null, 'sameStatements' => true]];
    $this->mock(SummarizeHealthCheck::class)->shouldReceive('handle')->andReturn(fakeHealthSummary());
    $this->partialMock(BuildHealthTrend::class, fn ($mock) => $mock->shouldReceive('handle')->andReturn($trend));
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);

    $results = resultsOf($retro, $viewer);

    expect($results['health'])->toBe(fakeHealthSummary())
        ->and($results['healthTrend'])->toBe($trend);
});

it('hides the health trend from guests', function () {
    $this->mock(SummarizeHealthCheck::class)->shouldReceive('handle')->andReturn(fakeHealthSummary());
    $this->partialMock(BuildHealthTrend::class, fn ($mock) => $mock->shouldNotReceive('handle'));
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $results = resultsOf($retro, $guest);

    expect($results['health'])->toBe(fakeHealthSummary())
        ->and($results['healthTrend'])->toBeNull();
});

it('has no health section or trend without health answers', function () {
    $this->mock(SummarizeHealthCheck::class)->shouldReceive('handle')->andReturn(null);
    $this->partialMock(BuildHealthTrend::class, fn ($mock) => $mock->shouldNotReceive('handle'));
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);

    expect(resultsOf($retro, $viewer))->toMatchArray(['health' => null, 'healthTrend' => null]);
});

it('summarises real health answers into statement averages and a score', function () {
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);
    $other = Participant::factory()->create(['retro_id' => $retro->id]);
    answerHealthCheck($retro, $viewer, ['interaction' => 4]);
    answerHealthCheck($retro, $other, ['interaction' => 3]);
    closeHealthCheck($retro);

    $health = resultsOf($retro, $viewer)['health'];
    $interaction = collect($health['statements'])->firstWhere('key', 'interaction');

    expect($interaction)->toMatchArray(['average' => 3.5, 'count' => 2, 'distribution' => [0, 0, 1, 1, 0]])
        ->and($health['score'])->toBe(3.5)
        ->and($health['participation'])->toBe(['respondents' => 2, 'participants' => 2]);
});

it('keeps the query count constant as ratings, participants, surveys and health answers grow', function () {
    warmInstanceSettings();
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id]);
    answerHealthCheck($retro, $viewer, ['vision' => 4]);
    closeHealthCheck($retro);
    Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id]);

    $count = function () use ($retro, $viewer): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        resultsOf($retro, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $few = $count();

    RotiVote::factory()->count(6)->create(['retro_id' => $retro->id]);
    Participant::factory()->count(4)->create(['retro_id' => $retro->id])
        ->each(fn (Participant $participant) => answerHealthCheck($retro, $participant, ['vision' => 3, 'motivation' => 5]));
    Survey::factory()->count(2)->closed()->withOptions()->create(['retro_id' => $retro->id])
        ->each(function (Survey $survey) use ($retro): void {
            $participant = Participant::factory()->create(['retro_id' => $retro->id]);
            answerSurvey($survey, $participant, 0);
        });

    expect($count())->toBe($few);
});

it('reports a duration of fifty minutes for a retro completed fifty minutes after its start', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->started(now()->subMinutes(50))->create(['completed_at' => now()]);
    [, $viewer] = retroMember($retro);

    expect(resultsOf($retro, $viewer)['stats']['durationSeconds'])->toBe(3000);
});

it('reports no duration for a retro without a start time', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    [, $viewer] = retroMember($retro);

    expect(resultsOf($retro, $viewer)['stats']['durationSeconds'])->toBeNull();
});

it('counts the votes cast and the votes available', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['votes_per_participant' => 5]);
    [, $viewer] = retroMember($retro);
    $other = Participant::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $viewer->id]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $viewer->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $other->id]);

    expect(resultsOf($retro, $viewer)['stats'])->toMatchArray(['votesCast' => 4, 'votesAvailable' => 10]);
});

it('reports the people who joined against the people expected', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->withGuestAccess()->create();
    [, $viewer] = retroMember($retro);
    retroMember($retro);
    $retro->team->members()->attach(User::factory()->create());

    expect(resultsOf($retro, $viewer)['stats']['participation'])->toBe(['participants' => 2, 'expected' => 3]);
});

it('counts guests and people outside the team as participants and as expected, so the participation never exceeds the whole', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->withGuestAccess()->create(['votes_per_participant' => 3]);
    [, $viewer] = retroMember($retro);
    retroMember($retro);
    Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    Participant::factory()->create(['retro_id' => $retro->id]);

    $retro->team->members()->attach(User::factory()->create());

    $results = resultsOf($retro, $viewer);

    expect($results['stats']['participation'])->toBe(['participants' => 4, 'expected' => 5])
        ->and($results['participants'])->toHaveCount(4)
        ->and($results['stats']['votesAvailable'])->toBe(12);
});

it('carries the statistics to a guest without the health trend', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $results = resultsOf($retro, $guest);

    expect($results['stats'])->toHaveKeys(['votesCast', 'votesAvailable', 'participation', 'durationSeconds'])
        ->and($results['healthTrend'])->toBeNull();
});

it('hides the previous retro averages and the health trend from a guest', function () {
    $previous = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subWeek()]);
    answerHealthCheck($previous, Participant::factory()->create(['retro_id' => $previous->id]), ['vision' => 3]);
    closeHealthCheck($previous);
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->withGuestAccess()->create(['team_id' => $previous->team_id, 'completed_at' => now()]);
    [, $member] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    answerHealthCheck($retro, $member, ['vision' => 4]);
    closeHealthCheck($retro);

    $memberResults = resultsOf($retro, $member);
    $guestResults = resultsOf($retro, $guest);

    expect(collect($memberResults['health']['statements'])->firstWhere('key', 'vision')['previousAverage'])->toBe(3.0)
        ->and($memberResults['healthTrend'])->toHaveCount(2)
        ->and(collect($guestResults['health']['statements'])->firstWhere('key', 'vision'))->toMatchArray(['average' => 4.0, 'previousAverage' => null])
        ->and(collect($guestResults['health']['statements'])->pluck('previousAverage')->unique()->all())->toBe([null])
        ->and($guestResults['healthTrend'])->toBeNull();
});
