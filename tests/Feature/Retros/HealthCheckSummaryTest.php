<?php

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Surveys\HealthScale;

/**
 * Scores on ten reproduce the health checks of before plan 19; the summary
 * reads them on the health scale (spec §11.9).
 *
 * @param  array<string, array<int, int|null>>  $scores  statement key => score per participant (null = skipped)
 */
function summarizedRetro(array $scores, int $silentParticipants = 0, ?Retro $retro = null, int $scaleMax = HealthScale::LegacyMax): Retro
{
    $retro ??= Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();

    $respondents = max(array_map(count(...), $scores ?: [[]]));
    $participants = Participant::factory()->count($respondents + $silentParticipants)->create(['retro_id' => $retro->id]);

    for ($index = 0; $index < $respondents; $index++) {
        $own = array_filter(
            array_map(fn (array $statementScores): ?int => $statementScores[$index] ?? null, $scores),
            fn (?int $score): bool => $score !== null,
        );

        if ($own !== []) {
            answerHealthCheck($retro, $participants[$index], $own, $scaleMax);
        }
    }

    closeHealthCheck($retro);

    return $retro->fresh();
}

function healthSummary(Retro $retro): ?array
{
    return resolve(SummarizeHealthCheck::class)->handle($retro);
}

it('reports every answered statement and excludes the others', function () {
    $summary = healthSummary(summarizedRetro(['interaction' => [8, 6], 'task_clarity' => [4]]));
    $statements = collect($summary['statements'])->keyBy('key');

    expect($statements['interaction'])->toMatchArray(['average' => 3.5, 'count' => 2])
        ->and($statements['task_clarity'])->toMatchArray(['average' => 2.0, 'count' => 1, 'label' => 'Clear tasks'])
        ->and($statements['vision'])->toMatchArray(['average' => null, 'count' => 0, 'distribution' => [0, 0, 0, 0, 0]])
        ->and($summary['score'])->toBe(2.8)
        ->and($summary['topStrength'])->toBe(['key' => 'interaction', 'label' => 'Interaction', 'average' => 3.5])
        ->and($summary['growthArea'])->toBe(['key' => 'task_clarity', 'label' => 'Clear tasks', 'average' => 2.0]);
});

it('reports an average from a single answer and no strength or growth area', function () {
    $summary = healthSummary(summarizedRetro(['vision' => [3]]));

    expect(collect($summary['statements'])->firstWhere('key', 'vision')['average'])->toBe(1.5)
        ->and($summary['score'])->toBe(1.5)
        ->and($summary['topStrength'])->toBeNull()
        ->and($summary['growthArea'])->toBeNull();
});

it('gives ties to the earlier statement and nothing when all averages are equal', function () {
    $tied = healthSummary(summarizedRetro(['interaction' => [7], 'task_clarity' => [7], 'vision' => [5], 'processes' => [5]]));
    $equal = healthSummary(summarizedRetro(['interaction' => [6], 'motivation' => [6]]));

    expect($tied['topStrength']['key'])->toBe('interaction')
        ->and($tied['growthArea']['key'])->toBe('vision')
        ->and($equal['topStrength'])->toBeNull()
        ->and($equal['growthArea'])->toBeNull();
});

it('counts participation over every participant of the retro', function () {
    $summary = healthSummary(summarizedRetro(['interaction' => [8, 6], 'vision' => [null, 5]], silentParticipants: 1));

    expect($summary['participation'])->toBe(['respondents' => 2, 'participants' => 3]);
});

it('computes alignment from the population standard deviation', function (array $scores, int $value, string $level, string $label) {
    expect(healthSummary(summarizedRetro($scores))['alignment'])->toBe(['value' => $value, 'level' => $level, 'label' => $label]);
})->with([
    'opposite and unanimous' => [['interaction' => [1, 10], 'vision' => [5, 5]], 5, 'moderate', 'Moderate consensus'],
    'close and unanimous' => [['interaction' => [6, 8], 'vision' => [5, 5]], 9, 'high', 'High team consensus'],
    'opposite only' => [['interaction' => [1, 10]], 0, 'divided', 'Divided opinions'],
    'single answer' => [['interaction' => [4]], 10, 'high', 'High team consensus'],
]);

it('assesses the score by band', function (array $scores, float $score, string $band, string $title) {
    $summary = healthSummary(summarizedRetro($scores));

    expect($summary['score'])->toBe($score)
        ->and($summary['assessment']['band'])->toBe($band)
        ->and($summary['assessment']['title'])->toBe($title);
})->with([
    'four' => [['vision' => [8]], 4.0, 'excellent', 'Excellent'],
    'three point eight' => [['vision' => [8, 7]], 3.8, 'good', 'Good'],
    'three' => [['vision' => [6]], 3.0, 'good', 'Good'],
    'two point eight' => [['vision' => [6, 5]], 2.8, 'needs_attention', 'Needs attention'],
    'two' => [['vision' => [4]], 2.0, 'needs_attention', 'Needs attention'],
    'one point eight' => [['vision' => [4, 3]], 1.8, 'critical', 'Critical'],
]);

it('explains the good band with the spec sentence', function () {
    expect(healthSummary(summarizedRetro(['vision' => [7]]))['assessment']['sentence'])
        ->toBe('Most health scores are above average. Keep the momentum going.');
});

it('summarises nothing when the health check is removed or unanswered', function () {
    $answeredButRemoved = summarizedRetro(['vision' => [7]]);
    resolve(HealthCheckSurvey::class)->forRetro($answeredButRemoved)->update(['status' => TeamSurveyStatus::Draft, 'closed_at' => null]);

    expect(healthSummary($answeredButRemoved->fresh()))->toBeNull()
        ->and(healthSummary(summarizedRetro([])))->toBeNull();
});

it('summarises the frozen set of 3 and of 10 statements', function (int $customs, array $archived, int $expected) {
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();
    $manage = resolve(ManageTeamHealthStatements::class);

    for ($number = 1; $number <= $customs; $number++) {
        $manage->add($retro->team, "Custom {$number}", "Axis {$number}");
    }

    foreach ($archived as $statement) {
        $manage->archive($retro->team, $statement);
    }

    $firstKey = resolve(HealthCheckSurvey::class)->forRetro($retro)->questions()->first()->match_key;

    $summary = healthSummary(summarizedRetro([$firstKey => [6]], retro: $retro));

    expect($summary['statements'])->toHaveCount($expected);
})->with([
    'three' => [0, ['interaction', 'task_clarity', 'manager_support'], 3],
    'ten' => [4, [], 10],
]);

it('labels custom statements as typed', function () {
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();
    $custom = resolve(ManageTeamHealthStatements::class)->add($retro->team, 'We shipped what we promised', 'Delivery');

    $summary = healthSummary(summarizedRetro([$custom->id => [9], 'vision' => [3]], retro: $retro));

    expect($summary['topStrength'])->toBe(['key' => $custom->id, 'label' => 'Delivery', 'average' => 4.5])
        ->and(collect($summary['statements'])->firstWhere('key', $custom->id))->toMatchArray([
            'text' => 'We shipped what we promised',
            'isBuiltin' => false,
        ]);
});

it('summarises a health check answered on five as given', function () {
    $summary = healthSummary(summarizedRetro(['vision' => [4, 5, 3]], scaleMax: HealthScale::Max));
    $vision = collect($summary['statements'])->firstWhere('key', 'vision');

    expect($vision)->toMatchArray(['average' => 4.0, 'count' => 3, 'distribution' => [0, 0, 1, 1, 1]])
        ->and($summary['score'])->toBe(4.0)
        ->and($summary['assessment']['band'])->toBe('excellent');
});

it('averages the one-decimal statement averages into the score', function () {
    $summary = healthSummary(summarizedRetro(['interaction' => [1, 2, 2], 'vision' => [1, 1, 2, 2, 2]], scaleMax: HealthScale::Max));

    expect(collect($summary['statements'])->pluck('average', 'key')->only(['interaction', 'vision'])->all())
        ->toBe(['interaction' => 1.7, 'vision' => 1.6])
        ->and($summary['score'])->toBe(1.7);
});

it('scores a list of one-decimal averages', function () {
    expect(SummarizeHealthCheck::scoreOf([]))->toBeNull()
        ->and(SummarizeHealthCheck::scoreOf([7.0, 4.0]))->toBe(5.5)
        ->and(SummarizeHealthCheck::scoreOf([1.7, 1.6]))->toBe(1.7);
});

it('reports the previous average of a statement present in the previous retro', function () {
    $previous = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subWeek()]);
    summarizedRetro(['vision' => [6, 7], 'interaction' => [4]], retro: $previous);
    $current = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['team_id' => $previous->team_id, 'completed_at' => now()]);

    $statements = collect(healthSummary(summarizedRetro(['vision' => [8], 'task_clarity' => [5]], retro: $current))['statements'])->keyBy('key');

    expect($statements['vision']['previousAverage'])->toBe(3.3)
        ->and($statements['task_clarity']['previousAverage'])->toBeNull()
        ->and($statements['interaction']['previousAverage'])->toBe(2.0);
});

it('uses the retro just before this one and ignores later and other-team retros', function () {
    $older = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subWeeks(2)]);
    summarizedRetro(['vision' => [2]], retro: $older);
    $previous = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['team_id' => $older->team_id, 'completed_at' => now()->subWeek()]);
    summarizedRetro(['vision' => [9]], retro: $previous);
    $later = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['team_id' => $older->team_id, 'completed_at' => now()->addWeek()]);
    summarizedRetro(['vision' => [1]], retro: $later);
    $foreign = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subDay()]);
    summarizedRetro(['vision' => [3]], retro: $foreign);
    $current = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['team_id' => $older->team_id, 'completed_at' => now()]);

    $statements = collect(healthSummary(summarizedRetro(['vision' => [5]], retro: $current))['statements'])->keyBy('key');

    expect($statements['vision']['previousAverage'])->toBe(4.5);
});

it('has no previous average for the first health check of the team', function () {
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);

    $statements = collect(healthSummary(summarizedRetro(['vision' => [5]], retro: $retro))['statements']);

    expect($statements->pluck('previousAverage')->unique()->all())->toBe([null]);
});
