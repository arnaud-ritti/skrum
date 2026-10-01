<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Events\Retros\RetroSettingsChanged;
use App\Models\HealthCheckAnswer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array<int, string>
 */
function frozenHealthKeys(Retro $retro): array
{
    return $retro->healthStatements()->orderBy('position')->pluck('key')->all();
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

    expect($retro->phase)->toBe(RetroPhase::HealthCheck)
        ->and(frozenHealthKeys($retro))->toBe(builtinHealthKeys());
});

it('freezes nothing for a retro created without the health check', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Member)->create();
    $team = Team::factory()->for($workspace)->withMember($user)->create();

    $this->actingAs($user)->post(route('teams.retros.store', [$workspace, $team]), [
        'title' => 'Sprint 12',
        'template' => 'start_stop_continue',
    ])->assertRedirect();

    expect(frozenHealthKeys($team->retros()->sole()))->toBeEmpty();
});

it('freezes the team active statements, custom ones with their text and id', function () {
    $retro = Retro::factory()->create();
    $manage = resolve(ManageTeamHealthStatements::class);
    $custom = $manage->add($retro->team, 'We shipped what we promised', 'Delivery');
    $manage->archive($retro->team, 'manager_support');

    resolve(FreezeHealthStatements::class)->handle($retro);

    $frozen = $retro->healthStatements()->orderBy('position')->get();

    expect($frozen->pluck('key')->all())->toBe(['interaction', 'task_clarity', 'vision', 'processes', 'motivation', $custom->id])
        ->and($frozen->pluck('position')->all())->toBe([0, 1, 2, 3, 4, 5])
        ->and($frozen->last()->only(['team_health_statement_id', 'text', 'label']))->toBe([
            'team_health_statement_id' => $custom->id,
            'text' => 'We shipped what we promised',
            'label' => 'Delivery',
        ]);
});

it('freezes the set when the facilitator turns the health check on', function () {
    $retro = Retro::factory()->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['health_check_enabled' => true])->assertNoContent();

    expect(frozenHealthKeys($retro))->toBe(builtinHealthKeys());
});

it('refreshes an unanswered set when the health check is turned on again', function () {
    $retro = Retro::factory()->create();
    [$user] = retroFacilitator($retro);
    $settings = route('retros.settings.update', $retro);

    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => true])->assertNoContent();

    $custom = resolve(ManageTeamHealthStatements::class)->add($retro->team, 'New question', 'New');

    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => false])->assertNoContent();
    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => true])->assertNoContent();

    expect(frozenHealthKeys($retro))->toBe([...builtinHealthKeys(), $custom->id]);
});

it('keeps the frozen set once answered, whatever the team changes', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroFacilitator($retro);
    $settings = route('retros.settings.update', $retro);

    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => true])->assertNoContent();

    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'statement' => 'vision', 'score' => 8]);

    $manage = resolve(ManageTeamHealthStatements::class);
    $manage->archive($retro->team, 'vision');
    $manage->add($retro->team, 'Added later', 'Later');

    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => false])->assertNoContent();
    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => true])->assertNoContent();

    expect(frozenHealthKeys($retro))->toBe(builtinHealthKeys())
        ->and($retro->healthCheckAnswers()->sole()->only(['statement', 'score']))->toBe(['statement' => 'vision', 'score' => 8]);
});

it('re-freezes unanswered enabled retros when the team edits its statements', function () {
    $retro = Retro::factory()->withHealthCheck()->create();
    resolve(FreezeHealthStatements::class)->handle($retro);

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
    resolve(FreezeHealthStatements::class)->handle($retro);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'statement' => 'vision', 'score' => 8]);

    resolve(ManageTeamHealthStatements::class)->add($retro->team, 'Added later', 'Later');

    expect(frozenHealthKeys($retro))->toBe(builtinHealthKeys());
});

it('leaves completed retros untouched when the team edits its statements', function () {
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();
    resolve(FreezeHealthStatements::class)->handle($retro);

    resolve(ManageTeamHealthStatements::class)->add($retro->team, 'Added later', 'Later');

    expect(frozenHealthKeys($retro))->toBe(builtinHealthKeys());
});

it('leaves retros without the health check untouched when the team edits its statements', function () {
    $retro = Retro::factory()->create(['health_check_enabled' => false]);

    resolve(ManageTeamHealthStatements::class)->add($retro->team, 'Added later', 'Later');

    expect(frozenHealthKeys($retro))->toBeEmpty();
});
