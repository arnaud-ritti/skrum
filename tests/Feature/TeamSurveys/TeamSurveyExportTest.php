<?php

use App\Actions\TeamSurveys\ExportSurveyCsv;
use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurvey;
use App\Models\User;

/**
 * @return array{0: TeamSurvey, 1: User}
 */
function exportableSurvey(string $state = 'closed'): array
{
    $survey = TeamSurvey::factory()->{$state}()->withoutThreshold()->create(['title' => 'Team pulse — sprint 42']);
    [$facilitator] = surveyFacilitator($survey);

    return [$survey, $facilitator];
}

it('writes one row per respondent, one column per question, and no name', function () {
    [$survey] = exportableSurvey();
    $scale = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['label' => 'Workload', 'allows_comment' => true]);
    $multiple = surveyQuestion($survey, TeamSurveyQuestionKind::Multiple, ['label' => 'Blockers'], ['Meetings', 'Specs']);
    $text = surveyQuestion($survey, TeamSurveyQuestionKind::Text, ['label' => 'A word']);
    [$alice, $first] = surveyMember($survey);
    [, $second] = surveyMember($survey);
    surveyMember($survey);

    answerSurveyQuestion($scale, $first, 5, 'calm sprint');
    answerSurveyQuestion($multiple, $first, [0, 1]);
    answerSurveyQuestion($text, $second, 'thanks');
    answerSurveyQuestion($scale, $second, 2);

    $rows = resolve(ExportSurveyCsv::class)->rows($survey);

    expect($rows[0])->toBe(['Respondent', 'Q1 · Workload', 'Q1 · comment', 'Q2 · Blockers', 'Q3 · A word'])
        ->and($rows)->toHaveCount(3)
        ->and($rows[1])->toBe(['Respondent 1', '2', '', '', 'thanks'])
        ->and($rows[2])->toBe(['Respondent 2', '5', 'calm sprint', 'Meetings | Specs', ''])
        ->and(json_encode($rows))->not->toContain($alice->name);
});

it('orders rows by their content, whatever the order of answering', function () {
    [$survey] = exportableSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text, ['label' => 'Word']);

    foreach (['zebra', 'apple', 'mango'] as $word) {
        [, $respondent] = surveyMember($survey);
        answerSurveyQuestion($question, $respondent, $word);
    }

    expect(array_column(array_slice(resolve(ExportSurveyCsv::class)->rows($survey), 1), 1))->toBe(['apple', 'mango', 'zebra']);
});

it('neutralises a cell that a spreadsheet would run as a formula', function (string $text, string $expected) {
    [$survey] = exportableSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text, ['label' => '=Word']);
    [, $respondent] = surveyMember($survey);
    answerSurveyQuestion($question, $respondent, $text);

    $rows = resolve(ExportSurveyCsv::class)->rows($survey);

    expect($rows[1][1])->toBe($expected)
        ->and($rows[0][1])->toBe('Q1 · =Word');
})->with([
    'equals' => ['=HYPERLINK("http://evil.test","x")', '\'=HYPERLINK("http://evil.test","x")'],
    'plus' => ['+1+1', '\'+1+1'],
    'minus' => ['-2+3', '\'-2+3'],
    'at' => ['@SUM(A1)', '\'@SUM(A1)'],
    'tab' => ["\t=1", "'\t=1"],
    'plain' => ['fine = fine', 'fine = fine'],
]);

it('streams the file to an editor of a closed survey', function () {
    [$survey, $facilitator] = exportableSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text, ['label' => 'Word']);
    [, $respondent] = surveyMember($survey);
    answerSurveyQuestion($question, $respondent, 'été');

    $response = $this->actingAs($facilitator)->get(route('surveys.export.show', $survey))->assertOk();

    expect($response->headers->get('content-type'))->toBe('text/csv; charset=UTF-8')
        ->and($response->headers->get('content-disposition'))->toContain('survey-team-pulse-sprint-42-')
        ->and($response->streamedContent())->toStartWith("\u{FEFF}Respondent,")
        ->and($response->streamedContent())->toContain('été');
});

it('refuses the export of an open survey, to a member who is not an editor, and below the threshold', function () {
    [$open, $facilitator] = exportableSurvey('open');
    [$closed] = exportableSurvey();
    $thresholded = TeamSurvey::factory()->closed()->create();
    [$thresholdedFacilitator] = surveyFacilitator($thresholded);

    $this->actingAs($facilitator)->getJson(route('surveys.export.show', $open))->assertUnprocessable()->assertJsonValidationErrors(['survey' => __('Results can be exported once the survey is closed.')]);
    $this->actingAs(teamMember($closed->team))->getJson(route('surveys.export.show', $closed))->assertForbidden();
    $this->actingAs($thresholdedFacilitator)->getJson(route('surveys.export.show', $thresholded))->assertUnprocessable()->assertJsonValidationErrors(['survey' => __('Not enough answers to show results.')]);
});
