<?php

use App\Enums\TeamSurveyQuestionKind;
use App\Events\TeamSurveys\TeamSurveyResponsesChanged;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([TeamSurveyResponsesChanged::class]);
});

function openSurvey(array $attributes = []): array
{
    $survey = TeamSurvey::factory()->open()->create($attributes);
    [$user, $respondent] = surveyMember($survey);

    return [$survey, $user, $respondent];
}

it('saves an answer of each kind and returns it with the counts', function (TeamSurveyQuestionKind $kind, array $attributes, array $options, Closure $body, Closure $expected) {
    [$survey, $user] = openSurvey();
    $question = surveyQuestion($survey, $kind, $attributes, $options);
    $ids = $question->options()->pluck('id')->all();

    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), $body($ids))
        ->assertOk()
        ->assertJsonPath('answer', $expected($ids))
        ->assertJsonPath('progress.responses', 1)
        ->assertJsonPath('progress.completed', 0);

    Event::assertDispatched(fn (TeamSurveyResponsesChanged $event) => $event->responses === 1);
})->with([
    'scale' => [TeamSurveyQuestionKind::Scale, ['allows_comment' => true], [], fn () => ['value' => 4, 'comment' => 'Fine'], fn () => ['value' => 4, 'optionIds' => [], 'text' => null, 'comment' => 'Fine']],
    'nps zero' => [TeamSurveyQuestionKind::Nps, [], [], fn () => ['value' => 0], fn () => ['value' => 0, 'optionIds' => [], 'text' => null, 'comment' => null]],
    'single' => [TeamSurveyQuestionKind::Single, [], ['A', 'B'], fn (array $ids) => ['optionId' => $ids[1]], fn (array $ids) => ['value' => null, 'optionIds' => [$ids[1]], 'text' => null, 'comment' => null]],
    'multiple' => [TeamSurveyQuestionKind::Multiple, [], ['A', 'B', 'C'], fn (array $ids) => ['optionIds' => [$ids[0], $ids[2]]], fn (array $ids) => ['value' => null, 'optionIds' => [$ids[0], $ids[2]], 'text' => null, 'comment' => null]],
    'text' => [TeamSurveyQuestionKind::Text, [], [], fn () => ['text' => 'Less meetings'], fn () => ['value' => null, 'optionIds' => [], 'text' => 'Less meetings', 'comment' => null]],
]);

it('refuses what does not belong to the kind', function (TeamSurveyQuestionKind $kind, array $attributes, array $options, Closure $body, string $field) {
    [$survey, $user] = openSurvey();
    $question = surveyQuestion($survey, $kind, $attributes, $options);
    $foreign = surveyQuestion($survey, TeamSurveyQuestionKind::Single, [], ['X', 'Y'])->options()->pluck('id')->all();

    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), $body($foreign))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    expect(TeamSurveyAnswer::query()->count())->toBe(0);
})->with([
    'scale above its maximum' => [TeamSurveyQuestionKind::Scale, [], [], fn () => ['value' => 6], 'value'],
    'scale at zero' => [TeamSurveyQuestionKind::Scale, [], [], fn () => ['value' => 0], 'value'],
    'health scale above ten' => [TeamSurveyQuestionKind::Scale, ['scale_max' => 10], [], fn () => ['value' => 11], 'value'],
    'nps above ten' => [TeamSurveyQuestionKind::Nps, [], [], fn () => ['value' => 11], 'value'],
    'comment where none is taken' => [TeamSurveyQuestionKind::Scale, [], [], fn () => ['value' => 3, 'comment' => 'x'], 'comment'],
    'option of another question' => [TeamSurveyQuestionKind::Single, [], ['A', 'B'], fn (array $foreign) => ['optionId' => $foreign[0]], 'optionId'],
    'no option ticked' => [TeamSurveyQuestionKind::Multiple, [], ['A', 'B'], fn () => ['optionIds' => []], 'optionIds'],
    'the same option twice' => [TeamSurveyQuestionKind::Multiple, [], ['A', 'B'], fn (array $foreign) => ['optionIds' => [$foreign[0], $foreign[0]]], 'optionIds.0'],
    'empty text' => [TeamSurveyQuestionKind::Text, [], [], fn () => ['text' => ''], 'text'],
    'text too long' => [TeamSurveyQuestionKind::Text, [], [], fn () => ['text' => str_repeat('a', 501)], 'text'],
    'a value on a text' => [TeamSurveyQuestionKind::Text, [], [], fn () => ['text' => 'ok', 'value' => 3], 'value'],
]);

it('keeps one answer when the same one is saved twice, and the last value wins', function () {
    [$survey, $user, $respondent] = openSurvey();
    $question = surveyQuestion($survey);

    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), ['value' => 2])->assertOk();
    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), ['value' => 5])->assertOk();

    expect($respondent->answers()->count())->toBe(1)
        ->and($respondent->answers()->sole()->value)->toBe(5);
});

it('replaces the ticked options of a multiple choice', function () {
    [$survey, $user, $respondent] = openSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Multiple, [], ['A', 'B', 'C']);
    $ids = $question->options()->pluck('id')->all();

    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), ['optionIds' => [$ids[0], $ids[1]]])->assertOk();
    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), ['optionIds' => [$ids[2]]])->assertOk();

    expect($respondent->answers()->sole()->options()->pluck('team_survey_options.id')->all())->toBe([$ids[2]]);
});

it('withdraws an answer', function () {
    [$survey, $user, $respondent] = openSurvey();
    $question = surveyQuestion($survey);
    answerSurveyQuestion($question, $respondent, 3);

    $this->actingAs($user)->deleteJson(route('surveys.answers.destroy', [$survey, $question]))
        ->assertOk()
        ->assertJsonPath('answer', null)
        ->assertJsonPath('progress.responses', 0);
});

it('reopens a finished response when it withdraws a required answer, and keeps it finished for an optional one', function () {
    [$survey, $user, $respondent] = openSurvey();
    $required = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['is_required' => true]);
    $optional = surveyQuestion($survey, TeamSurveyQuestionKind::Text);
    answerSurveyQuestion($required, $respondent, 4);
    answerSurveyQuestion($optional, $respondent, 'hello');
    $respondent->update(['completed_at' => now()]);

    $this->actingAs($user)->deleteJson(route('surveys.answers.destroy', [$survey, $optional]))
        ->assertOk()
        ->assertJsonPath('progress.completed', 1);

    $this->actingAs($user)->deleteJson(route('surveys.answers.destroy', [$survey, $required]))
        ->assertOk()
        ->assertJsonPath('progress.completed', 0);

    expect($respondent->fresh()->completed_at)->toBeNull();
});

it('refuses answers on a draft and on a closed survey', function (string $state) {
    $survey = TeamSurvey::factory()->{$state}()->create();
    [$user] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);

    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), ['value' => 3])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('survey');
})->with(['draft', 'closed']);

it('lets a guest answer', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    $question = surveyQuestion($survey);
    $guest = surveyGuest($survey);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->putJson(route('surveys.answers.update', [$survey, $question]), ['value' => 5])
        ->assertOk();

    expect($guest->answers()->count())->toBe(1);
});

it('finishes a response when every required question is answered, and names the ones that are not', function () {
    [$survey, $user, $respondent] = openSurvey();
    $required = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['is_required' => true]);
    $optional = surveyQuestion($survey, TeamSurveyQuestionKind::Text);
    answerSurveyQuestion($optional, $respondent, 'hello');

    $this->actingAs($user)->postJson(route('surveys.submission.store', $survey))
        ->assertUnprocessable()
        ->assertJsonValidationErrors("questions.{$required->id}");

    answerSurveyQuestion($required, $respondent, 4);

    $this->actingAs($user)->postJson(route('surveys.submission.store', $survey))
        ->assertOk()
        ->assertJsonPath('me.hasSubmitted', true)
        ->assertJsonPath('progress.completed', 1);

    expect($respondent->fresh()->completed_at)->not->toBeNull();
});

it('refuses to finish an empty response', function () {
    [$survey, $user] = openSurvey();
    surveyQuestion($survey);

    $this->actingAs($user)->postJson(route('surveys.submission.store', $survey))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('survey');
});

it('reopens one\'s own response while the survey is open', function () {
    [$survey, $user, $respondent] = openSurvey();
    $respondent->update(['completed_at' => now()]);

    $this->actingAs($user)->deleteJson(route('surveys.submission.destroy', $survey))
        ->assertOk()
        ->assertJsonPath('me.hasSubmitted', false);
});

it('sends each viewer their own answers in the snapshot, and nobody else\'s', function () {
    [$survey, $user, $respondent] = openSurvey();
    [$other, $otherRespondent] = surveyMember($survey);
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text);
    answerSurveyQuestion($question, $respondent, 'mine');
    answerSurveyQuestion($question, $otherRespondent, 'theirs');

    $snapshot = $this->actingAs($user)->getJson(route('surveys.snapshot.show', $survey))->assertOk();

    $snapshot->assertJsonPath('questions.0.myAnswer.text', 'mine')
        ->assertJsonPath('progress.responses', 2)
        ->assertJsonPath('progress.audience', 2);

    expect($snapshot->getContent())->not->toContain('theirs');
});

it('reads the snapshot with as many queries for thirty questions as for one', function () {
    [$survey, $user] = openSurvey();
    surveyQuestion($survey);
    $countQueries = function () use ($survey, $user): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($user)->getJson(route('surveys.snapshot.show', $survey))->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $countQueries();
    $withOne = $countQueries();

    foreach (range(1, 29) as $ignored) {
        surveyQuestion($survey);
    }

    expect($countQueries())->toBe($withOne);
});
