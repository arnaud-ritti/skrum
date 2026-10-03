<?php

use App\Models\TeamSurvey;
use Tests\Concurrency\Support\Race;

it('makes one respondent of a member whose first two visits arrive at once', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $userId = teamMember($survey->team)->id;
    $uri = route('surveys.snapshot.show', $survey, false);

    $outcomes = Race::run(array_fill(0, 4, static fn (): int => Race::request($userId, 'GET', $uri)), Race::FirstQuery);

    expect(array_column($outcomes, 'value'))->each->toBe(200)
        ->and($survey->respondents()->where('user_id', $userId)->count())->toBe(1);
});
