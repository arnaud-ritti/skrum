<?php

use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Models\Retro;
use App\Models\TeamSurvey;

it('copies title, settings, questions and options, and no answer', function () {
    $source = TeamSurvey::factory()->closed()->create(['title' => 'Pulse 41', 'one_question_at_a_time' => false, 'guest_access_enabled' => true]);
    [$facilitator, $respondent] = surveyFacilitator($source);
    $single = surveyQuestion($source, TeamSurveyQuestionKind::Single, ['match_key' => 'ritual', 'is_required' => true], ['Retro', 'Daily']);
    answerSurveyQuestion($single, $respondent, [0]);
    $member = teamMember($source->team);

    $this->actingAs($member)->post(route('surveys.duplicate.store', $source))->assertRedirect();

    $copy = TeamSurvey::query()->whereKeyNot($source->id)->sole();

    expect($copy->title)->toBe('Copy of Pulse 41')
        ->and($copy->status)->toBe(TeamSurveyStatus::Draft)
        ->and($copy->previous_survey_id)->toBe($source->id)
        ->and($copy->one_question_at_a_time)->toBeFalse()
        ->and($copy->guest_access_enabled)->toBeTrue()
        ->and($copy->guest_token)->not->toBe($source->guest_token)
        ->and($copy->facilitator->user_id)->toBe($member->id)
        ->and($copy->questions()->sole()->match_key)->toBe('ritual')
        ->and($copy->questions()->sole()->is_required)->toBeTrue()
        ->and($copy->questions()->sole()->options()->pluck('label')->all())->toBe(['Retro', 'Daily'])
        ->and($copy->hasAnswers())->toBeFalse();
});

it('gives a duplicated health check the team\'s statements of today, and no retro', function () {
    $source = TeamSurvey::factory()->healthCheck()->closed()->create();
    surveyQuestion($source, TeamSurveyQuestionKind::Scale, ['match_key' => 'gone', 'scale_max' => 10]);

    $this->actingAs(teamMember($source->team))->post(route('surveys.duplicate.store', $source))->assertRedirect();

    $copy = TeamSurvey::query()->whereKeyNot($source->id)->sole();

    expect($copy->questions()->count())->toBe(6)
        ->and($copy->questions()->pluck('match_key')->all())->not->toContain('gone')
        ->and($copy->retro_id)->toBeNull()
        ->and($copy->results_threshold)->toBe(3);
});

it('creates from a previous survey through the creation route', function () {
    $source = TeamSurvey::factory()->closed()->create();
    surveyQuestion($source);
    $member = teamMember($source->team);

    $this->actingAs($member)->post(route('teams.surveys.store', [$source->team->workspace, $source->team]), [
        'title' => 'Pulse 42',
        'source_survey_id' => $source->id,
    ])->assertRedirect();

    $copy = TeamSurvey::query()->whereKeyNot($source->id)->sole();

    expect($copy->title)->toBe('Pulse 42')
        ->and($copy->questions()->count())->toBe(1);
});

it('refuses a source of another team, a draft, an attached health check, a source with a template, and a guest', function () {
    $source = TeamSurvey::factory()->closed()->withGuestAccess()->create();
    $otherTeamSurvey = TeamSurvey::factory()->closed()->create();
    $draft = TeamSurvey::factory()->draft()->create(['team_id' => $source->team_id]);
    $attached = TeamSurvey::factory()->attachedTo(Retro::factory()->create(['team_id' => $source->team_id]))->closed()->create();
    $member = teamMember($source->team);

    foreach ([$draft, $attached] as $refused) {
        $this->actingAs($member)->postJson(route('teams.surveys.store', [$source->team->workspace, $source->team]), ['title' => 'T', 'source_survey_id' => $refused->id])
            ->assertJsonValidationErrors('source_survey_id');
    }

    $this->actingAs($member)->postJson(route('teams.surveys.store', [$source->team->workspace, $source->team]), ['title' => 'T', 'source_survey_id' => $otherTeamSurvey->id])
        ->assertJsonValidationErrors('source_survey_id');
    $this->actingAs($member)->postJson(route('teams.surveys.store', [$source->team->workspace, $source->team]), ['title' => 'T', 'source_survey_id' => $source->id, 'template' => 'team_pulse'])
        ->assertJsonValidationErrors('template');

    auth()->logout();
    $this->withCookies(surveyGuestCookie(surveyGuest($source)))->withCredentials()
        ->postJson(route('surveys.duplicate.store', $source))
        ->assertForbidden();
});
