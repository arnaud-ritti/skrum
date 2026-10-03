<?php

use App\Enums\RetroPhase;
use App\Events\Retros\SurveyChanged;
use App\Events\Retros\SurveyDeleted;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
use App\Models\SurveyResponse;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function surveyingRetro(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $facilitator] = retroFacilitator($retro);

    return [$retro, $user, $facilitator];
}

it('lets the facilitator create a single choice survey', function () {
    [$retro, $user, $facilitator] = surveyingRetro();

    $response = $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), [
        'question' => 'How was the sprint?',
        'description' => 'Be honest',
        'options' => ['Great', 'Fine', 'Rough'],
    ])->assertCreated()
        ->assertJsonPath('survey.kind', 'single')
        ->assertJsonPath('survey.question', 'How was the sprint?')
        ->assertJsonPath('survey.description', 'Be honest')
        ->assertJsonPath('survey.showVoters', false)
        ->assertJsonPath('survey.resultsVisible', false)
        ->assertJsonPath('survey.options.2.label', 'Rough');

    $survey = Survey::findOrFail($response->json('survey.id'));

    expect($survey->created_by_participant_id)->toBe($facilitator->id)
        ->and($survey->position)->toBe(0);
    Event::assertDispatched(fn (SurveyChanged $event) => $event->broadcastAs() === 'survey.changed'
        && $event->broadcastWith() === ['surveyId' => $survey->id, 'version' => 1, 'responseCount' => 0]);
});

it('creates multiple choice and free-text surveys', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Voting);

    $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), ['kind' => 'multiple', 'question' => 'Which?', 'options' => ['A', 'B']])
        ->assertCreated()
        ->assertJsonPath('survey.kind', 'multiple');
    $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), ['kind' => 'text', 'question' => 'Why?', 'options' => []])
        ->assertCreated()
        ->assertJsonPath('survey.kind', 'text')
        ->assertJsonPath('survey.options', [])
        ->assertJsonPath('survey.position', 1);
});

it('validates questions and options by kind', function (array $body, string $field) {
    [$retro, $user] = surveyingRetro();

    $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no question' => [['question' => '', 'options' => ['A', 'B']], 'question'],
    'question too long' => [['question' => str_repeat('a', 201), 'options' => ['A', 'B']], 'question'],
    'description too long' => [['question' => 'Q', 'description' => str_repeat('a', 501), 'options' => ['A', 'B']], 'description'],
    'one option' => [['question' => 'Q', 'options' => ['A']], 'options'],
    'eleven options' => [['question' => 'Q', 'options' => array_map(fn (int $i) => "Option {$i}", range(1, 11))], 'options'],
    'empty option' => [['question' => 'Q', 'options' => ['A', '']], 'options.1'],
    'option too long' => [['question' => 'Q', 'options' => ['A', str_repeat('b', 101)]], 'options.1'],
    'text with options' => [['kind' => 'text', 'question' => 'Q', 'options' => ['A', 'B']], 'options'],
    'unknown kind' => [['kind' => 'ranking', 'question' => 'Q', 'options' => ['A', 'B']], 'kind'],
]);

it('refuses an eleventh survey', function () {
    [$retro, $user] = surveyingRetro();
    Survey::factory()->count(10)->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), ['question' => 'Q', 'options' => ['A', 'B']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['survey' => 'A retrospective can have at most 10 surveys.']);
});

it('keeps survey management to the facilitator in the board phases', function (RetroPhase $phase, array $attributes, bool $asFacilitator, int $status) {
    [$retro, $user] = surveyingRetro($phase, $attributes);
    [$member] = retroMember($retro);

    $this->actingAs($asFacilitator ? $user : $member)
        ->postJson(route('retros.surveys.store', $retro), ['question' => 'Q', 'options' => ['A', 'B']])
        ->assertStatus($status);
})->with([
    'member' => [RetroPhase::Writing, [], false, 403],
    'icebreaker' => [RetroPhase::Icebreaker, [], true, 403],
    'completed' => [RetroPhase::Completed, [], true, 403],
    'locked' => [RetroPhase::Discussing, ['is_locked' => true], true, 423],
]);

it('refuses show who answered on anonymous retros', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Writing, ['is_anonymous' => true]);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), ['question' => 'Q', 'options' => ['A', 'B'], 'show_voters' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['show_voters' => 'Names are never shown on anonymous retros.']);
    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['show_voters' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['show_voters' => 'Names are never shown on anonymous retros.']);
    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['question' => 'Q', 'options' => ['A', 'B'], 'show_voters' => true])
        ->assertUnprocessable();

    expect($survey->fresh()->show_voters)->toBeFalse();
});

it('edits an unanswered survey and replaces its options', function () {
    [$retro, $user] = surveyingRetro();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), [
        'kind' => 'multiple',
        'question' => 'Which ones?',
        'options' => ['Red', 'Blue'],
    ])->assertOk()
        ->assertJsonPath('survey.kind', 'multiple')
        ->assertJsonPath('survey.version', 2)
        ->assertJsonPath('survey.options.*.label', ['Red', 'Blue']);

    Event::assertDispatched(fn (SurveyChanged $event) => $event->version === 2);
});

it('refuses to edit a survey once it has answers', function (string $kind) {
    [$retro, $user] = surveyingRetro();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    [, $voter] = retroMember($retro);
    answerSurvey($survey, $voter, 0);

    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), [
        'kind' => $kind,
        'question' => 'Changed',
        'options' => $kind === 'text' ? [] : ['A', 'B'],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['survey' => 'This survey already has answers.']);

    expect($survey->fresh()->question)->not->toBe('Changed');
})->with(['same kind' => 'single', 'kind change' => 'text']);

it('toggles show who answered on an answered survey, even while locked', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Voting, ['is_locked' => true]);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    [, $voter] = retroMember($retro);
    answerSurvey($survey, $voter, 0);

    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['show_voters' => true])
        ->assertOk()
        ->assertJsonPath('survey.showVoters', true)
        ->assertJsonPath('survey.version', 2);

    Event::assertDispatched(fn (SurveyChanged $event) => $event->version === 2
        && ! str_contains(json_encode($event->broadcastWith()), $voter->id));
});

it('refuses show who answered changes from others and once completed', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Discussing);
    [$member] = retroMember($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($member)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['show_voters' => true])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['show_voters' => true])->assertForbidden();
});

it('deletes a survey with its answers, reactions and comments', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Grouping);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    [, $voter] = retroMember($retro);
    answerSurvey($survey, $voter, 0);
    SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id]);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id]);

    $this->actingAs($user)->deleteJson(route('retros.surveys.destroy', [$retro, $survey]))->assertNoContent();

    expect(Survey::count())->toBe(0)
        ->and(SurveyResponse::count())->toBe(0)
        ->and(SurveyReaction::count())->toBe(0)
        ->and(SurveyComment::count())->toBe(0);
    Event::assertDispatched(fn (SurveyDeleted $event) => $event->broadcastWith() === ['surveyId' => $survey->id]);
});

it('shows a survey to any participant, guests included', function () {
    [$retro] = surveyingRetro(RetroPhase::Grouping, ['guest_access_enabled' => true]);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('retros.surveys.show', [$retro, $survey]))
        ->assertOk()
        ->assertJsonPath('survey.id', $survey->id)
        ->assertJsonPath('survey.options.0.count', null);
});

it('keeps the stored kind and voter setting when an edit omits them', function () {
    [$retro, $user] = surveyingRetro();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'kind' => 'multiple', 'show_voters' => true]);

    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), [
        'question' => 'Reworded',
        'options' => ['A', 'B', 'C'],
    ])->assertOk()
        ->assertJsonPath('survey.kind', 'multiple')
        ->assertJsonPath('survey.showVoters', true)
        ->assertJsonPath('survey.question', 'Reworded');
});

it('does not inherit stored voter names on a full update of an anonymous retro', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Writing, ['is_anonymous' => true]);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'show_voters' => true]);

    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['question' => 'Q', 'options' => ['A', 'B']])
        ->assertOk()
        ->assertJsonPath('survey.showVoters', false);

    expect($survey->fresh()->show_voters)->toBeFalse();
});
