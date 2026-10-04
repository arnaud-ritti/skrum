<?php

use App\Models\ActionItemExternalLink;
use App\Support\Database\SearchText;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('finds a link written before the column by its key', function () {
    $migration = '2026_10_24_100100_add_external_key_search_to_action_item_external_links.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $workspace = (string) Str::uuid7();
    $team = (string) Str::uuid7();
    $item = (string) Str::uuid7();
    DB::table('workspaces')->insert(['id' => $workspace, 'name' => 'Acme', 'slug' => 'acme', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('teams')->insert(['id' => $team, 'workspace_id' => $workspace, 'name' => 'Platform', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('action_items')->insert([
        'id' => $item,
        'team_id' => $team,
        'content' => 'Linked',
        'content_search' => SearchText::fold('Linked'),
        'priority' => 'medium',
        'sort_rank' => 1_000_000_001,
        'created_at' => '2026-09-01 10:00:00',
        'updated_at' => '2026-09-01 10:00:00',
    ]);
    DB::table('action_item_external_links')->insert([
        'id' => (string) Str::uuid7(),
        'action_item_id' => $item,
        'source' => 'jira',
        'external_site' => 'cloud-1',
        'external_id' => '10012',
        'external_key' => 'PROJ-12',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-12',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);
    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    expect(ActionItemExternalLink::query()->whereContains('external_key', 'proj-12')->pluck('action_item_id')->all())->toBe([$item]);
});
