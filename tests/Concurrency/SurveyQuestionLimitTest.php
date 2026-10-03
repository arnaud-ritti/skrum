<?php

use App\Models\TeamSurvey;
use Tests\Concurrency\Support\Race;

it('never gives a survey more than thirty questions when additions arrive at once', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    foreach (range(1, 28) as $ignored) {
        surveyQuestion($survey);
    }

    $userId = $facilitator->id;
    $uri = route('surveys.questions.store', $survey, false);

    $outcomes = Race::run(array_fill(0, 4, static fn (): int => Race::request($userId, 'POST', $uri, ['kind' => 'text', 'label' => 'Q', 'options' => []])));

    $statuses = array_count_values(array_column($outcomes, 'value'));

    expect($survey->questions()->count())->toBe(30)
        ->and($statuses[201] ?? 0)->toBe(2)
        ->and($statuses[422] ?? 0)->toBe(2);
});
