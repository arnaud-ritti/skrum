<?php

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use Tests\Concurrency\Support\Race;

it('writes one set of scores when "Submit answers" arrives twice at once', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $survey = attachHealthCheck($retro);
    $userId = $user->id;
    $uri = route('retros.healthCheck.submission.store', $retro, false);
    $scores = ['interaction' => 3, 'task_clarity' => 4, 'manager_support' => 5, 'vision' => 4, 'processes' => 2, 'motivation' => 4];

    $outcomes = Race::run(array_fill(0, 2, static fn (): int => Race::request($userId, 'POST', $uri, ['scores' => $scores])));

    $statuses = array_count_values(array_column($outcomes, 'value'));
    $questionIds = $survey->questions()->pluck('id');

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and($statuses[200] ?? 0)->toBe(1)
        ->and($statuses[422] ?? 0)->toBe(1)
        ->and(TeamSurveyAnswer::query()->whereIn('team_survey_question_id', $questionIds)->count())->toBe(6)
        ->and($survey->respondents()->count())->toBe(1);
});

it('attaches one health check when "Add survey → Health check" arrives twice at once', function () {
    $retro = Retro::factory()->create();
    [$facilitator] = retroFacilitator($retro);
    $userId = $facilitator->id;
    $uri = route('retros.healthCheck.store', $retro, false);

    $outcomes = Race::run(array_fill(0, 2, static fn (): int => Race::request($userId, 'POST', $uri)));

    $statuses = array_count_values(array_column($outcomes, 'value'));

    expect($statuses[201] ?? 0)->toBe(1)
        ->and($statuses[422] ?? 0)->toBe(1)
        ->and(TeamSurvey::query()->where('retro_id', $retro->id)->count())->toBe(1)
        ->and(resolve(HealthCheckSurvey::class)->forRetro($retro))->not->toBeNull();
});
