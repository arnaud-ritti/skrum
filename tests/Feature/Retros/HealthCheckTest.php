<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Events\Retros\HealthAnswered;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use App\Models\TeamHealthStatement;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function healthCheckRetro(array $attributes = []): Retro
{
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::HealthCheck)->create($attributes);

    app(FreezeHealthStatements::class)->handle($retro);

    return $retro->fresh();
}

function healthAnswerRoute(Retro $retro, string $statement): string
{
    return route('retros.health-check.update', ['retro' => $retro, 'statement' => $statement]);
}

it('sets, changes and clears the own score for one statement', function () {
    $retro = healthCheckRetro();
    [$user, $participant] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'vision'), ['score' => 7])
        ->assertOk()
        ->assertJsonPath('statement', 'vision')
        ->assertJsonPath('score', 7)
        ->assertJsonPath('statements.3', ['key' => 'vision', 'count' => 1, 'answeredBy' => [$participant->id]]);

    $this->actingAs($user)->deleteJson(route('retros.health-check.destroy', ['retro' => $retro, 'statement' => 'vision']))
        ->assertOk()
        ->assertJsonPath('statements.3', ['key' => 'vision', 'count' => 0, 'answeredBy' => []]);

    expect(HealthCheckAnswer::count())->toBe(0);
});

it('changes a score without duplicating the answer', function () {
    $retro = healthCheckRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'vision'), ['score' => 3])->assertOk();
    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'vision'), ['score' => 9])
        ->assertOk()
        ->assertJsonPath('statements.3.count', 1);

    expect(HealthCheckAnswer::sole()->score)->toBe(9);
});

it('lets guests answer', function () {
    $retro = healthCheckRetro(['guest_access_enabled' => true]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->putJson(healthAnswerRoute($retro, 'motivation'), ['score' => 10])
        ->assertOk();

    expect(HealthCheckAnswer::sole()->participant_id)->toBe($guest->id);
});

it('accepts scores from 1 to 10 only', function (mixed $score) {
    $retro = healthCheckRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'vision'), ['score' => $score])->assertUnprocessable()->assertJsonValidationErrors('score');
})->with([0, 11, 'high', null]);

it('returns 404 for statements outside the retro set', function (callable $statement) {
    $retro = healthCheckRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, $statement()), ['score' => 5])->assertNotFound();

    expect(HealthCheckAnswer::count())->toBe(0);
})->with([
    'unknown value' => [fn () => 'happiness'],
    'another team custom statement' => [fn () => TeamHealthStatement::factory()->create()->id],
]);

it('only accepts answers during the health check and while unlocked', function (RetroPhase $phase, array $attributes, int $status) {
    $retro = healthCheckRetro(['phase' => $phase, ...$attributes]);
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'vision'), ['score' => 5])->assertStatus($status);
})->with([
    'writing' => [RetroPhase::Writing, [], 403],
    'completed' => [RetroPhase::Completed, [], 403],
    'locked' => [RetroPhase::HealthCheck, ['is_locked' => true], 423],
]);

it('broadcasts counts and who answered, never a score', function () {
    $retro = healthCheckRetro();
    [$user, $participant] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'processes'), ['score' => 4])->assertOk();

    Event::assertDispatched(HealthAnswered::class, function (HealthAnswered $event) use ($participant) {
        $processes = collect($event->broadcastWith()['statements'])->firstWhere('key', 'processes');

        return $event->broadcastAs() === 'health.answered'
            && $processes === ['key' => 'processes', 'count' => 1, 'answeredBy' => [$participant->id]]
            && ! str_contains(json_encode($event->broadcastWith()), 'score');
    });
});

it('hides who answered on anonymous retros', function () {
    $retro = healthCheckRetro(['is_anonymous' => true]);
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'processes'), ['score' => 4])
        ->assertJsonPath('statements.4', ['key' => 'processes', 'count' => 1, 'answeredBy' => []]);

    Event::assertDispatched(HealthAnswered::class, fn (HealthAnswered $event) => collect($event->broadcastWith()['statements'])
        ->every(fn (array $statement) => $statement['answeredBy'] === []));
});

it('sends each viewer only their own score in the snapshot', function () {
    $retro = healthCheckRetro();
    [, $viewer] = retroMember($retro);
    [, $other] = retroMember($retro);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id, 'statement' => 'vision', 'score' => 2]);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $viewer->id, 'statement' => 'motivation', 'score' => 9]);

    $statements = collect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck']['statements'])->keyBy('key');

    expect(array_keys($statements['vision']))->toBe(['key', 'label', 'text', 'isBuiltin', 'count', 'answeredBy', 'myScore'])
        ->and($statements['vision']['count'])->toBe(1)
        ->and($statements['vision']['answeredBy'])->toBe([$other->id])
        ->and($statements['vision']['myScore'])->toBeNull()
        ->and($statements['motivation']['myScore'])->toBe(9)
        ->and($statements['motivation']['label'])->toBe('Motivation');
});

it('leaves the health check out of the snapshot when it is off and unanswered', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);

    expect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck'])->toBeNull();
});

it('presents built-in statements translated and custom statements as stored', function () {
    $retro = healthCheckRetro();
    [, $viewer] = retroMember($retro);
    RetroHealthStatement::factory()->custom()->create(['retro_id' => $retro->id, 'key' => 'custom-1', 'label' => 'Pairing', 'text' => 'We pair often.', 'position' => 99]);

    $statements = collect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck']['statements'])->keyBy('key');

    expect(collect($statements['vision'])->only(['key', 'label', 'text', 'isBuiltin'])->all())
        ->toBe(['key' => 'vision', 'label' => HealthStatement::Vision->label(), 'text' => HealthStatement::Vision->text(), 'isBuiltin' => true])
        ->and(collect($statements['custom-1'])->only(['key', 'label', 'text', 'isBuiltin'])->all())
        ->toBe(['key' => 'custom-1', 'label' => 'Pairing', 'text' => 'We pair often.', 'isBuiltin' => false]);
});

it('includes the health check in the snapshot when answers exist though it is off', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [, $viewer] = retroMember($retro);
    RetroHealthStatement::factory()->builtin(HealthStatement::Vision)->create(['retro_id' => $retro->id]);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $viewer->id, 'statement' => 'vision', 'score' => 6]);

    expect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck']['statements'][0]['myScore'])->toBe(6);
});
