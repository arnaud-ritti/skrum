<?php

use App\Enums\ActionItemStatus;
use App\Models\ActionItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('reads every row from before the column as to do or done, with its rank unchanged', function () {
    $migration = '2026_10_24_100000_add_started_at_to_action_items.php';
    migrateBefore($migration);

    $workspace = (string) Str::uuid7();
    $team = (string) Str::uuid7();
    DB::table('workspaces')->insert(['id' => $workspace, 'name' => 'Acme', 'slug' => 'acme', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('teams')->insert(['id' => $team, 'workspace_id' => $workspace, 'name' => 'Platform', 'created_at' => now(), 'updated_at' => now()]);
    $row = fn (string $content, array $values) => DB::table('action_items')->insert([
        'id' => (string) Str::uuid7(),
        'team_id' => $team,
        'content' => $content,
        'content_search' => $content,
        'priority' => 'medium',
        'created_at' => '2026-09-01 10:00:00',
        'updated_at' => '2026-09-01 10:00:00',
        ...$values,
    ]);

    $row('open', ['sort_rank' => 1_000_000_001]);
    $row('done', ['completed_at' => '2026-09-02 10:00:00', 'sort_rank' => ActionItem::CompletedSortRank]);

    runMigration($migration);

    $items = ActionItem::query()->orderBy('content')->get()->keyBy('content');

    expect($items['open']->currentStatus())->toBe(ActionItemStatus::Open)
        ->and($items['done']->currentStatus())->toBe(ActionItemStatus::Completed)
        ->and($items['open']->started_at)->toBeNull()
        ->and($items->map(fn (ActionItem $item): int => $item->sort_rank)->all())
        ->toBe(['done' => ActionItem::CompletedSortRank, 'open' => 1_000_000_001]);
});
