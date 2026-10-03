<?php

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Teams\BuildTeamMoodTrend;
use App\Models\TeamSurvey;
use App\Support\Surveys\ImportHealthChecks;

beforeEach(function () {
    $this->history = healthHistory();

    resolve(ImportHealthChecks::class)->handle();
});

it('summarises an imported health check on the health scale, each statement read halved', function () {
    $summary = resolve(SummarizeHealthCheck::class)->handle($this->history['sprint41']);
    $statements = collect($summary['statements'])->keyBy('key');

    expect(array_keys($summary))->toBe(['statements', 'score', 'participation', 'topStrength', 'growthArea', 'alignment', 'assessment'])
        ->and(array_keys($summary['statements'][0]))->toBe(['key', 'label', 'text', 'isBuiltin', 'average', 'count', 'consensus', 'previousAverage', 'distribution'])
        ->and($statements['interaction'])->toMatchArray(['label' => 'Interaction', 'isBuiltin' => true, 'average' => 3.5, 'count' => 3, 'previousAverage' => 2.5, 'distribution' => [0, 0, 1, 2, 0]])
        ->and($statements['vision'])->toMatchArray(['average' => 4.0, 'count' => 2, 'previousAverage' => 2.5, 'distribution' => [0, 0, 1, 0, 1]])
        ->and($statements[$this->history['custom']])->toMatchArray(['label' => 'Shipping', 'text' => 'We ship without fear', 'isBuiltin' => false, 'average' => 2.0, 'count' => 1, 'previousAverage' => null, 'distribution' => [0, 1, 0, 0, 0]])
        ->and($summary['score'])->toBe(3.2)
        ->and($summary['participation'])->toBe(['respondents' => 3, 'participants' => 3])
        ->and($summary['topStrength'])->toBe(['key' => 'vision', 'label' => 'Vision', 'average' => 4.0])
        ->and($summary['growthArea'])->toBe(['key' => $this->history['custom'], 'label' => 'Shipping', 'average' => 2.0])
        ->and($summary['alignment']['value'])->toBe(8)
        ->and($summary['assessment']['band'])->toBe('good');
});

it('keeps the consensus of a statement as it was, computed on the scale of its answers', function () {
    $summary = resolve(SummarizeHealthCheck::class)->handle($this->history['sprint41']);
    $vision = collect($summary['statements'])->firstWhere('key', 'vision');

    expect(round($vision['consensus'], 2))->toBe(5.56);
});

it('summarises nothing for a retro whose health check was turned off, completed without an answer, or never existed', function () {
    $summarize = resolve(SummarizeHealthCheck::class);

    expect($summarize->handle($this->history['completedUnanswered']))->toBeNull()
        ->and($summarize->handle($this->history['never']))->toBeNull()
        ->and($summarize->handle($this->history['turnedOff']))->toBeNull();
});

it('withholds the previous averages from a guest', function () {
    $summary = resolve(SummarizeHealthCheck::class)->handle($this->history['sprint41'], $this->history['guest']);

    expect(collect($summary['statements'])->pluck('previousAverage')->filter()->all())->toBe([]);
});

it('lists the imported health checks in the trend, oldest first, with their deltas on the health scale', function () {
    $trend = resolve(BuildHealthTrend::class)->handle($this->history['sprint41']);

    expect($trend)->toHaveCount(2)
        ->and($trend[0])->toMatchArray([
            'retroId' => $this->history['sprint40']->id,
            'title' => 'Sprint 40',
            'score' => 2.5,
            'delta' => null,
            'sameStatements' => true,
            'url' => route('retros.show', $this->history['sprint40']->id),
        ])
        ->and($trend[1])->toMatchArray(['retroId' => $this->history['sprint41']->id, 'score' => 3.2, 'delta' => 0.7, 'sameStatements' => false])
        ->and($trend[1]['completedAt'])->toBe($this->history['sprint41']->completed_at->toIso8601String());
});

it('gives the team mood trend the same points on the health scale, and adds a health check run as a survey on five', function () {
    $before = resolve(BuildTeamMoodTrend::class)->handle($this->history['team']);

    expect(array_column($before, 'retroId'))->toBe([$this->history['sprint40']->id, $this->history['sprint41']->id])
        ->and($before[0]['mood'])->toBe(2.5)
        ->and($before[1])->toMatchArray(['title' => 'Sprint 41', 'mood' => 3.2, 'moodVoters' => 3, 'roti' => null, 'rotiVoters' => 0]);

    $standalone = TeamSurvey::factory()->healthCheck()->closed()->create([
        'team_id' => $this->history['team']->id, 'title' => 'Health check — October', 'closed_at' => '2026-10-05 10:00:00',
    ]);
    [, $respondent] = surveyMember($standalone);
    answerSurveyQuestion(surveyQuestion($standalone, attributes: ['match_key' => 'vision', 'scale_max' => 5]), $respondent, 4);

    $after = resolve(BuildTeamMoodTrend::class)->handle($this->history['team']);

    expect($after)->toHaveCount(3)
        ->and($after[2])->toMatchArray([
            'retroId' => null,
            'surveyId' => $standalone->id,
            'title' => 'Health check — October',
            'mood' => 4.0,
            'moodVoters' => 1,
            'roti' => null,
            'url' => route('surveys.results.show', $standalone),
        ]);
});

it('gives a statement the average of the previous closed health check, whatever its kind of session and its scale', function () {
    $standalone = TeamSurvey::factory()->healthCheck()->closed()->create([
        'team_id' => $this->history['team']->id, 'closed_at' => '2026-09-01 10:00:00',
    ]);
    [, $respondent] = surveyMember($standalone);
    answerSurveyQuestion(surveyQuestion($standalone, attributes: ['match_key' => 'vision', 'scale_max' => 5]), $respondent, 1);

    $summary = resolve(SummarizeHealthCheck::class)->handle($this->history['sprint41']);
    $statements = collect($summary['statements'])->keyBy('key');

    expect($statements['vision']['previousAverage'])->toBe(1.0)
        ->and($statements['interaction']['previousAverage'])->toBeNull();
});
