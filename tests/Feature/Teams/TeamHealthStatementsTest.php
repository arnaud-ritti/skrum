<?php

use App\Enums\HealthStatement;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\User;
use App\Models\Workspace;

/**
 * @return array{0: User, 1: Workspace, 2: Team}
 */
function healthStatementTeam(WorkspaceRole $role = WorkspaceRole::Admin): array
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();
    $team = Team::factory()->for($workspace)->withMember($user)->create();

    return [$user, $workspace, $team];
}

/**
 * @param  array<string, string>  $parameters
 */
function healthStatementRoute(string $name, Team $team, array $parameters = []): string
{
    return route("teams.healthStatements.{$name}", ['workspace' => $team->workspace, 'team' => $team, ...$parameters]);
}

/**
 * @return array<int, string>
 */
function activeHealthKeys(Team $team): array
{
    return $team->healthStatements()->whereNull('archived_at')->get()->map(fn (TeamHealthStatement $statement) => $statement->key())->all();
}

it('adds a custom statement after materialising the six built-ins', function () {
    [$user, , $team] = healthStatementTeam();

    $this->actingAs($user)
        ->from(route('teams.show', [$team->workspace, $team]))
        ->post(healthStatementRoute('store', $team), ['text' => 'We shipped what we promised', 'label' => 'Delivery'])
        ->assertRedirect(route('teams.show', [$team->workspace, $team]))
        ->assertSessionHasNoErrors();

    $statements = $team->healthStatements()->get();

    expect($statements)->toHaveCount(7)
        ->and($statements->take(6)->map(fn (TeamHealthStatement $statement) => $statement->builtin?->value)->all())
        ->toBe(array_map(fn (HealthStatement $statement) => $statement->value, HealthStatement::cases()))
        ->and($statements->pluck('position')->all())->toBe([0, 1, 2, 3, 4, 5, 6])
        ->and($statements->last()->only(['text', 'label']))->toBe(['text' => 'We shipped what we promised', 'label' => 'Delivery']);
});

it('validates statement text and axis label lengths', function (array $payload, string $field) {
    [$user, , $team] = healthStatementTeam();

    $this->actingAs($user)->post(healthStatementRoute('store', $team), $payload)->assertSessionHasErrors($field);

    expect(TeamHealthStatement::count())->toBe(0);
})->with([
    'text too long' => [['text' => str_repeat('a', 151), 'label' => 'Axis'], 'text'],
    'label too long' => [['text' => 'Fine', 'label' => str_repeat('a', 31)], 'label'],
    'missing label' => [['text' => 'Fine'], 'label'],
]);

it('rewords a custom statement and keeps its id', function () {
    [$user, , $team] = healthStatementTeam();
    $custom = TeamHealthStatement::factory()->for($team)->create(['position' => 0]);
    TeamHealthStatement::factory()->for($team)->count(2)->create(['position' => 1]);

    $this->actingAs($user)
        ->patch(healthStatementRoute('update', $team, ['statement' => $custom->id]), ['text' => 'Reworded', 'label' => 'New axis'])
        ->assertSessionHasNoErrors();

    expect($custom->fresh()->only(['id', 'text', 'label']))->toBe(['id' => $custom->id, 'text' => 'Reworded', 'label' => 'New axis']);
});

it('refuses to reword a built-in statement', function () {
    [$user, , $team] = healthStatementTeam();

    $this->actingAs($user)
        ->patch(healthStatementRoute('update', $team, ['statement' => 'vision']), ['text' => 'Reworded', 'label' => 'Vision'])
        ->assertSessionHasErrors(['text' => 'Built-in statements cannot be reworded.']);

    expect(TeamHealthStatement::count())->toBe(0);
});

it('reorders active statements, addressing virtual built-ins by their value', function () {
    [$user, , $team] = healthStatementTeam();
    $reversed = array_reverse(array_map(fn (HealthStatement $statement) => $statement->value, HealthStatement::cases()));

    $this->actingAs($user)
        ->put(healthStatementRoute('order.update', $team), ['ids' => $reversed])
        ->assertSessionHasNoErrors();

    expect(activeHealthKeys($team))->toBe($reversed);

    $ids = $team->healthStatements()->pluck('id')->reverse()->values()->all();

    $this->actingAs($user)->put(healthStatementRoute('order.update', $team), ['ids' => $ids])->assertSessionHasNoErrors();

    expect(activeHealthKeys($team))->toBe(array_reverse($reversed));
});

it('refuses an order that does not list every active statement exactly once', function (array $ids) {
    [$user, , $team] = healthStatementTeam();

    $this->actingAs($user)->put(healthStatementRoute('order.update', $team), ['ids' => $ids])->assertSessionHasErrors('ids');
})->with([
    'missing one' => [['interaction', 'task_clarity', 'manager_support', 'vision', 'processes']],
    'duplicate' => [['interaction', 'interaction', 'task_clarity', 'manager_support', 'vision', 'processes']],
    'unknown' => [['interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'nope']],
]);

it('archives and restores a statement, restored ones going last', function () {
    [$user, , $team] = healthStatementTeam();

    $this->actingAs($user)->put(healthStatementRoute('archival.update', $team, ['statement' => 'interaction']))->assertSessionHasNoErrors();

    expect(activeHealthKeys($team))->not->toContain('interaction')
        ->and($team->healthStatements()->count())->toBe(6);

    $this->actingAs($user)->delete(healthStatementRoute('archival.destroy', $team, ['statement' => 'interaction']))->assertSessionHasNoErrors();

    expect(activeHealthKeys($team))->toBe(['task_clarity', 'manager_support', 'vision', 'processes', 'motivation', 'interaction']);
});

it('keeps between 3 and 10 active statements', function () {
    [$user, , $team] = healthStatementTeam();

    foreach (['interaction', 'task_clarity', 'manager_support'] as $statement) {
        $this->actingAs($user)->put(healthStatementRoute('archival.update', $team, ['statement' => $statement]))->assertSessionHasNoErrors();
    }

    $this->actingAs($user)
        ->put(healthStatementRoute('archival.update', $team, ['statement' => 'vision']))
        ->assertSessionHasErrors(['statements' => 'A team needs between 3 and 10 health check statements.']);

    foreach (range(1, 7) as $number) {
        $this->actingAs($user)->post(healthStatementRoute('store', $team), ['text' => "Custom {$number}", 'label' => "Axis {$number}"])->assertSessionHasNoErrors();
    }

    expect(activeHealthKeys($team))->toHaveCount(10);

    $this->actingAs($user)
        ->post(healthStatementRoute('store', $team), ['text' => 'One too many', 'label' => 'Extra'])
        ->assertSessionHasErrors(['statements' => 'A team needs between 3 and 10 health check statements.']);

    $this->actingAs($user)
        ->delete(healthStatementRoute('archival.destroy', $team, ['statement' => 'interaction']))
        ->assertSessionHasErrors(['statements' => 'A team needs between 3 and 10 health check statements.']);
});

it('caps a team at 30 statements including archived ones', function () {
    [$user, , $team] = healthStatementTeam();
    TeamHealthStatement::factory()->for($team)->count(3)->create();
    TeamHealthStatement::factory()->for($team)->archived()->count(27)->create();

    $this->actingAs($user)
        ->post(healthStatementRoute('store', $team), ['text' => 'Thirty-first', 'label' => 'Extra'])
        ->assertSessionHasErrors(['text' => 'A team can have at most 30 health check statements, archived ones included.']);
});

it('lets only workspace owners and admins manage statements', function () {
    [$member, , $team] = healthStatementTeam(WorkspaceRole::Member);

    $this->actingAs($member)->post(healthStatementRoute('store', $team), ['text' => 'Nope', 'label' => 'Nope'])->assertForbidden();
    $this->actingAs($member)->patch(healthStatementRoute('update', $team, ['statement' => 'vision']), ['text' => 'Nope', 'label' => 'Nope'])->assertForbidden();
    $this->actingAs($member)->put(healthStatementRoute('order.update', $team), ['ids' => []])->assertForbidden();
    $this->actingAs($member)->put(healthStatementRoute('archival.update', $team, ['statement' => 'vision']))->assertForbidden();
    $this->actingAs($member)->delete(healthStatementRoute('archival.destroy', $team, ['statement' => 'vision']))->assertForbidden();

    [$outsider] = healthStatementTeam();

    $this->actingAs($outsider)->post(healthStatementRoute('store', $team), ['text' => 'Nope', 'label' => 'Nope'])->assertForbidden();

    expect(TeamHealthStatement::count())->toBe(0);
});

it('returns 404 for statements of another team or unknown values', function (callable $statement) {
    [$user, , $team] = healthStatementTeam();
    $foreign = TeamHealthStatement::factory()->create();

    $this->actingAs($user)
        ->put(healthStatementRoute('archival.update', $team, ['statement' => $statement($foreign)]))
        ->assertNotFound();
})->with([
    'another team' => [fn (TeamHealthStatement $foreign) => $foreign->id],
    'unknown value' => [fn () => 'happiness'],
]);
