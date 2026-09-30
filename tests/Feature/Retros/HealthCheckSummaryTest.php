<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Enums\RetroPhase;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;

/**
 * @param  array<string, array<int, int|null>>  $scores  statement key => score per participant (null = skipped)
 */
function summarizedRetro(array $scores, int $silentParticipants = 0, ?Retro $retro = null): Retro
{
    $retro ??= Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();

    if (! $retro->healthStatements()->exists()) {
        app(FreezeHealthStatements::class)->handle($retro);
    }

    $respondents = max(array_map('count', $scores ?: [[]]));
    $participants = Participant::factory()->count($respondents + $silentParticipants)->create(['retro_id' => $retro->id]);

    foreach ($scores as $statement => $statementScores) {
        foreach ($statementScores as $index => $score) {
            if ($score === null) {
                continue;
            }

            HealthCheckAnswer::factory()->create([
                'retro_id' => $retro->id,
                'participant_id' => $participants[$index]->id,
                'statement' => $statement,
                'score' => $score,
            ]);
        }
    }

    return $retro->fresh();
}

function healthSummary(Retro $retro): ?array
{
    return app(SummarizeHealthCheck::class)->handle($retro);
}

it('reports every answered statement and excludes the others', function () {
    $summary = healthSummary(summarizedRetro(['interaction' => [8, 6], 'task_clarity' => [4]]));
    $statements = collect($summary['statements'])->keyBy('key');

    expect($statements['interaction'])->toMatchArray(['average' => 7.0, 'count' => 2])
        ->and($statements['task_clarity'])->toMatchArray(['average' => 4.0, 'count' => 1, 'label' => 'Clear tasks'])
        ->and($statements['vision'])->toMatchArray(['average' => null, 'count' => 0])
        ->and($summary['score'])->toBe(5.5)
        ->and($summary['topStrength'])->toBe(['key' => 'interaction', 'label' => 'Interaction', 'average' => 7.0])
        ->and($summary['growthArea'])->toBe(['key' => 'task_clarity', 'label' => 'Clear tasks', 'average' => 4.0]);
});

it('reports an average from a single answer and no strength or growth area', function () {
    $summary = healthSummary(summarizedRetro(['vision' => [3]]));

    expect(collect($summary['statements'])->firstWhere('key', 'vision')['average'])->toBe(3.0)
        ->and($summary['score'])->toBe(3.0)
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
    'eight' => [['vision' => [8]], 8.0, 'excellent', 'Excellent'],
    'seven and a half' => [['vision' => [8, 7]], 7.5, 'good', 'Good'],
    'six' => [['vision' => [6]], 6.0, 'good', 'Good'],
    'five and a half' => [['vision' => [6, 5]], 5.5, 'needs_attention', 'Needs attention'],
    'four' => [['vision' => [4]], 4.0, 'needs_attention', 'Needs attention'],
    'three and a half' => [['vision' => [4, 3]], 3.5, 'critical', 'Critical'],
]);

it('explains the good band with the spec sentence', function () {
    expect(healthSummary(summarizedRetro(['vision' => [7]]))['assessment']['sentence'])
        ->toBe('Most health scores are above average. Keep the momentum going.');
});

it('summarises nothing when the health check is off or unanswered', function () {
    $answeredButOff = summarizedRetro(['vision' => [7]]);
    $answeredButOff->update(['health_check_enabled' => false]);

    expect(healthSummary($answeredButOff->fresh()))->toBeNull()
        ->and(healthSummary(summarizedRetro([])))->toBeNull();
});

it('summarises the frozen set of 3 and of 10 statements', function (int $customs, array $archived, int $expected) {
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();
    $manage = app(ManageTeamHealthStatements::class);

    for ($number = 1; $number <= $customs; $number++) {
        $manage->add($retro->team, "Custom {$number}", "Axis {$number}");
    }

    foreach ($archived as $statement) {
        $manage->archive($retro->team, $statement);
    }

    app(FreezeHealthStatements::class)->handle($retro);

    $summary = healthSummary(summarizedRetro([$retro->healthStatements()->first()->key => [6]], retro: $retro));

    expect($summary['statements'])->toHaveCount($expected);
})->with([
    'three' => [0, ['interaction', 'task_clarity', 'manager_support'], 3],
    'ten' => [4, [], 10],
]);

it('labels custom statements as typed', function () {
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();
    $custom = app(ManageTeamHealthStatements::class)->add($retro->team, 'We shipped what we promised', 'Delivery');
    app(FreezeHealthStatements::class)->handle($retro);

    $summary = healthSummary(summarizedRetro([$custom->id => [9], 'vision' => [3]], retro: $retro));

    expect($summary['topStrength'])->toBe(['key' => $custom->id, 'label' => 'Delivery', 'average' => 9.0])
        ->and(collect($summary['statements'])->firstWhere('key', $custom->id))->toMatchArray([
            'text' => 'We shipped what we promised',
            'isBuiltin' => false,
        ]);
});

it('averages the one-decimal statement averages into the score', function () {
    $summary = healthSummary(summarizedRetro(['interaction' => [1, 2, 2], 'vision' => [1, 1, 2, 2, 2]]));

    expect(collect($summary['statements'])->pluck('average', 'key')->only(['interaction', 'vision'])->all())
        ->toBe(['interaction' => 1.7, 'vision' => 1.6])
        ->and($summary['score'])->toBe(1.7);
});

it('scores a list of one-decimal averages', function () {
    expect(SummarizeHealthCheck::scoreOf([]))->toBeNull()
        ->and(SummarizeHealthCheck::scoreOf([7.0, 4.0]))->toBe(5.5)
        ->and(SummarizeHealthCheck::scoreOf([1.7, 1.6]))->toBe(1.7);
});
