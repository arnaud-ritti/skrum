<?php

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Events\Retros\RetroSettingsChanged;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * The statements of the retro's health check, whether shown or removed.
 *
 * @return array<int, string>
 */
function frozenHealthKeys(Retro $retro): array
{
    $survey = TeamSurvey::query()->where('retro_id', $retro->id)->first();

    return $survey === null ? [] : $survey->questions()->pluck('match_key')->all();
}

/**
 * @return array<int, string>
 */
function builtinHealthKeys(): array
{
    return array_map(fn (HealthStatement $statement) => $statement->value, HealthStatement::cases());
}

it('freezes the six built-ins when a retro is created with the health check', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Member)->create();
    $team = Team::factory()->for($workspace)->withMember($user)->create();

    $this->actingAs($user)->post(route('teams.retros.store', [$workspace, $team]), [
        'title' => 'Sprint 12',
        'template' => 'start_stop_continue',
        'health_check_enabled' => true,
    ])->assertRedirect();

    $retro = $team->retros()->sole();
    $questions = resolve(HealthCheckSurvey::class)->forRetro($retro)->questions()->get();

    expect($retro->phase)->toBe(RetroPhase::Writing)
        ->and(frozenHealthKeys($retro))->toBe(builtinHealthKeys())
        ->and($questions->map(fn ($question) => $question->builtin)->all())->toBe(HealthStatement::cases())
        ->and($questions->first()->only(['label', 'short_label', 'scale_max', 'is_required']))->toBe([
            'label' => HealthStatement::Interaction->text(),
            'short_label' => HealthStatement::Interaction->label(),
            'scale_max' => 5,
            'is_required' => true,
        ]);
});

it('freezes nothing for a retro created without the health check', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Member)->create();
    $team = Team::factory()->for($workspace)->withMember($user)->create();

    $this->actingAs($user)->post(route('teams.retros.store', [$workspace, $team]), [
        'title' => 'Sprint 12',
        'template' => 'start_stop_continue',
    ])->assertRedirect();

    expect(TeamSurvey::query()->count())->toBe(0);
});

it('freezes the team active statements, custom ones with their text and id', function () {
    $retro = Retro::factory()->create();
    $manage = resolve(ManageTeamHealthStatements::class);
    $custom = $manage->add($retro->team, 'We shipped what we promised', 'Delivery');
    $manage->archive($retro->team, 'manager_support');

    $questions = attachHealthCheck($retro)->questions()->get();

    expect($questions->pluck('match_key')->all())->toBe(['interaction', 'task_clarity', 'vision', 'processes', 'motivation', $custom->id])
        ->and($questions->pluck('position')->all())->toBe([0, 1, 2, 3, 4, 5])
        ->and($questions->last()->only(['builtin', 'label', 'short_label', 'scale_max', 'is_required']))->toBe([
            'builtin' => null,
            'label' => 'We shipped what we promised',
            'short_label' => 'Delivery',
            'scale_max' => 5,
            'is_required' => true,
        ]);
});

it('freezes the set when the facilitator turns the health check on', function () {
    $retro = Retro::factory()->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->postJson(route('retros.healthCheck.store', $retro))->assertCreated();

    expect(frozenHealthKeys($retro))->toBe(builtinHealthKeys());
});

it('refreshes an unanswered set when the health check is turned on again', function () {
    $retro = Retro::factory()->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->postJson(route('retros.healthCheck.store', $retro))->assertCreated();

    $this->actingAs($user)->deleteJson(route('retros.healthCheck.destroy', $retro))->assertNoContent();

    $custom = resolve(ManageTeamHealthStatements::class)->add($retro->team, 'New question', 'New');

    $this->actingAs($user)->postJson(route('retros.healthCheck.store', $retro))->assertCreated();

    expect(frozenHealthKeys($retro))->toBe([...builtinHealthKeys(), $custom->id]);
});

it('keeps the frozen set once answered, whatever the team changes', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroFacilitator($retro);

    $this->actingAs($user)->postJson(route('retros.healthCheck.store', $retro))->assertCreated();

    answerHealthCheck($retro, $participant, ['vision' => 4]);

    $manage = resolve(ManageTeamHealthStatements::class);
    $manage->archive($retro->team, 'vision');
    $manage->add($retro->team, 'Added later', 'Later');

    $this->actingAs($user)->deleteJson(route('retros.healthCheck.destroy', $retro))->assertNoContent();
    $this->actingAs($user)->postJson(route('retros.healthCheck.store', $retro))->assertCreated();

    $vision = resolve(HealthCheckSurvey::class)->forRetro($retro)->questions()->where('match_key', 'vision')->sole();

    expect(frozenHealthKeys($retro))->toBe(builtinHealthKeys())
        ->and($vision->answers()->sole()->value)->toBe(4);
});

it('re-freezes unanswered enabled retros when the team edits its statements', function () {
    $retro = Retro::factory()->withHealthCheck()->create();

    $manage = resolve(ManageTeamHealthStatements::class);
    $custom = $manage->add($retro->team, 'Added later', 'Later');

    expect(frozenHealthKeys($retro))->toBe([...builtinHealthKeys(), $custom->id]);

    $manage->archive($retro->team, 'vision');

    expect(frozenHealthKeys($retro))->not->toContain('vision')->toContain($custom->id);
});

it('broadcasts a settings change to open boards when a team edit re-freezes a retro', function () {
    $retro = Retro::factory()->withHealthCheck()->create();

    resolve(ManageTeamHealthStatements::class)->add($retro->team, 'Added later', 'Later');

    Event::assertDispatched(fn (RetroSettingsChanged $event) => $event->retroId === $retro->id);
});

it('keeps the set of a retro that has answers when the team edits its statements', function () {
    $retro = Retro::factory()->withHealthCheck()->create();
    [, $participant] = retroFacilitator($retro);
    answerHealthCheck($retro, $participant, ['vision' => 4]);

    resolve(ManageTeamHealthStatements::class)->add($retro->team, 'Added later', 'Later');

    expect(frozenHealthKeys($retro))->toBe(builtinHealthKeys());
});

it('leaves completed retros untouched when the team edits its statements', function () {
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    closeHealthCheck($retro);

    resolve(ManageTeamHealthStatements::class)->add($retro->team, 'Added later', 'Later');

    expect(frozenHealthKeys($retro))->toBe(builtinHealthKeys());
});

it('leaves retros without the health check untouched when the team edits its statements', function () {
    $retro = Retro::factory()->create();

    resolve(ManageTeamHealthStatements::class)->add($retro->team, 'Added later', 'Later');

    expect(frozenHealthKeys($retro))->toBeEmpty();
});
