<?php

use App\Actions\Teams\StartNextSprint;
use App\Enums\TeamRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSprint;
use Carbon\CarbonImmutable;

/**
 * @param  array<string, mixed>  $override
 * @return array<string, mixed>
 */
function sprintBody(array $override = []): array
{
    return ['number' => 42, 'starts_on' => '2026-09-21', 'ends_on' => '2026-10-04', ...$override];
}

it('lets a facilitator add a sprint and refuses a member', function () {
    $team = Team::factory()->create();
    $route = route('teams.sprints.store', [$team->workspace, $team]);

    $this->actingAs(teamMember($team))->post($route, sprintBody())->assertForbidden();
    $this->actingAs(teamMember($team, TeamRole::Facilitator))->post($route, sprintBody())->assertRedirect();

    expect($team->sprints()->sole()->present())->toMatchArray(['number' => 42, 'startsOn' => '2026-09-21', 'endsOn' => '2026-10-04']);
});

it('validates a sprint', function (array $override, string $field) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team, TeamRole::Owner))
        ->post(route('teams.sprints.store', [$team->workspace, $team]), sprintBody($override))
        ->assertSessionHasErrors($field);
})->with([
    'number zero' => [['number' => 0], 'number'],
    'not a day' => [['starts_on' => '21/09/2026'], 'starts_on'],
    'ends before it starts' => [['ends_on' => '2026-09-20'], 'ends_on'],
    'longer than eight weeks' => [['ends_on' => '2026-11-16'], 'ends_on'],
]);

it('refuses a sprint that overlaps another or reuses its number, and lets a sprint keep its own days', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $sprint = teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $store = route('teams.sprints.store', [$team->workspace, $team]);

    $this->actingAs($owner)->post($store, sprintBody(['number' => 43, 'starts_on' => '2026-10-04', 'ends_on' => '2026-10-17']))->assertSessionHasErrors('starts_on');
    $this->actingAs($owner)->post($store, sprintBody(['starts_on' => '2026-10-05', 'ends_on' => '2026-10-18']))->assertSessionHasErrors('number');
    $this->actingAs($owner)->patch(route('teams.sprints.update', [$team->workspace, $team, $sprint]), sprintBody(['ends_on' => '2026-10-03']))->assertRedirect();

    expect($team->sprints()->count())->toBe(1)
        ->and($sprint->fresh()->ends_on->toDateString())->toBe('2026-10-03');
});

it('answers 404 for a sprint of another team', function () {
    $team = Team::factory()->create();
    $other = teamSprint(Team::factory()->for($team->workspace)->create(), 1, '2026-09-21', '2026-10-04');

    $this->actingAs(teamMember($team, TeamRole::Owner))
        ->delete(route('teams.sprints.destroy', [$team->workspace, $team, $other]))
        ->assertNotFound();
});

it('deletes a sprint, and the sessions of its days lose its label and nothing else', function () {
    $team = Team::factory()->create();
    $sprint = teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));
    $retro = Retro::factory()->for($team)->create();
    [$viewer] = retroMember($retro);

    $this->actingAs(teamMember($team, TeamRole::Facilitator))->delete(route('teams.sprints.destroy', [$team->workspace, $team, $sprint]))->assertRedirect();

    expect(TeamSprint::query()->count())->toBe(0)->and($retro->fresh())->not->toBeNull();
    $this->actingAs($viewer)->getJson(route('retros.snapshot.show', $retro))->assertJsonPath('retro.sprintNumber', null);
});

it('starts the next sprint today, ending the current one yesterday', function () {
    $team = Team::factory()->create();
    teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));

    $this->actingAs(teamMember($team, TeamRole::Facilitator))
        ->post(route('teams.sprintStarts.store', [$team->workspace, $team]))
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($team->sprints()->get()->map->present()->map(fn (array $sprint): array => [$sprint['number'], $sprint['startsOn'], $sprint['endsOn']])->all())
        ->toBe([[42, '2026-09-21', '2026-09-29'], [43, '2026-09-30', '2026-10-13']]);
});

it('starts sprint 1 of a team without sprints, with the team default length', function () {
    $team = Team::factory()->create(['sprint_length_weeks' => 1]);
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));

    $this->actingAs(teamMember($team, TeamRole::Owner))->post(route('teams.sprintStarts.store', [$team->workspace, $team]))->assertRedirect();

    expect($team->sprints()->sole()->present())->toMatchArray(['number' => 1, 'startsOn' => '2026-09-30', 'endsOn' => '2026-10-06']);
});

it('refuses to start a sprint when one starts today or one is planned', function (string $startsOn) {
    $team = Team::factory()->create();
    teamSprint($team, 44, $startsOn, '2026-11-01');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));

    $this->actingAs(teamMember($team, TeamRole::Owner))
        ->post(route('teams.sprintStarts.store', [$team->workspace, $team]))
        ->assertSessionHasErrors('sprint');

    expect($team->sprints()->count())->toBe(1);
})->with(['starts today' => ['2026-09-30'], 'planned' => ['2026-10-19']]);

it('refuses a member who starts the next sprint', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))->post(route('teams.sprintStarts.store', [$team->workspace, $team]))->assertForbidden();

    expect($team->sprints()->count())->toBe(0);
});

it('previews the next start and its refusal', function () {
    $team = Team::factory()->create();
    teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $start = resolve(StartNextSprint::class);

    expect($start->preview($team, CarbonImmutable::parse('2026-09-30 10:00', 'UTC')))
        ->toBe(['number' => 43, 'startsOn' => '2026-09-30', 'endsOn' => '2026-10-13', 'refusal' => null])
        ->and($start->preview($team, CarbonImmutable::parse('2026-09-21 10:00', 'UTC'))['refusal'])->toBe('Sprint 42 already starts today.');
});

it('saves the default length, the retro day and its time, and validates them', function () {
    $team = Team::factory()->create();
    $route = route('teams.rituals.update', [$team->workspace, $team]);
    $facilitator = teamMember($team, TeamRole::Facilitator);

    $this->actingAs(teamMember($team))->put($route, ['sprint_length_weeks' => 2])->assertForbidden();
    $this->actingAs($facilitator)->put($route, ['sprint_length_weeks' => 5])->assertSessionHasErrors('sprint_length_weeks');
    $this->actingAs($facilitator)->put($route, ['retro_weekday' => null, 'retro_time' => '14:00'])->assertSessionHasErrors('retro_time');
    $this->actingAs($facilitator)->put($route, ['retro_weekday' => 8])->assertSessionHasErrors('retro_weekday');
    $this->actingAs($facilitator)->put($route, ['sprint_length_weeks' => 3, 'retro_weekday' => 4, 'retro_time' => '14:00'])->assertRedirect();

    expect($team->fresh()->only(['sprint_length_weeks', 'retro_weekday', 'retro_time']))
        ->toBe(['sprint_length_weeks' => 3, 'retro_weekday' => 4, 'retro_time' => '14:00']);
});
