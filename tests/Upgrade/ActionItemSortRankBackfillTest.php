<?php

use App\Actions\ActionItems\ActionItemQuery;
use App\Models\ActionItem;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('ranks the rows that existed before the column, by running the migration itself', function () {
    $migration = '2026_10_19_100500_add_sort_rank_to_action_items.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $workspace = (string) Str::uuid7();
    $team = (string) Str::uuid7();
    DB::table('workspaces')->insert(['id' => $workspace, 'name' => 'Acme', 'slug' => 'acme', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('teams')->insert(['id' => $team, 'workspace_id' => $workspace, 'name' => 'Platform', 'created_at' => now(), 'updated_at' => now()]);
    $row = fn (string $content, array $values) => DB::table('action_items')->insert([
        'id' => (string) Str::uuid7(),
        'team_id' => $team,
        'content' => $content,
        'priority' => 'medium',
        'created_at' => '2026-09-01 10:00:00',
        'updated_at' => '2026-09-01 10:00:00',
        ...$values,
    ]);

    $row('completed', ['completed_at' => '2026-09-02 10:00:00', 'due_on' => '2026-08-01']);
    $row('undated high', ['priority' => 'high']);
    $row('due low', ['due_on' => '2026-10-05', 'priority' => 'low']);
    $row('due high', ['due_on' => '2026-10-05', 'priority' => 'high']);
    $row('undated', []);

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    $ranks = DB::table('action_items')->pluck('sort_rank', 'content')->map(fn (mixed $rank): int => (int) $rank)->all();

    expect($ranks)->toEqual([
        'completed' => ActionItem::CompletedSortRank,
        'undated high' => 1_000_000_000,
        'due low' => 202610052,
        'due high' => 202610050,
        'undated' => 1_000_000_001,
    ])->and(ActionItemQuery::order(ActionItem::query())->pluck('content')->all())
        ->toBe(['due high', 'due low', 'undated high', 'undated', 'completed']);
});
