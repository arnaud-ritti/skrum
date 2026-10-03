<?php

use App\Actions\TeamSurveys\SummarizeSurveyQuestion;
use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;

/**
 * @param  array<int, int|string|array<int, int>>  $answers  one per respondent
 * @return array<string, mixed>
 */
function summarized(TeamSurveyQuestion $question, array $answers, ?TeamSurveyRespondent $viewer = null): array
{
    foreach ($answers as $answer) {
        [, $respondent] = surveyMember($question->survey);
        answerSurveyQuestion($question, $respondent, $answer);
    }

    return resolve(SummarizeSurveyQuestion::class)->handle($question, $question->answers()->with('options')->get(), $viewer);
}

it('gives a scale its mean, its most frequent value and one bucket per value', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create());

    $summary = summarized($question, [2, 3, 3, 4, 4, 4, 5, 5, 4]);

    expect($summary['responses'])->toBe(9)
        ->and($summary['mean'])->toBe(3.8)
        ->and($summary['mode'])->toBe(4)
        ->and(array_column($summary['buckets'], 'count'))->toBe([0, 1, 2, 4, 2])
        ->and(array_column($summary['buckets'], 'key'))->toBe(['1', '2', '3', '4', '5']);
});

it('gives a scale of ten its ten buckets', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create(), TeamSurveyQuestionKind::Scale, ['scale_max' => 10]);

    $summary = summarized($question, [8, 6]);

    expect($summary['mean'])->toBe(7.0)
        ->and($summary['buckets'])->toHaveCount(10);
});

it('gives an unanswered scale no mean and no most frequent value', function () {
    $summary = summarized(surveyQuestion(TeamSurvey::factory()->open()->create()), []);

    expect($summary)->toMatchArray(['responses' => 0, 'mean' => null, 'mode' => null]);
});

it('computes the NPS score from detractors and promoters', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create(), TeamSurveyQuestionKind::Nps);

    $summary = summarized($question, [5, 6, 7, 8, 8, 9, 9, 10, 10]);

    expect($summary)->toMatchArray(['responses' => 9, 'detractors' => 2, 'passives' => 3, 'promoters' => 4, 'nps' => 22])
        ->and($summary['buckets'])->toHaveCount(11)
        ->and($summary['buckets'][0])->toBe(['key' => '0', 'label' => '0', 'count' => 0]);
});

it('gives a negative score when detractors outnumber promoters', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create(), TeamSurveyQuestionKind::Nps);

    expect(summarized($question, [0, 3, 10])['nps'])->toBe(-33);
});

it('counts each option, in the question\'s order', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create(), TeamSurveyQuestionKind::Multiple, [], ['Meetings', 'Specs', 'Tests']);

    $summary = summarized($question, [[0, 1], [0], [0, 2]]);

    expect($summary['responses'])->toBe(3)
        ->and(array_column($summary['options'], 'label'))->toBe(['Meetings', 'Specs', 'Tests'])
        ->and(array_column($summary['options'], 'count'))->toBe([3, 1, 1]);
});

it('sorts text answers by text, marks the viewer\'s own and names nobody', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text);
    [, $viewer] = surveyMember($survey);
    answerSurveyQuestion($question, $viewer, 'zebra');

    $summary = summarized($question, ['Apple', 'mango'], $viewer);

    expect(array_column($summary['answers'], 'text'))->toBe(['Apple', 'mango', 'zebra'])
        ->and(array_column($summary['answers'], 'isMine'))->toBe([false, false, true])
        ->and(array_keys($summary['answers'][0]))->toBe(['id', 'text', 'isMine']);
});

it('lists comments without the score they came with', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Nps, ['allows_comment' => true]);
    [, $respondent] = surveyMember($survey);
    answerSurveyQuestion($question, $respondent, 8, 'Friday releases stress me');

    $summary = resolve(SummarizeSurveyQuestion::class)->handle($question, $question->answers()->get());

    expect($summary['comments'])->toHaveCount(1)
        ->and(array_keys($summary['comments'][0]))->toBe(['id', 'text', 'isMine'])
        ->and($summary['comments'][0]['text'])->toBe('Friday releases stress me');
});
