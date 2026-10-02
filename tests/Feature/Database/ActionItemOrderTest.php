<?php

use App\Actions\ActionItems\ActionItemFilters;
use App\Actions\ActionItems\ActionItemQuery;
use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

function orderedTitles(Team $team): array
{
    return ActionItemQuery::order(ActionItem::query()->where('team_id', $team->id))->pluck('content')->all();
}

it('computes the rank from the state, the due date and the priority', function (bool $isCompleted, ?string $dueOn, ?ActionItemPriority $priority, int $rank) {
    expect(ActionItem::sortRankFor($isCompleted, $dueOn, $priority))->toBe($rank);
})->with([
    'open, due, high' => [false, '2026-10-05', ActionItemPriority::High, 202610050],
    'open, due, low' => [false, '2026-10-05', ActionItemPriority::Low, 202610052],
    'open, due, a date with a time' => [false, '2026-10-05 00:00:00', ActionItemPriority::Medium, 202610051],
    'open, no date, medium' => [false, null, ActionItemPriority::Medium, 1_000_000_001],
    'open, no date, unknown priority' => [false, null, null, 1_000_000_002],
    'completed, whatever the rest' => [true, '2026-10-05', ActionItemPriority::High, 2_000_000_000],
]);

it('lists open items by due date then priority, undated ones after, completed ones last by completion', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 09:00:00'));
    $team = Team::factory()->create();
    $member = teamMember($team);
    $item = fn (string $content, array $attributes) => ActionItem::factory()->withoutRetro($team, $member)->create(['content' => $content, ...$attributes]);

    $item('completed yesterday', ['completed_at' => '2026-10-09 10:00:00', 'due_on' => '2026-10-01']);
    $item('undated low', ['due_on' => null, 'priority' => ActionItemPriority::Low]);
    $item('due tomorrow medium', ['due_on' => '2026-10-11', 'priority' => ActionItemPriority::Medium]);
    $item('overdue low', ['due_on' => '2026-10-02', 'priority' => ActionItemPriority::Low]);
    $item('completed today', ['completed_at' => '2026-10-10 08:00:00', 'due_on' => null]);
    $item('due tomorrow high', ['due_on' => '2026-10-11', 'priority' => ActionItemPriority::High]);
    $item('undated high', ['due_on' => null, 'priority' => ActionItemPriority::High]);

    expect(orderedTitles($team))->toBe([
        'overdue low',
        'due tomorrow high',
        'due tomorrow medium',
        'undated high',
        'undated low',
        'completed today',
        'completed yesterday',
    ]);
});

it('moves an item when its state, its date or its priority changes', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $first = ActionItem::factory()->withoutRetro($team, $member)->create(['content' => 'first', 'due_on' => '2026-10-11']);
    $second = ActionItem::factory()->withoutRetro($team, $member)->create(['content' => 'second', 'due_on' => '2026-10-12']);

    $first->update(['due_on' => null]);
    expect(orderedTitles($team))->toBe(['second', 'first']);

    $second->update(['completed_at' => now()]);
    expect(orderedTitles($team))->toBe(['first', 'second']);

    $second->update(['completed_at' => null, 'due_on' => null, 'priority' => ActionItemPriority::High]);
    $first->update(['priority' => ActionItemPriority::Low]);
    expect(orderedTitles($team))->toBe(['second', 'first']);
});

it('keeps the order across the page boundary', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    foreach (range(1, ActionItemQuery::PerPage + 1) as $day) {
        ActionItem::factory()->withoutRetro($team, $member)->create(['content' => "item {$day}", 'due_on' => CarbonImmutable::parse('2027-01-01')->addDays($day)->toDateString()]);
    }

    $query = fn () => ActionItemQuery::order(ActionItem::query()->where('team_id', $team->id));

    expect($query()->paginate(ActionItemQuery::PerPage, ['*'], 'page', 1)->first()->content)->toBe('item 1')
        ->and($query()->paginate(ActionItemQuery::PerPage, ['*'], 'page', 2)->pluck('content')->all())->toBe(['item '.(ActionItemQuery::PerPage + 1)]);
});

it('stores a rank on every row', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-05', 'priority' => ActionItemPriority::High]);

    expect((int) DB::table('action_items')->where('id', $item->id)->value('sort_rank'))->toBe(202610050);
});

it('leaves no database default on the rank', function () {
    expect(collect(Schema::getColumns('action_items'))->firstWhere('name', 'sort_rank')['default'])->toBeNull();
});

it('refuses a row written without a rank', function () {
    $item = ActionItem::factory()->create();
    $row = (array) DB::table('action_items')->where('id', $item->id)->first();
    unset($row['sort_rank']);

    expect(fn () => DB::table('action_items')->insert([...$row, 'id' => (string) Str::uuid7()]))
        ->toThrow(QueryException::class);
});

it('counts open, overdue, completed, mine and rituals', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 09:00:00'));
    $team = Team::factory()->create();
    $member = teamMember($team);
    $admin = workspaceManager($team->workspace);

    ActionItem::factory()->withoutRetro($team, $member)->create(['due_on' => '2026-10-02', 'assignee_user_id' => $admin->id]);
    ActionItem::factory()->withoutRetro($team, $member)->create(['due_on' => null]);
    ActionItem::factory()->withoutRetro($team, $member)->create(['completed_at' => now()]);
    ActionItem::factory()->create(['retro_id' => Retro::factory()->create(['team_id' => $team->id])->id]);

    $counts = resolve(ActionItemQuery::class)->counts($admin, $team->workspace, new ActionItemFilters);

    expect($counts)->toBe(['open' => 3, 'overdue' => 1, 'completed' => 1, 'mine' => 1, 'rituals' => 1]);
});

it('stores the rank when model events are faked or muted', function () {
    Event::fake();
    $item = ActionItem::factory()->create(['due_on' => '2026-10-05', 'priority' => ActionItemPriority::Low]);

    expect($item->refresh()->sort_rank)->toBe(202610052);

    $item->completed_at = now();
    $item->saveQuietly();

    expect($item->refresh()->sort_rank)->toBe(ActionItem::CompletedSortRank);
});

it('keeps the rank of an item read without its state and saved', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-05', 'priority' => ActionItemPriority::High]);

    ActionItem::query()->select(['id', 'content'])->findOrFail($item->id)->update(['content' => 'reworded']);

    expect((int) DB::table('action_items')->where('id', $item->id)->value('sort_rank'))->toBe(202610050);
});

it('ranks a new item saved without a priority as the medium one it is stored as', function () {
    $item = ActionItem::query()->create(Arr::except(ActionItem::factory()->raw(['due_on' => null]), ['priority']));

    expect($item->refresh()->priority)->toBe(ActionItemPriority::Medium)
        ->and($item->sort_rank)->toBe(1_000_000_001);
});

it('lists items of the same rank newest first, then by id', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $item = fn (string $id, string $content, string $createdAt, array $attributes = []) => ActionItem::factory()->withoutRetro($team, $member)->create([
        'id' => $id,
        'content' => $content,
        'due_on' => '2026-10-11',
        'created_at' => $createdAt,
        ...$attributes,
    ]);
    $completed = ['completed_at' => '2026-10-12 09:00:00'];

    $item('01a00000-0000-7000-8000-00000000000b', 'older, later id', '2026-10-01 10:00:00');
    $item('01a00000-0000-7000-8000-00000000000a', 'older, earlier id', '2026-10-01 10:00:00');
    $item('01a00000-0000-7000-8000-000000000001', 'newer', '2026-10-02 10:00:00');
    $item('01a00000-0000-7000-8000-00000000000d', 'completed, later id', '2026-10-01 10:00:00', $completed);
    $item('01a00000-0000-7000-8000-00000000000c', 'completed, earlier id', '2026-10-01 10:00:00', $completed);

    expect(orderedTitles($team))->toBe(['newer', 'older, earlier id', 'older, later id', 'completed, earlier id', 'completed, later id']);
});
