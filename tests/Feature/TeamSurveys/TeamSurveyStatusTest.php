<?php

use App\Actions\TeamSurveys\ChangeTeamSurveyStatus;
use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    Event::fake([TeamSurveyChanged::class]);
});

function putStatus(TeamSurvey $survey, string $status, User $user): TestResponse
{
    return test()->actingAs($user)->putJson(route('surveys.status.update', $survey), ['status' => $status]);
}

it('publishes a draft that has a question', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);
    surveyQuestion($survey);

    putStatus($survey, 'open', $facilitator)->assertNoContent();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open)
        ->and($survey->fresh()->opened_at)->not->toBeNull()
        ->and($survey->fresh()->version)->toBe(2);
    Event::assertDispatched(fn (TeamSurveyChanged $event) => $event->status === 'open');
});

it('refuses to publish a survey without a question', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    putStatus($survey, 'open', $facilitator)->assertUnprocessable()->assertJsonValidationErrors('status');
});

it('goes back to draft until the first answer, and not after', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator, $respondent] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);

    putStatus($survey, 'draft', $facilitator)->assertNoContent();
    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Draft);

    putStatus($survey, 'open', $facilitator)->assertNoContent();
    answerSurveyQuestion($question, $respondent, 3);

    putStatus($survey, 'draft', $facilitator)->assertUnprocessable()->assertJsonValidationErrors('status');
});

it('closes and reopens', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator] = surveyFacilitator($survey);

    putStatus($survey, 'closed', $facilitator)->assertNoContent();
    expect($survey->fresh()->closed_at)->not->toBeNull();

    putStatus($survey, 'open', $facilitator)->assertNoContent();
    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open)
        ->and($survey->fresh()->closed_at)->toBeNull();
});

it('refuses the changes that make no sense', function (string $from, string $to) {
    $survey = TeamSurvey::factory()->{$from}()->create();
    [$facilitator] = surveyFacilitator($survey);
    surveyQuestion($survey);

    putStatus($survey, $to, $facilitator)->assertUnprocessable()->assertJsonValidationErrors('status');
})->with([
    ['draft', 'closed'],
    ['draft', 'draft'],
    ['closed', 'draft'],
    ['closed', 'closed'],
    ['open', 'open'],
]);

it('does not reopen a survey attached to a completed retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    $survey = TeamSurvey::factory()->attachedTo($retro)->closed()->create();

    expect(fn () => DB::transaction(fn () => resolve(ChangeTeamSurveyStatus::class)->handle(
        TeamSurvey::query()->whereKey($survey->id)->lockForUpdate()->firstOrFail(),
        TeamSurveyStatus::Open,
    )))->toThrow(ValidationException::class);
});

it('refuses a member who is not an editor, and an unknown status', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator] = surveyFacilitator($survey);

    putStatus($survey, 'closed', teamMember($survey->team))->assertForbidden();
    putStatus($survey, 'archived', $facilitator)->assertUnprocessable()->assertJsonValidationErrors('status');
});
