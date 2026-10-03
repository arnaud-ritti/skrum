<?php

use App\Actions\TeamSurveys\PresentSurveyQuestion;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyTemplate;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\TeamSurvey;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([TeamSurveyChanged::class]);
});

function draftSurvey(array $attributes = []): array
{
    $survey = TeamSurvey::factory()->create($attributes);
    [$facilitator] = surveyFacilitator($survey);

    return [$survey, $facilitator];
}

it('saves the title and the three settings, and bumps the version', function () {
    [$survey, $facilitator] = draftSurvey();

    $this->actingAs($facilitator)->patchJson(route('surveys.update', $survey), [
        'title' => 'Team pulse — sprint 42',
        'one_question_at_a_time' => false,
        'show_results_after_answer' => false,
        'guest_access_enabled' => true,
    ])->assertOk()->assertJsonPath('survey.title', 'Team pulse — sprint 42')->assertJsonPath('survey.version', 2);

    expect($survey->fresh())
        ->one_question_at_a_time->toBeFalse()
        ->show_results_after_answer->toBeFalse()
        ->guest_access_enabled->toBeTrue();
    Event::assertDispatched(fn (TeamSurveyChanged $event) => $event->version === 2);
});

it('adds a question of each kind at the end', function (string $kind, array $body, ?int $scaleMax, int $options) {
    [$survey, $facilitator] = draftSurvey();
    surveyQuestion($survey);

    $this->actingAs($facilitator)->postJson(route('surveys.questions.store', $survey), ['kind' => $kind, 'label' => 'Q', ...$body])
        ->assertCreated()
        ->assertJsonPath('question.kind', $kind)
        ->assertJsonPath('question.position', 2)
        ->assertJsonPath('question.scaleMax', $scaleMax)
        ->assertJsonCount($options, 'question.options');

    expect($survey->questions()->count())->toBe(2)
        ->and($survey->questions()->get()->last()->match_key)->not->toBeNull();
})->with([
    'scale' => ['scale', ['scale_min_label' => 'Low', 'scale_max_label' => 'High', 'options' => []], 5, 0],
    'nps' => ['nps', ['options' => []], null, 0],
    'single' => ['single', ['options' => ['A', 'B']], null, 2],
    'multiple' => ['multiple', ['options' => ['A', 'B', 'C']], null, 3],
    'text' => ['text', ['options' => []], null, 0],
]);

it('validates a question by kind', function (array $body, string $field) {
    [$survey, $facilitator] = draftSurvey();

    $this->actingAs($facilitator)->postJson(route('surveys.questions.store', $survey), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no label' => [['kind' => 'text', 'label' => '', 'options' => []], 'label'],
    'label too long' => [['kind' => 'text', 'label' => str_repeat('a', 201), 'options' => []], 'label'],
    'unknown kind' => [['kind' => 'ranking', 'label' => 'Q', 'options' => []], 'kind'],
    'one option' => [['kind' => 'single', 'label' => 'Q', 'options' => ['A']], 'options'],
    'eleven options' => [['kind' => 'multiple', 'label' => 'Q', 'options' => array_map(fn (int $i) => "O{$i}", range(1, 11))], 'options'],
    'empty option' => [['kind' => 'single', 'label' => 'Q', 'options' => ['A', '']], 'options.1'],
    'options on a text' => [['kind' => 'text', 'label' => 'Q', 'options' => ['A', 'B']], 'options'],
    'end labels on an NPS' => [['kind' => 'nps', 'label' => 'Q', 'options' => [], 'scale_min_label' => 'Low'], 'scale_min_label'],
]);

it('refuses a thirty-first question', function () {
    [$survey, $facilitator] = draftSurvey();

    foreach (range(1, 30) as $ignored) {
        surveyQuestion($survey);
    }

    $this->actingAs($facilitator)->postJson(route('surveys.questions.store', $survey), ['kind' => 'text', 'label' => 'Q', 'options' => []])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('survey');
});

it('edits a question and replaces its options', function () {
    [$survey, $facilitator] = draftSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Single, [], ['A', 'B']);

    $this->actingAs($facilitator)->patchJson(route('surveys.questions.update', [$survey, $question]), [
        'kind' => 'multiple', 'label' => 'Which ones?', 'is_required' => true, 'options' => ['X', 'Y', 'Z'],
    ])->assertOk()->assertJsonPath('question.isRequired', true)->assertJsonPath('question.options.2.label', 'Z');

    expect($question->fresh()->kind)->toBe(TeamSurveyQuestionKind::Multiple)
        ->and($question->options()->count())->toBe(3);
});

it('deletes a question and closes the gap in positions', function () {
    [$survey, $facilitator] = draftSurvey();
    $first = surveyQuestion($survey);
    $second = surveyQuestion($survey);
    $third = surveyQuestion($survey);

    $this->actingAs($facilitator)->deleteJson(route('surveys.questions.destroy', [$survey, $second]))->assertNoContent();

    expect($survey->questions()->pluck('position', 'id')->all())->toBe([$first->id => 0, $third->id => 1]);
});

it('reorders questions and refuses a list that is not every question once', function () {
    [$survey, $facilitator] = draftSurvey();
    $first = surveyQuestion($survey);
    $second = surveyQuestion($survey);

    $this->actingAs($facilitator)->putJson(route('surveys.questionOrder.update', $survey), ['ids' => [$second->id, $first->id]])->assertNoContent();

    expect($survey->questions()->pluck('id')->all())->toBe([$second->id, $first->id]);

    $this->actingAs($facilitator)->putJson(route('surveys.questionOrder.update', $survey), ['ids' => [$second->id]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ids');
});

it('duplicates a question right after its source, with its options and a key of its own', function () {
    [$survey, $facilitator] = draftSurvey();
    $source = surveyQuestion($survey, TeamSurveyQuestionKind::Single, ['match_key' => 'source-key'], ['A', 'B']);
    $after = surveyQuestion($survey);

    $copyId = $this->actingAs($facilitator)->postJson(route('surveys.questions.duplicate.store', [$survey, $source]))
        ->assertCreated()
        ->json('question.id');

    expect($survey->questions()->pluck('id')->all())->toBe([$source->id, $copyId, $after->id])
        ->and($survey->questions()->find($copyId)->options()->pluck('label')->all())->toBe(['A', 'B'])
        ->and($survey->questions()->find($copyId)->match_key)->not->toBe('source-key');
});

it('refuses every write of the builder to a member who is not an editor', function () {
    [$survey] = draftSurvey();
    $question = surveyQuestion($survey);
    $member = teamMember($survey->team);

    $this->actingAs($member)->patchJson(route('surveys.update', $survey), ['title' => 'x'])->assertForbidden();
    $this->actingAs($member)->postJson(route('surveys.questions.store', $survey), ['kind' => 'text', 'label' => 'Q', 'options' => []])->assertForbidden();
    $this->actingAs($member)->patchJson(route('surveys.questions.update', [$survey, $question]), ['kind' => 'text', 'label' => 'Q', 'options' => []])->assertForbidden();
    $this->actingAs($member)->deleteJson(route('surveys.questions.destroy', [$survey, $question]))->assertForbidden();
    $this->actingAs($member)->putJson(route('surveys.questionOrder.update', $survey), ['ids' => [$question->id]])->assertForbidden();
    $this->actingAs($member)->postJson(route('surveys.questions.duplicate.store', [$survey, $question]))->assertForbidden();
});

it('locks the questions of an open survey and of a health check, and still saves settings', function (Closure $make) {
    $survey = $make();
    [$facilitator] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);

    $this->actingAs($facilitator)->postJson(route('surveys.questions.store', $survey), ['kind' => 'text', 'label' => 'Q', 'options' => []])
        ->assertUnprocessable()->assertJsonValidationErrors('survey');
    $this->actingAs($facilitator)->deleteJson(route('surveys.questions.destroy', [$survey, $question]))->assertUnprocessable();
    $this->actingAs($facilitator)->patchJson(route('surveys.update', $survey), ['title' => 'Renamed'])->assertOk();
})->with([
    'open' => [fn () => TeamSurvey::factory()->open()->create()],
    'health check draft' => [fn () => TeamSurvey::factory()->healthCheck()->create()],
]);

it('does not find a question of another survey', function () {
    [$survey, $facilitator] = draftSurvey();
    $foreign = surveyQuestion(TeamSurvey::factory()->create());

    $this->actingAs($facilitator)->deleteJson(route('surveys.questions.destroy', [$survey, $foreign]))->assertNotFound();
});

it('gives the questions of a health check the ends of the mockup, in the reader\'s language', function () {
    [$survey] = draftSurvey(['template' => TeamSurveyTemplate::HealthCheck]);
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['scale_min_label' => null, 'scale_max_label' => null]);

    expect(resolve(PresentSurveyQuestion::class)->handle($question)['scaleLabels'])->toBe(['Strongly disagree', 'Strongly agree']);

    app()->setLocale('fr');

    expect(resolve(PresentSurveyQuestion::class)->handle($question->fresh())['scaleLabels'])->toBe(['Pas du tout d\'accord', 'Tout à fait d\'accord']);
});

it('gives the questions of another survey their own ends', function () {
    [$survey] = draftSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['scale_min_label' => 'Low', 'scale_max_label' => 'High']);

    expect(resolve(PresentSurveyQuestion::class)->handle($question)['scaleLabels'])->toBe(['Low', 'High']);
});
