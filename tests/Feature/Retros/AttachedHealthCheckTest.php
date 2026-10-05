<?php

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Events\Retros\HealthAnswered;
use App\Events\Retros\RetroSettingsChanged;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

/**
 * @param  array<string, int>  $scores
 */
function sendHealthCheck(Retro $retro, array $scores): TestResponse
{
    return test()->postJson(route('retros.healthCheck.submission.store', $retro), ['scores' => $scores]);
}

it('attaches a health check on five when a retro is created with it', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)->post(route('teams.retros.store', [$team->workspace, $team]), [
        'title' => 'Sprint 42', 'template' => 'start_stop_continue', 'health_check_enabled' => true,
    ])->assertRedirect();

    $retro = Retro::query()->sole();
    $survey = resolve(HealthCheckSurvey::class)->forRetro($retro);

    expect($retro->phase)->toBe(RetroPhase::Writing)
        ->and($survey->template)->toBe(TeamSurveyTemplate::HealthCheck)
        ->and($survey->status)->toBe(TeamSurveyStatus::Open)
        ->and($survey->title)->toBe('Sprint 42')
        ->and($survey->results_threshold)->toBe(0)
        ->and($survey->questions()->count())->toBe(6)
        ->and($survey->questions()->pluck('scale_max')->unique()->values()->all())->toBe([5])
        ->and($survey->questions()->where('is_required', false)->count())->toBe(0)
        ->and($survey->facilitator->participant_id)->toBe($retro->facilitator_participant_id)
        ->and($survey->facilitator->user_id)->toBe($user->id);
});

it('attaches nothing to a retro created without it', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))->post(route('teams.retros.store', [$team->workspace, $team]), [
        'title' => 'Sprint 42', 'template' => 'start_stop_continue',
    ])->assertRedirect();

    expect(TeamSurvey::query()->count())->toBe(0);
});

it('lets the facilitator attach one later, once', function () {
    Event::fake([RetroSettingsChanged::class]);
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($member)->postJson(route('retros.healthCheck.store', $retro))->assertForbidden();
    $this->actingAs($facilitator)->postJson(route('retros.healthCheck.store', $retro))->assertCreated();
    $this->actingAs($facilitator)->postJson(route('retros.healthCheck.store', $retro))
        ->assertUnprocessable()->assertJsonValidationErrors('health_check');

    expect(TeamSurvey::query()->where('retro_id', $retro->id)->count())->toBe(1);
    Event::assertDispatched(RetroSettingsChanged::class);
});

it('refuses to attach one to a completed retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)->postJson(route('retros.healthCheck.store', $retro))->assertForbidden();
});

it('sends every score at once, in any open phase, and tells the others how many have sent', function (RetroPhase $phase) {
    Event::fake([HealthAnswered::class]);
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user, $participant] = retroMember($retro);
    retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user);

    sendHealthCheck($retro, healthScores())
        ->assertOk()
        ->assertJsonPath('respondents', 1)
        ->assertJsonPath('participants', 2)
        ->assertJsonPath('hasSubmitted', true);

    $respondent = resolve(HealthCheckSurvey::class)->forRetro($retro)->respondents()->where('participant_id', $participant->id)->sole();

    expect($respondent->answers()->count())->toBe(6)
        ->and($respondent->completed_at)->not->toBeNull()
        ->and($respondent->user_id)->toBe($user->id);
    Event::assertDispatched(fn (HealthAnswered $event) => $event->broadcastAs() === 'health.answered'
        && $event->broadcastWith() === ['respondents' => 1, 'participants' => 2]);
})->with([RetroPhase::Writing, RetroPhase::Discussing, RetroPhase::Roti]);

it('lets a guest of the retro send their answers', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    attachHealthCheck($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials();

    sendHealthCheck($retro, healthScores())->assertOk();
});

it('refuses a set of scores that is not one score from 1 to 5 per statement', function (Closure $scores, string $field) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user);

    sendHealthCheck($retro, $scores())->assertUnprocessable()->assertJsonValidationErrors($field);

    expect(resolve(HealthCheckSurvey::class)->forRetro($retro)->hasAnswers())->toBeFalse();
})->with([
    'a statement missing' => [fn () => collect(healthScores())->except('vision')->all(), 'scores.vision'],
    'zero' => [fn () => healthScores(vision: 0), 'scores.vision'],
    'six' => [fn () => healthScores(vision: 6), 'scores.vision'],
    'not a number' => [fn () => [...healthScores(), 'vision' => 'seven'], 'scores.vision'],
    'an unknown statement' => [fn () => [...healthScores(), 'not_a_statement' => 3], 'scores'],
]);

it('refuses a second submission of the same participant', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user);

    sendHealthCheck($retro, healthScores())->assertOk();
    sendHealthCheck($retro, healthScores(vision: 1))->assertUnprocessable()->assertJsonValidationErrors('health_check');

    expect(resolve(HealthCheckSurvey::class)->forRetro($retro)->questions()->where('match_key', 'vision')->sole()->answers()->sole()->value)->toBe(4);
});

it('answers 404 when the retro has no health check', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user);

    sendHealthCheck($retro, healthScores())->assertNotFound();
});

it('refuses answers on a locked board, once closed, and once the retro is completed', function (Closure $arrange, int $status) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);
    $arrange($retro);

    $this->actingAs($user);

    sendHealthCheck($retro->fresh(), healthScores())->assertStatus($status);
})->with([
    'locked board' => [fn (Retro $retro) => $retro->update(['is_locked' => true]), 423],
    'closed health check' => [closeHealthCheck(...), 422],
    'completed retro' => [fn (Retro $retro) => $retro->update(['phase' => RetroPhase::Completed, 'completed_at' => now()]), 403],
]);

it('stamps the start of the retro with the first submission', function () {
    $retro = Retro::factory()->create(['started_at' => null]);
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user);

    sendHealthCheck($retro, healthScores())->assertOk();

    expect($retro->fresh()->started_at)->not->toBeNull();
});

it('sends each viewer their own scores and the state of the health check in the board snapshot, and names nobody', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    [, $otherParticipant] = retroMember($retro);
    $survey = attachHealthCheck($retro);
    answerHealthCheck($retro, $participant, healthScores(vision: 4));
    answerHealthCheck($retro, $otherParticipant, healthScores(vision: 2));

    $snapshot = $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('healthCheck.surveyId', $survey->id)
        ->assertJsonPath('healthCheck.isClosed', false)
        ->assertJsonPath('healthCheck.scale', 5)
        ->assertJsonPath('healthCheck.respondents', 2)
        ->assertJsonPath('healthCheck.participants', 2)
        ->assertJsonPath('healthCheck.hasSubmitted', true)
        ->assertJsonPath('healthCheck.statements.3.myScore', 4)
        ->assertJsonPath('healthCheck.statements.3.label', 'Vision')
        ->assertJsonPath('healthCheck.statements.3.isBuiltin', true)
        ->assertJsonPath('retro.healthCheckStatements', 6);

    expect($snapshot->json('healthCheck.statements.3'))->not->toHaveKey('answeredBy');
});

it('leaves the health check out of the snapshot of a retro that has none', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))->assertJsonPath('healthCheck', null);
});

it('closes and reopens from the retro, facilitator only', function () {
    Event::fake([RetroSettingsChanged::class]);
    $retro = Retro::factory()->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);
    $survey = attachHealthCheck($retro);

    $this->actingAs($member)->putJson(route('retros.healthCheck.closure.update', $retro))->assertForbidden();
    $this->actingAs($facilitator)->putJson(route('retros.healthCheck.closure.update', $retro))->assertNoContent();
    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Closed);

    $this->actingAs($facilitator)->deleteJson(route('retros.healthCheck.closure.destroy', $retro))->assertNoContent();
    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open);
    Event::assertDispatchedTimes(RetroSettingsChanged::class, 2);
});

it('removes an unanswered health check, and hides an answered one without losing its answers', function () {
    $unanswered = Retro::factory()->create();
    [$facilitator] = retroFacilitator($unanswered);
    attachHealthCheck($unanswered);

    $this->actingAs($facilitator)->deleteJson(route('retros.healthCheck.destroy', $unanswered))->assertNoContent();
    expect(TeamSurvey::query()->where('retro_id', $unanswered->id)->count())->toBe(0);

    $answered = Retro::factory()->create();
    [$other, $participant] = retroFacilitator($answered);
    $survey = attachHealthCheck($answered);
    answerHealthCheck($answered, $participant, healthScores());

    $this->actingAs($other)->deleteJson(route('retros.healthCheck.destroy', $answered))->assertNoContent();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Draft)
        ->and($survey->hasAnswers())->toBeTrue()
        ->and(resolve(HealthCheckSurvey::class)->forRetro($answered))->toBeNull();

    $this->actingAs($other)->postJson(route('retros.healthCheck.store', $answered))->assertCreated();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open)
        ->and(TeamSurvey::query()->where('retro_id', $answered->id)->count())->toBe(1)
        ->and($survey->hasAnswers())->toBeTrue();
});

it('closes the health check when the retro is completed, at the retro\'s completion time', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator] = retroFacilitator($retro);
    $survey = attachHealthCheck($retro);

    $this->actingAs($facilitator)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertSuccessful();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Closed)
        ->and($survey->fresh()->closed_at->equalTo($retro->fresh()->completed_at))->toBeTrue();
});

it('rebuilds the statements of unanswered, unclosed health checks when the team edits its statements, and of no other', function () {
    Event::fake([RetroSettingsChanged::class]);
    $team = Team::factory()->create();
    $unanswered = Retro::factory()->for($team)->create();
    $answered = Retro::factory()->for($team)->create();
    [, $participant] = retroMember($answered);
    $closed = Retro::factory()->for($team)->create();
    $standalone = TeamSurvey::factory()->healthCheck()->create(['team_id' => $team->id]);
    $ordinary = TeamSurvey::factory()->create(['team_id' => $team->id]);
    $ordinaryQuestion = surveyQuestion($ordinary);
    attachHealthCheck($unanswered);
    attachHealthCheck($answered);
    answerHealthCheck($answered, $participant, healthScores());
    attachHealthCheck($closed);
    closeHealthCheck($closed);

    $custom = resolve(ManageTeamHealthStatements::class)->add($team, 'We ship without fear', 'Shipping');
    $keys = fn (Retro $retro) => TeamSurvey::query()->where('retro_id', $retro->id)->sole()->questions()->pluck('match_key')->all();

    expect($keys($unanswered))->toContain($custom->id)
        ->and($standalone->questions()->pluck('match_key')->all())->toContain($custom->id)
        ->and($standalone->questions()->pluck('scale_max')->unique()->values()->all())->toBe([5])
        ->and($keys($answered))->not->toContain($custom->id)
        ->and($keys($closed))->not->toContain($custom->id)
        ->and($ordinary->questions()->pluck('id')->all())->toBe([$ordinaryQuestion->id]);
    Event::assertDispatched(fn (RetroSettingsChanged $event) => $event->retroId === $unanswered->id);
});

it('still refuses to turn anonymity off once someone has answered the health check', function () {
    $retro = Retro::factory()->anonymous()->create();
    [$facilitator, $participant] = retroFacilitator($retro);
    attachHealthCheck($retro);
    answerHealthCheck($retro, $participant, healthScores());

    $this->actingAs($facilitator)->patchJson(route('retros.settings.update', $retro), ['is_anonymous' => false])
        ->assertUnprocessable()->assertJsonValidationErrors('is_anonymous');
});

it('still refuses to turn anonymity off once the answered health check was removed', function () {
    $retro = Retro::factory()->anonymous()->create();
    [$facilitator, $participant] = retroFacilitator($retro);
    attachHealthCheck($retro);
    answerHealthCheck($retro, $participant, healthScores());
    $this->actingAs($facilitator)->deleteJson(route('retros.healthCheck.destroy', $retro))->assertNoContent();

    $this->actingAs($facilitator)->patchJson(route('retros.settings.update', $retro), ['is_anonymous' => false])
        ->assertUnprocessable()->assertJsonValidationErrors('is_anonymous');
});
