<?php

use App\Enums\TeamRole;
use App\Enums\TeamSurveyStatus;
use App\Enums\WorkspaceRole;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;

it('refuses to let an observer of the team create a survey, from a template or from an earlier one', function () {
    $source = TeamSurvey::factory()->closed()->create();
    $observer = teamMember($source->team, TeamRole::Observer);
    $store = route('teams.surveys.store', [$source->team->workspace, $source->team]);

    $this->actingAs($observer)->post($store, ['title' => 'Pulse', 'template' => 'team_pulse'])->assertForbidden();
    $this->actingAs($observer)->post($store, ['title' => 'Pulse again', 'source_survey_id' => $source->id])->assertForbidden();
    $this->actingAs($observer)->post(route('surveys.duplicate.store', $source))->assertForbidden();

    expect(TeamSurvey::query()->count())->toBe(1);
});

it('refuses an observer an answer and its withdrawal, and lets them read the survey', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey);
    $observer = teamMember($survey->team, TeamRole::Observer);

    $this->actingAs($observer)->putJson(route('surveys.answers.update', [$survey, $question]), ['value' => 4])->assertForbidden();
    $this->actingAs($observer)->deleteJson(route('surveys.answers.destroy', [$survey, $question]))->assertForbidden();
    $this->actingAs($observer)->getJson(route('surveys.snapshot.show', $survey))->assertOk();

    expect($question->answers()->count())->toBe(0);
});

it('refuses a guest the builder and every action of an editor', function () {
    Event::fake([TeamSurveyChanged::class]);
    $survey = TeamSurvey::factory()->closed()->withGuestAccess()->withoutThreshold()->create(['title' => 'Pulse']);
    $guest = surveyGuest($survey);
    answerSurveyQuestion(surveyQuestion($survey), $guest, 4);
    $token = $survey->guest_token;

    $asGuest = $this->withCookies(surveyGuestCookie($guest))->withCredentials();

    $asGuest->get(route('surveys.edit', $survey))->assertForbidden();
    $asGuest->patchJson(route('surveys.update', $survey), ['title' => 'Renamed'])->assertForbidden();
    $asGuest->putJson(route('surveys.status.update', $survey), ['status' => 'open'])->assertForbidden();
    $asGuest->postJson(route('surveys.guestToken.store', $survey))->assertForbidden();
    $asGuest->getJson(route('surveys.export.show', $survey))->assertForbidden();
    $asGuest->deleteJson(route('surveys.destroy', $survey))->assertForbidden();

    expect($survey->fresh())
        ->title->toBe('Pulse')
        ->status->toBe(TeamSurveyStatus::Closed)
        ->guest_token->toBe($token);
    Event::assertNotDispatched(TeamSurveyChanged::class);
});

it('refuses someone of another workspace every page and endpoint of a survey', function () {
    $survey = TeamSurvey::factory()->closed()->withoutThreshold()->create();
    $question = surveyQuestion($survey);
    $stranger = User::factory()->create();
    Workspace::factory()->create()->members()->attach($stranger, ['role' => WorkspaceRole::Admin->value]);

    $this->actingAs($stranger)->get(route('surveys.show', $survey))->assertForbidden();
    $this->actingAs($stranger)->get(route('surveys.results.show', $survey))->assertForbidden();
    $this->actingAs($stranger)->getJson(route('surveys.snapshot.show', $survey))->assertForbidden();
    $this->actingAs($stranger)->getJson(route('surveys.comparison.show', $survey))->assertForbidden();
    $this->actingAs($stranger)->putJson(route('surveys.answers.update', [$survey, $question]), ['value' => 4])->assertForbidden();

    expect($survey->respondents()->count())->toBe(0);
});

it('validates the title, the description and the settings of a survey', function (array $body, string $field) {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    $this->actingAs($facilitator)->patchJson(route('surveys.update', $survey), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    expect($survey->fresh()->version)->toBe(1);
})->with([
    'an empty title' => [['title' => ''], 'title'],
    'a title too long' => [['title' => str_repeat('a', 121)], 'title'],
    'a description too long' => [['description' => str_repeat('a', 501)], 'description'],
    'guest access that is not a switch' => [['guest_access_enabled' => 'maybe'], 'guest_access_enabled'],
    'one question at a time that is not a switch' => [['one_question_at_a_time' => 'sometimes'], 'one_question_at_a_time'],
    'results after answering that is not a switch' => [['show_results_after_answer' => ['yes']], 'show_results_after_answer'],
]);

it('refuses a comparison with something that is not a survey id', function () {
    $survey = TeamSurvey::factory()->closed()->withoutThreshold()->create();

    $this->actingAs(teamMember($survey->team))
        ->getJson(route('surveys.comparison.show', [$survey, 'with' => 'sprint-41']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('with');
});

it('lets a workspace manager who does not facilitate the survey close it and export it', function () {
    $survey = TeamSurvey::factory()->open()->withoutThreshold()->create();
    [, $respondent] = surveyFacilitator($survey);
    answerSurveyQuestion(surveyQuestion($survey), $respondent, 4);
    $manager = workspaceManager($survey->team->workspace);

    $this->actingAs($manager)->putJson(route('surveys.status.update', $survey), ['status' => 'closed'])->assertNoContent();
    $this->actingAs($manager)->get(route('surveys.export.show', $survey))->assertOk();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Closed);
});

it('refuses to finish or reopen a response once the survey is closed', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$member, $respondent] = surveyMember($survey);
    answerSurveyQuestion(surveyQuestion($survey), $respondent, 4);
    $survey->update(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);

    $this->actingAs($member)->postJson(route('surveys.submission.store', $survey))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('survey');
    $this->actingAs($member)->deleteJson(route('surveys.submission.destroy', $survey))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('survey');

    expect($respondent->fresh()->completed_at)->toBeNull();
});
