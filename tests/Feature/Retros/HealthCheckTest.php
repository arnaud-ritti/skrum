<?php

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Actions\HealthCheck\PresentHealthProgress;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Events\Retros\HealthAnswered;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyRespondent;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array<string, int>
 */
function healthScores(int $vision = 4): array
{
    return ['interaction' => 3, 'task_clarity' => 4, 'manager_support' => 5, 'vision' => $vision, 'processes' => 2, 'motivation' => 4];
}

function healthSubmissionRoute(Retro $retro): string
{
    return route('retros.healthCheck.submission.store', $retro);
}

it('sends every score at once, and the viewer reads them back', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user)->postJson(healthSubmissionRoute($retro), ['scores' => healthScores(vision: 2)])
        ->assertOk()
        ->assertExactJson(['respondents' => 1, 'participants' => 1, 'hasSubmitted' => true]);

    $statements = collect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $participant)['healthCheck']['statements'])->keyBy('key');

    expect($statements['vision']['myScore'])->toBe(2)
        ->and(TeamSurveyAnswer::query()->count())->toBe(6);
});

it('refuses a second submission without changing the scores sent', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user)->postJson(healthSubmissionRoute($retro), ['scores' => healthScores(vision: 3)])->assertOk();
    $this->actingAs($user)->postJson(healthSubmissionRoute($retro), ['scores' => healthScores(vision: 5)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('health_check');

    expect(TeamSurveyAnswer::query()->count())->toBe(6)
        ->and(resolve(HealthCheckSurvey::class)->forRetro($retro)->questions()->where('match_key', 'vision')->sole()->answers()->sole()->value)->toBe(3);
});

it('lets guests answer', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    attachHealthCheck($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->postJson(healthSubmissionRoute($retro), ['scores' => healthScores()])
        ->assertOk();

    expect(TeamSurveyRespondent::query()->where('participant_id', $guest->id)->sole()->user_id)->toBeNull();
});

it('accepts scores from 1 to 5 only', function (mixed $score) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user)->postJson(healthSubmissionRoute($retro), ['scores' => [...healthScores(), 'vision' => $score]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('scores.vision');

    expect(TeamSurveyAnswer::query()->count())->toBe(0);
})->with([0, 6, 'high', null]);

it('accepts 10 on an imported health check left open on the scale of ten', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    [, $other] = retroMember($retro);
    attachHealthCheck($retro);
    answerHealthCheck($retro, $other, ['vision' => 7], scaleMax: 10);

    $this->actingAs($user)->postJson(healthSubmissionRoute($retro), ['scores' => [...healthScores(), 'vision' => 10]])->assertOk();
});

it('returns 422 for statements outside the health check', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user)->postJson(healthSubmissionRoute($retro), ['scores' => [...healthScores(), 'happiness' => 3]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('scores');

    expect(TeamSurveyAnswer::query()->count())->toBe(0);
});

it('accepts a submission in every open phase while unlocked and open', function (RetroPhase $phase, array $attributes, int $status) {
    $retro = Retro::factory()->create(['phase' => $phase, ...$attributes]);
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user)->postJson(healthSubmissionRoute($retro->fresh()), ['scores' => healthScores()])->assertStatus($status);
})->with([
    'writing' => [RetroPhase::Writing, [], 200],
    'voting' => [RetroPhase::Voting, [], 200],
    'actions' => [RetroPhase::Actions, [], 200],
    'completed' => [RetroPhase::Completed, ['completed_at' => '2026-10-01 10:00:00'], 403],
    'locked' => [RetroPhase::Writing, ['is_locked' => true], 423],
]);

it('broadcasts the number who have sent and the number of participants, never a score or a name', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user)->postJson(healthSubmissionRoute($retro), ['scores' => healthScores()])->assertOk();

    Event::assertDispatched(function (HealthAnswered $event) use ($participant): bool {
        $payload = json_encode($event->broadcastWith());

        return $event->broadcastAs() === 'health.answered'
            && $event->broadcastWith() === ['respondents' => 1, 'participants' => 2]
            && ! str_contains($payload, 'score')
            && ! str_contains($payload, $participant->id);
    });
});

it('names who answered for the MCP tool on a named retro only', function (bool $isAnonymous, bool $named) {
    $retro = Retro::factory()->create(['is_anonymous' => $isAnonymous]);
    [, $participant] = retroMember($retro);
    attachHealthCheck($retro);
    answerHealthCheck($retro, $participant, healthScores());

    $vision = collect(resolve(PresentHealthProgress::class)->handle($retro)['statements'])->firstWhere('key', 'vision');

    expect($vision['count'])->toBe(1)
        ->and($vision['answeredBy'])->toBe($named ? [$participant->id] : []);
})->with([
    'anonymous' => [true, false],
    'named' => [false, true],
]);

it('sends each viewer only their own score in the snapshot', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);
    [, $other] = retroMember($retro);
    attachHealthCheck($retro);
    answerHealthCheck($retro, $other, healthScores(vision: 2));
    answerHealthCheck($retro, $viewer, [...healthScores(), 'motivation' => 5]);

    $healthCheck = resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck'];
    $statements = collect($healthCheck['statements'])->keyBy('key');

    expect(array_keys($statements['vision']))->toBe(['key', 'label', 'text', 'isBuiltin', 'myScore'])
        ->and($statements['vision']['myScore'])->toBe(4)
        ->and($statements['motivation']['myScore'])->toBe(5)
        ->and($statements['motivation']['label'])->toBe('Motivation')
        ->and($healthCheck['respondents'])->toBe(2)
        ->and($healthCheck['hasSubmitted'])->toBeTrue();

    $outsider = Participant::factory()->create(['retro_id' => $retro->id]);

    expect(collect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $outsider)['healthCheck']['statements'])->pluck('myScore')->filter()->all())->toBeEmpty();
});

it('leaves the health check out of the snapshot of a retro that has none', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);

    expect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck'])->toBeNull();
});

it('presents built-in statements translated and custom statements as stored', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);
    $custom = resolve(ManageTeamHealthStatements::class)->add($retro->team, 'We pair often.', 'Pairing');
    attachHealthCheck($retro);

    $statements = collect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck']['statements'])->keyBy('key');

    expect(collect($statements['vision'])->only(['key', 'label', 'text', 'isBuiltin'])->all())
        ->toBe(['key' => 'vision', 'label' => HealthStatement::Vision->label(), 'text' => HealthStatement::Vision->text(), 'isBuiltin' => true])
        ->and(collect($statements[$custom->id])->only(['key', 'label', 'text', 'isBuiltin'])->all())
        ->toBe(['key' => $custom->id, 'label' => 'Pairing', 'text' => 'We pair often.', 'isBuiltin' => false]);
});

it('keeps the answers of a health check that was removed, out of the snapshot, and brings them back when it is added again', function () {
    $retro = Retro::factory()->create();
    [$facilitator, $viewer] = retroFacilitator($retro);
    $survey = attachHealthCheck($retro);
    answerHealthCheck($retro, $viewer, healthScores(vision: 2));

    $this->actingAs($facilitator)->deleteJson(route('retros.healthCheck.destroy', $retro))->assertNoContent();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Draft)
        ->and(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck'])->toBeNull();

    $this->actingAs($facilitator)->postJson(route('retros.healthCheck.store', $retro))->assertCreated();

    $statements = collect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck']['statements'])->keyBy('key');

    expect($statements['vision']['myScore'])->toBe(2);
});
