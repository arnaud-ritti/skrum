<?php

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurvey;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A survey with one text question answered by three members, so that a
 * leak shows as a recognisable sentence in the payload.
 *
 * @return array{survey: TeamSurvey, facilitator: User, finished: User, unfinished: User, bystander: User}
 */
function answeredSurvey(string $state, array $attributes = []): array
{
    $survey = TeamSurvey::factory()->{$state}()->create($attributes);
    [$facilitator, $facilitatorRespondent] = surveyFacilitator($survey);
    [$finished, $finishedRespondent] = surveyMember($survey);
    [$unfinished, $unfinishedRespondent] = surveyMember($survey);
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text);

    answerSurveyQuestion($question, $facilitatorRespondent, 'SECRET-ONE');
    answerSurveyQuestion($question, $finishedRespondent, 'SECRET-TWO');
    answerSurveyQuestion($question, $unfinishedRespondent, 'SECRET-THREE');
    $finishedRespondent->update(['completed_at' => now()]);

    return [
        'survey' => $survey,
        'facilitator' => $facilitator,
        'finished' => $finished,
        'unfinished' => $unfinished,
        'bystander' => teamMember($survey->team),
    ];
}

it('sends results to who may see them and to nobody else', function (string $state, array $attributes, string $viewer, bool $sees, int $answersShownWithoutResults = 0) {
    $fixture = answeredSurvey($state, $attributes);

    $response = $this->actingAs($fixture[$viewer])->getJson(route('surveys.snapshot.show', $fixture['survey']))->assertOk();
    $body = $response->getContent();
    $othersAnswers = substr_count($body, 'SECRET-');

    $response->assertJsonPath('me.canSeeResults', $sees)
        ->assertJsonPath('progress.responses', 3);

    if ($sees) {
        $response->assertJsonPath('results.belowThreshold', false);
        expect($othersAnswers)->toBeGreaterThanOrEqual(3);

        return;
    }

    $response->assertJsonPath('results', null);
    expect($othersAnswers)->toBe($answersShownWithoutResults);
})->with([
    'open: editor' => ['open', [], 'facilitator', true],
    'open: finished respondent' => ['open', [], 'finished', true],
    'open: unfinished respondent' => ['open', [], 'unfinished', false, 1],
    'open: member who did not answer' => ['open', [], 'bystander', false],
    'open, setting off: finished respondent' => ['open', ['show_results_after_answer' => false], 'finished', false, 1],
    'open, setting off: editor' => ['open', ['show_results_after_answer' => false], 'facilitator', true],
    'closed: unfinished respondent' => ['closed', [], 'unfinished', true],
    'closed: member who did not answer' => ['closed', [], 'bystander', true],
]);

it('withholds aggregates from everyone below the threshold, and gives the count', function () {
    $survey = TeamSurvey::factory()->closed()->create();
    [$facilitator, $respondent] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);
    answerSurveyQuestion($question, $respondent, 4);
    [, $second] = surveyMember($survey);
    answerSurveyQuestion($question, $second, 2);

    $this->actingAs($facilitator)->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath('results.belowThreshold', true)
        ->assertJsonPath('results.responses', 2)
        ->assertJsonPath('results.questions', []);

    [, $third] = surveyMember($survey);
    answerSurveyQuestion($question, $third, 3);

    $this->actingAs($facilitator)->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath('results.belowThreshold', false)
        ->assertJsonPath("results.questions.{$question->id}.mean", 3);
});

it('shows results from the first answer when the survey has no threshold', function () {
    $survey = TeamSurvey::factory()->closed()->withoutThreshold()->create();
    [$facilitator, $respondent] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);
    answerSurveyQuestion($question, $respondent, 4);

    $this->actingAs($facilitator)->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath("results.questions.{$question->id}.responses", 1);
});

it('lets a guest see results as a respondent does', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->withoutThreshold()->create();
    $question = surveyQuestion($survey);
    $guest = surveyGuest($survey);
    answerSurveyQuestion($question, $guest, 5);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath('results', null);

    $guest->update(['completed_at' => now()]);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath("results.questions.{$question->id}.mean", 5);
});

it('renders the results page for a member and keeps the same withholding in its props', function () {
    $fixture = answeredSurvey('open');

    $this->actingAs($fixture['bystander'])->get(route('surveys.results.show', $fixture['survey']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('surveys/results')
            ->where('snapshot.results', null)
            ->where('snapshot.progress.responses', 3));
});

it('sends an editor from the results of a draft to the builder, and refuses the others', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    $this->actingAs($facilitator)->get(route('surveys.results.show', $survey))->assertRedirect(route('surveys.edit', $survey));
    $this->actingAs(teamMember($survey->team))->get(route('surveys.results.show', $survey))->assertForbidden();
});
