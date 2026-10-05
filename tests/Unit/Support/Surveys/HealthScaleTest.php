<?php

use App\Models\TeamSurveyAnswer;
use App\Support\Surveys\HealthScale;

it('rounds a mean on five once, to one decimal', function () {
    expect(HealthScale::average(3.8))->toBe(3.8)
        ->and(HealthScale::average(11 / 3))->toBe(3.7)
        ->and(HealthScale::averageOf(collect([4, 3, 3])->map(fn (int $value): TeamSurveyAnswer => new TeamSurveyAnswer(['value' => $value]))))->toBe(3.3);
});

it('counts the answers of each value from one to five', function () {
    expect(HealthScale::distribution([4, 2, 4, 5]))->toBe([0, 1, 0, 2, 1])
        ->and(HealthScale::distribution([]))->toBe([0, 0, 0, 0, 0]);
});

it('measures the largest spread on five', function () {
    expect(HealthScale::MaximumSpread)->toBe(2.0);
});

it('reads the bands on five', function (float $score, string $band) {
    expect(HealthScale::band($score))->toBe($band);
})->with([[4.0, 'excellent'], [3.9, 'good'], [3.0, 'good'], [2.9, 'needs_attention'], [2.0, 'needs_attention'], [1.9, 'critical'], [1.0, 'critical']]);
