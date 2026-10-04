<?php

use App\Actions\ActionItems\ActionItemFilters;
use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 12:00:00'));
});

/**
 * Eight items of one team, named by what the filters should find.
 *
 * @return array{0: Team, 1: User}
 */
function actionItemFilterFixture(): array
{
    $team = Team::factory()->create();
    $user = teamMember($team);
    $outside = fn (string $content, array $attributes = []) => ActionItem::factory()->withoutRetro($team, $user)->create(['content' => $content, ...$attributes]);

    $outside('todo high', ['priority' => ActionItemPriority::High]);
    $outside('doing week', ['due_on' => '2026-10-12', 'started_at' => '2026-10-09 10:00:00']);
    $outside('done low', ['priority' => ActionItemPriority::Low, 'completed_at' => '2026-10-09 10:00:00', 'due_on' => '2026-10-01']);
    $outside('overdue low', ['priority' => ActionItemPriority::Low, 'due_on' => '2026-10-08']);
    $outside('today', ['due_on' => '2026-10-10']);
    $outside('last day of week', ['due_on' => '2026-10-16']);
    $outside('later', ['due_on' => '2026-10-17']);
    ActionItem::factory()->create(['retro_id' => Retro::factory()->create(['team_id' => $team->id])->id, 'content' => 'from retro']);

    return [$team, $user];
}

/**
 * @param  array<string, string>  $query
 * @return array<int, string>
 */
function filteredContents(Team $team, User $user, array $query): array
{
    $items = test()->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, ...$query]))
        ->assertOk()
        ->viewData('page')['props']['items']['data'];

    return collect($items)->pluck('content')->sort()->values()->all();
}

it('filters by status, several at once', function (array $query, array $expected) {
    [$team, $user] = actionItemFilterFixture();

    expect(filteredContents($team, $user, $query))->toBe(collect($expected)->sort()->values()->all());
})->with([
    'default: to do and in progress' => [[], ['todo high', 'doing week', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
    'to do' => [['status' => 'todo'], ['todo high', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
    'in progress' => [['status' => 'doing'], ['doing week']],
    'done' => [['status' => 'completed'], ['done low']],
    'every status' => [['status' => 'todo,doing,completed'], ['todo high', 'doing week', 'done low', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
    'unknown falls back' => [['status' => 'someday'], ['todo high', 'doing week', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
]);

it('reads the single values of before as before', function (string $status, array $expected) {
    [$team, $user] = actionItemFilterFixture();

    expect(filteredContents($team, $user, ['status' => $status]))->toBe(collect($expected)->sort()->values()->all());
})->with([
    'open' => ['open', ['todo high', 'doing week', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
    'overdue' => ['overdue', ['overdue low']],
    'completed' => ['completed', ['done low']],
    'all' => ['all', ['todo high', 'doing week', 'done low', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
]);

it('filters by priority, due date and source', function (array $query, array $expected) {
    [$team, $user] = actionItemFilterFixture();

    expect(filteredContents($team, $user, $query))->toBe(collect($expected)->sort()->values()->all());
})->with([
    'priorities' => [['priority' => 'high,low'], ['todo high', 'overdue low']],
    'unknown priority ignored' => [['priority' => 'urgent'], ['todo high', 'doing week', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
    'overdue' => [['due' => 'overdue'], ['overdue low']],
    'overdue never lists done items' => [['due' => 'overdue', 'status' => 'completed'], []],
    'today' => [['due' => 'today'], ['today']],
    'next 7 days' => [['due' => 'week'], ['doing week', 'today', 'last day of week']],
    'later' => [['due' => 'later'], ['later']],
    'no due date' => [['due' => 'none'], ['todo high', 'from retro']],
    'from a retro' => [['source' => 'retro'], ['from retro']],
    'outside a retro' => [['source' => 'outside'], ['todo high', 'doing week', 'overdue low', 'today', 'last day of week', 'later']],
    'combined' => [['status' => 'todo,completed', 'priority' => 'low', 'source' => 'outside'], ['done low', 'overdue low']],
]);

it('gives the filters back in their canonical form', function () {
    [$team, $user] = actionItemFilterFixture();

    $filters = $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'status' => 'doing,todo,doing', 'priority' => 'low,high,low', 'due' => 'week', 'source' => 'nowhere']))
        ->viewData('page')['props']['filters'];

    expect($filters)->toBe([
        'status' => ['todo', 'doing'],
        'priority' => ['high', 'low'],
        'due' => 'week',
        'source' => null,
        'q' => null,
        'assignee' => null,
        'team' => null,
        'item' => null,
    ]);

    $legacy = $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'status' => 'overdue']))
        ->viewData('page')['props']['filters'];

    expect($legacy['status'])->toBe(['todo', 'doing'])->and($legacy['due'])->toBe('overdue');
});

it('reads the same filters from an array as from the query', function () {
    $team = Team::factory()->create();
    $hidden = Team::factory()->create(['workspace_id' => $team->workspace_id]);

    expect(ActionItemFilters::fromQuery(['status' => 'overdue', 'priority' => 'low,high', 'team' => $hidden->id, 'source' => 7], collect([$team]))->toArray())->toBe([
        'status' => ['todo', 'doing'],
        'priority' => ['high', 'low'],
        'due' => 'overdue',
        'source' => null,
        'q' => null,
        'assignee' => null,
        'team' => null,
        'item' => null,
    ])->and(ActionItemFilters::fromQuery([], collect([$team]))->toArray()['status'])->toBe(['todo', 'doing']);
});

it('counts under team, assignee, priority and source, whatever the status and the due date', function () {
    [$team, $user] = actionItemFilterFixture();
    $counts = fn (array $query) => $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, ...$query]))
        ->viewData('page')['props']['counts'];

    expect($counts([]))->toBe(['open' => 7, 'overdue' => 1, 'completed' => 1, 'mine' => 0, 'rituals' => 1])
        ->and($counts(['status' => 'completed', 'due' => 'today']))->toBe($counts([]))
        ->and($counts(['priority' => 'low']))->toBe(['open' => 1, 'overdue' => 1, 'completed' => 1, 'mine' => 0, 'rituals' => 0])
        ->and($counts(['source' => 'retro']))->toBe(['open' => 1, 'overdue' => 0, 'completed' => 0, 'mine' => 0, 'rituals' => 1]);
});
