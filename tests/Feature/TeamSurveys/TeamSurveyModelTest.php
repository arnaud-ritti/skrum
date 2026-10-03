<?php

use App\Enums\HealthStatement;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

it('creates a draft survey with its defaults', function () {
    $survey = TeamSurvey::factory()->create()->fresh();

    expect($survey->status)->toBe(TeamSurveyStatus::Draft)
        ->and($survey->results_threshold)->toBe(3)
        ->and($survey->one_question_at_a_time)->toBeTrue()
        ->and($survey->show_results_after_answer)->toBeTrue()
        ->and($survey->guest_access_enabled)->toBeFalse()
        ->and($survey->version)->toBe(1)
        ->and($survey->toArray())->not->toHaveKey('guest_token');
});

it('orders questions and options by position and deletes them with the survey', function () {
    $survey = TeamSurvey::factory()->create();
    $second = surveyQuestion($survey, TeamSurveyQuestionKind::Single, ['position' => 1], ['B', 'A']);
    $first = surveyQuestion($survey, TeamSurveyQuestionKind::Nps, ['position' => 0]);

    expect($survey->questions->pluck('id')->all())->toBe([$first->id, $second->id])
        ->and($second->options->pluck('label')->all())->toBe(['B', 'A']);

    $survey->delete();

    expect(TeamSurveyQuestion::query()->count())->toBe(0)
        ->and(DB::table('team_survey_options')->count())->toBe(0);
});

it('gives an answer a random id, not a time-ordered one', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create());
    [, $respondent] = surveyMember($question->survey);

    $answer = answerSurveyQuestion($question, $respondent, 4);

    expect($answer->id[14])->toBe('4');
});

it('refuses two answers of one respondent to one question', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create());
    [, $respondent] = surveyMember($question->survey);
    answerSurveyQuestion($question, $respondent, 4);

    expect(fn () => DB::transaction(fn () => TeamSurveyAnswer::factory()->create([
        'team_survey_question_id' => $question->id,
        'team_survey_respondent_id' => $respondent->id,
        'value' => 2,
    ])))->toThrow(UniqueConstraintViolationException::class);
});

it('translates a built-in statement for each reader and keeps a custom one as written', function () {
    $survey = TeamSurvey::factory()->healthCheck()->create();
    $builtin = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['builtin' => HealthStatement::Vision, 'label' => 'stored text']);
    $custom = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['label' => 'We ship without fear', 'short_label' => 'Shipping']);

    expect($builtin->displayLabel())->toBe(HealthStatement::Vision->text())
        ->and($builtin->displayShortLabel())->toBe(HealthStatement::Vision->label())
        ->and($custom->displayLabel())->toBe('We ship without fear')
        ->and($custom->displayShortLabel())->toBe('Shipping');
});

it('names its editors: the facilitator and the workspace managers', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [, $facilitator] = surveyFacilitator($survey);
    [, $member] = surveyMember($survey);
    $manager = workspaceManager($survey->team->workspace);
    $managerRespondent = TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $manager->id]);

    expect($survey->fresh()->isEditor($facilitator))->toBeTrue()
        ->and($survey->isEditor($managerRespondent))->toBeTrue()
        ->and($survey->isEditor($member))->toBeFalse()
        ->and($survey->isEditor(surveyGuest($survey)))->toBeFalse();
});

it('says who may see results', function (string $state, string $viewer, bool $expected) {
    $survey = TeamSurvey::factory()->{$state}()->create();
    [, $facilitator] = surveyFacilitator($survey);
    [, $member] = surveyMember($survey);
    [, $finished] = surveyMember($survey);
    $finished->update(['completed_at' => now()]);

    $respondent = ['facilitator' => $facilitator, 'member' => $member, 'finished' => $finished][$viewer];

    expect($survey->fresh()->resultsVisibleTo($respondent->fresh()))->toBe($expected);
})->with([
    'draft, editor' => ['draft', 'facilitator', false],
    'open, editor' => ['open', 'facilitator', true],
    'open, member who has not finished' => ['open', 'member', false],
    'open, member who has finished' => ['open', 'finished', true],
    'closed, any member' => ['closed', 'member', true],
]);

it('hides results from a finished member when the setting is off', function () {
    $survey = TeamSurvey::factory()->open()->create(['show_results_after_answer' => false]);
    [, $finished] = surveyMember($survey);
    $finished->update(['completed_at' => now()]);

    expect($survey->resultsVisibleTo($finished))->toBeFalse();
});

it('counts respondents who answered, not the ones who only opened the page', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey);
    [, $answered] = surveyMember($survey);
    surveyMember($survey);
    answerSurveyQuestion($question, $answered, 3);

    expect($survey->responseCount())->toBe(1)
        ->and($survey->hasAnswers())->toBeTrue();
});

it('counts as its audience the team\'s members and the respondents who are not members, guests included', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    surveyMember($survey);
    teamMember($survey->team);
    surveyGuest($survey);
    $manager = workspaceManager($survey->team->workspace);
    TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $manager->id]);

    expect($survey->fresh()->audienceCount())->toBe(4);
});
