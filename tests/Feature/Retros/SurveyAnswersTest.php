<?php

use App\Enums\RetroPhase;
use App\Events\Retros\SurveyChanged;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
use App\Models\SurveyResponse;
use App\Models\SurveyTextAnswer;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function answeringRetro(RetroPhase $phase = RetroPhase::Voting, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);

    return [$retro, $user, $participant];
}

it('answers a single choice survey, changes the answer and withdraws it', function () {
    [$retro, $user, $participant] = answeringRetro();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    [$yes, $no] = $survey->options->all();
    $route = route('retros.surveys.response.update', [$retro, $survey]);

    $this->actingAs($user)->putJson($route, ['optionId' => $yes->id])
        ->assertOk()
        ->assertJsonPath('survey.myOptionIds', [$yes->id])
        ->assertJsonPath('survey.resultsVisible', true)
        ->assertJsonPath('survey.options.0.count', 1);
    $this->actingAs($user)->putJson($route, ['optionId' => $no->id])
        ->assertJsonPath('survey.myOptionIds', [$no->id])
        ->assertJsonPath('survey.options.0.count', 0)
        ->assertJsonPath('survey.responseCount', 1);

    expect(SurveyResponse::count())->toBe(1);

    $this->actingAs($user)->deleteJson(route('retros.surveys.response.destroy', [$retro, $survey]))
        ->assertOk()
        ->assertJsonPath('survey.myOptionIds', [])
        ->assertJsonPath('survey.resultsVisible', false)
        ->assertJsonPath('survey.options.0.count', null);

    expect(SurveyResponse::count())->toBe(0);
    Event::assertDispatched(SurveyChanged::class, 3);
});

it('stores several options on a multiple choice survey and replaces them', function () {
    [$retro, $user] = answeringRetro();
    $survey = Survey::factory()->multiple()->withOptions()->create(['retro_id' => $retro->id]);
    [$first, $second, $third] = $survey->options->all();
    $route = route('retros.surveys.response.update', [$retro, $survey]);

    $this->actingAs($user)->putJson($route, ['optionIds' => [$first->id, $third->id]])
        ->assertOk()
        ->assertJsonPath('survey.myOptionIds', [$first->id, $third->id])
        ->assertJsonPath('survey.responseCount', 1);
    $this->actingAs($user)->putJson($route, ['optionIds' => [$second->id]])
        ->assertJsonPath('survey.myOptionIds', [$second->id]);

    expect(SurveyResponse::pluck('survey_option_id')->all())->toBe([$second->id]);
});

it('stores a trimmed free-text answer and lets its author update it', function () {
    [$retro, $user, $participant] = answeringRetro();
    $survey = Survey::factory()->text()->create(['retro_id' => $retro->id]);
    $route = route('retros.surveys.response.update', [$retro, $survey]);

    $this->actingAs($user)->putJson($route, ['text' => '  More pairing  '])
        ->assertOk()
        ->assertJsonPath('survey.myText', 'More pairing')
        ->assertJsonPath('survey.textAnswers.0.isMine', true);
    $this->actingAs($user)->putJson($route, ['text' => 'Less meetings'])
        ->assertJsonPath('survey.myText', 'Less meetings');

    expect(SurveyTextAnswer::where('participant_id', $participant->id)->pluck('content')->all())->toBe(['Less meetings']);
});

it('rejects answers that do not match the survey kind', function (string $factoryState, array $body) {
    [$retro, $user] = answeringRetro();
    $survey = Survey::factory()->{$factoryState}()->withOptions()->create(['retro_id' => $retro->id]);
    $options = $survey->options->pluck('id')->all();
    $foreign = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'position' => 1])->options->first()->id;
    $resolved = json_decode(strtr(json_encode($body), [
        'OPTION_A' => $options[0] ?? 'none',
        'OPTION_B' => $options[1] ?? 'none',
        'FOREIGN' => $foreign,
    ]), true);

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $survey]), $resolved)->assertUnprocessable();

    expect(SurveyResponse::where('survey_id', $survey->id)->count())->toBe(0)
        ->and(SurveyTextAnswer::where('survey_id', $survey->id)->count())->toBe(0);
})->with([
    'single with two options' => ['single', ['optionIds' => ['OPTION_A', 'OPTION_B']]],
    'single with text' => ['single', ['text' => 'hello']],
    'single with a foreign option' => ['single', ['optionId' => 'FOREIGN']],
    'multiple with one id field' => ['multiple', ['optionId' => 'OPTION_A']],
    'multiple with nothing chosen' => ['multiple', ['optionIds' => []]],
    'multiple with a foreign option' => ['multiple', ['optionIds' => ['OPTION_A', 'FOREIGN']]],
    'multiple with a duplicate' => ['multiple', ['optionIds' => ['OPTION_A', 'OPTION_A']]],
    'text with an option' => ['text', ['optionId' => 'OPTION_A']],
    'text empty' => ['text', ['text' => '   ']],
    'text too long' => ['text', ['text' => str_repeat('a', 501)]],
]);

it('refuses answers on closed surveys', function () {
    [$retro, $user, $participant] = answeringRetro();
    $survey = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['optionId' => $survey->options->first()->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['survey' => 'This survey is closed.']);

    answerSurvey($survey, $participant, 0);

    $this->actingAs($user)->deleteJson(route('retros.surveys.response.destroy', [$retro, $survey]))->assertUnprocessable();

    expect(SurveyResponse::count())->toBe(1);
});

it('refuses answers outside the board phases and while locked', function (RetroPhase $phase, array $attributes, int $status) {
    [$retro, $user] = answeringRetro($phase, $attributes);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['optionId' => $survey->options->first()->id])
        ->assertStatus($status);
})->with([
    'icebreaker' => [RetroPhase::Icebreaker, [], 403],
    'completed' => [RetroPhase::Completed, [], 403],
    'locked' => [RetroPhase::Writing, ['is_locked' => true], 423],
]);

it('lets guests answer', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['optionId' => $survey->options->first()->id])
        ->assertOk();
});

it('never broadcasts the chosen option, the text or who answered', function () {
    [$retro, $user, $participant] = answeringRetro();
    $survey = Survey::factory()->text()->create(['retro_id' => $retro->id, 'show_voters' => true]);

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['text' => 'secret feedback'])->assertOk();

    Event::assertDispatched(fn (SurveyChanged $event) => $event->broadcastWith() === ['surveyId' => $survey->id, 'version' => 1, 'responseCount' => 1]
        && ! str_contains(json_encode($event->broadcastWith()), 'secret feedback')
        && ! str_contains(json_encode($event->broadcastWith()), $participant->id));
});

it('returns 404 for a deleted survey or a survey of another retro', function () {
    [$retro, $user] = answeringRetro();
    $foreign = Survey::factory()->withOptions()->create();
    $deleted = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    $optionId = $deleted->options->first()->id;
    $deleted->delete();

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $foreign]), ['optionId' => $foreign->options->first()->id])->assertNotFound();
    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $deleted->id]), ['optionId' => $optionId])->assertNotFound();

    expect(SurveyResponse::count())->toBe(0);
});

it('lets the facilitator close and reopen a survey, even while locked', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['is_locked' => true]);
    [$user] = retroFacilitator($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.surveys.closure.update', [$retro, $survey]))
        ->assertOk()
        ->assertJsonPath('survey.isClosed', true)
        ->assertJsonPath('survey.resultsVisible', true)
        ->assertJsonPath('survey.version', 2);
    $this->actingAs($user)->deleteJson(route('retros.surveys.closure.destroy', [$retro, $survey]))
        ->assertOk()
        ->assertJsonPath('survey.isClosed', false)
        ->assertJsonPath('survey.version', 3);

    Event::assertDispatched(SurveyChanged::class, 2);
});

it('keeps closing to the facilitator and out of completed retros', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($member)->putJson(route('retros.surveys.closure.update', [$retro, $survey]))->assertForbidden();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)->deleteJson(route('retros.surveys.closure.destroy', [$retro, $survey]))->assertForbidden();
});

it('closes every open survey at completion and keeps them closed after a reopen', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroFacilitator($retro);
    $open = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    $closed = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id, 'position' => 1, 'version' => 4]);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();

    expect($open->fresh()->is_closed)->toBeTrue()
        ->and($open->fresh()->version)->toBe(2)
        ->and($closed->fresh()->version)->toBe(4);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'discussing'])->assertOk();

    expect($open->fresh()->is_closed)->toBeTrue();

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $open]), ['optionId' => $open->options->first()->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['survey' => 'This survey is closed.']);
});

it('refuses turning anonymity off once a survey has any activity', function (Closure $recordActivity) {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['is_anonymous' => true]);
    [$user, $participant] = retroFacilitator($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    $recordActivity($retro, $survey, $participant);

    $this->actingAs($user)
        ->patchJson(route('retros.settings.update', $retro), ['is_anonymous' => false])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['is_anonymous']);

    expect($retro->fresh()->is_anonymous)->toBeTrue();
})->with([
    'a response' => [fn ($retro, $survey, $participant) => SurveyResponse::factory()->create(['survey_id' => $survey->id, 'survey_option_id' => $survey->options->first()->id, 'participant_id' => $participant->id])],
    'a text answer' => [fn ($retro, $survey, $participant) => SurveyTextAnswer::factory()->create(['survey_id' => $survey->id, 'participant_id' => $participant->id])],
    'a comment' => [fn ($retro, $survey, $participant) => SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $participant->id])],
    'a reaction' => [fn ($retro, $survey, $participant) => SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $participant->id])],
]);

it('gives survey text answers random version 4 ids', function () {
    $survey = Survey::factory()->create();

    $ids = SurveyTextAnswer::factory()->count(2)->create(['survey_id' => $survey->id])->pluck('id');

    expect($ids)->each(fn ($id) => $id->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/'));
});
