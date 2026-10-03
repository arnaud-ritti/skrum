<?php

use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use Tests\Concurrency\Support\Race;

it('keeps one answer when the same answer is saved twice at once', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey);
    [$user, $respondent] = surveyMember($survey);
    $userId = $user->id;
    $uri = route('surveys.answers.update', [$survey, $question], false);

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'PUT', $uri, ['value' => 2]),
        static fn (): int => Race::request($userId, 'PUT', $uri, ['value' => 5]),
    ]);

    expect(array_column($outcomes, 'value'))->each->toBe(200)
        ->and(TeamSurveyAnswer::query()->where('team_survey_respondent_id', $respondent->id)->count())->toBe(1)
        ->and(TeamSurveyAnswer::query()->where('team_survey_respondent_id', $respondent->id)->sole()->value)->toBeIn([2, 5]);
});

it('saves an answer that arrives while the survey closes either before the close or not at all', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);
    $members = collect(range(1, 4))->map(fn (): string => surveyMember($survey)[0]->id)->all();
    $closer = $facilitator->id;
    $closeUri = route('surveys.status.update', $survey, false);
    $answerUri = route('surveys.answers.update', [$survey, $question], false);

    $contenders = ['close' => static fn (): int => Race::request($closer, 'PUT', $closeUri, ['status' => 'closed'])];

    foreach ($members as $index => $memberId) {
        $contenders["answer{$index}"] = static fn (): int => Race::request($memberId, 'PUT', $answerUri, ['value' => 3]);
    }

    $outcomes = Race::run($contenders);
    $saved = collect($outcomes)->except('close')->filter(fn (array $outcome): bool => $outcome['value'] === 200)->count();
    $refused = collect($outcomes)->except('close')->filter(fn (array $outcome): bool => $outcome['value'] === 422)->count();
    $survey->refresh();

    expect($outcomes['close']['value'])->toBe(204)
        ->and($survey->status)->toBe(TeamSurveyStatus::Closed)
        ->and($saved + $refused)->toBe(4)
        ->and($question->answers()->count())->toBe($saved)
        ->and($question->answers()->where('created_at', '>', $survey->closed_at)->count())->toBe(0);
});

it('refuses the answers that arrive while the survey is closing', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);
    $members = collect(range(1, 3))->map(fn (): string => surveyMember($survey)[0]->id)->all();
    $closer = $facilitator->id;
    $closeUri = route('surveys.status.update', $survey, false);
    $answerUri = route('surveys.answers.update', [$survey, $question], false);
    $closing = Race::signal();

    $contenders = ['close' => static function () use ($closer, $closeUri, $closing): int {
        Race::holdFirstTransaction($closing);

        return Race::request($closer, 'PUT', $closeUri, ['status' => 'closed']);
    }];

    foreach ($members as $index => $memberId) {
        $contenders["answer{$index}"] = static function () use ($memberId, $answerUri, $closing): int {
            Race::awaitHeldTransaction($closing);

            return Race::request($memberId, 'PUT', $answerUri, ['value' => 3]);
        };
    }

    try {
        $outcomes = Race::run($contenders, Race::NoPause);
    } finally {
        @unlink($closing);
    }

    expect($outcomes['close']['value'])->toBe(204)
        ->and(collect($outcomes)->except('close')->pluck('value')->all())->each->toBe(422)
        ->and($question->answers()->count())->toBe(0);
});
