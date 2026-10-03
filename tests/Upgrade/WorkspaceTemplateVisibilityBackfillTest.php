<?php

use App\Support\Database\NameKey;
use App\Support\Database\SearchText;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('makes every existing template a workspace template without a team by running the migration itself', function () {
    $migration = '2026_10_23_100300_add_visibility_to_workspace_templates_table.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $row = function (string $table, array $values): string {
        $id = (string) Str::uuid7();

        DB::table($table)->insert(['id' => $id, 'created_at' => now(), 'updated_at' => now(), ...$values]);

        return $id;
    };
    $workspace = $row('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $author = $row('users', [
        'name' => 'Ada',
        'email' => 'ada@example.test',
        'email_key' => 'ada@example.test',
        'name_search' => SearchText::fold('Ada'),
        'password' => 'secret',
    ]);

    foreach (['Team pulse', 'Sailboat plus'] as $name) {
        $row('workspace_templates', [
            'workspace_id' => $workspace,
            'name' => $name,
            'name_key' => NameKey::of($name),
            'category' => 'team_mood',
            'created_by_user_id' => $author,
        ]);
    }

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    $templates = DB::table('workspace_templates')->where('workspace_id', $workspace)->orderBy('name_key')->get(['visibility', 'team_id']);

    expect($templates->pluck('visibility')->all())->toBe(['workspace', 'workspace'])
        ->and($templates->pluck('team_id')->all())->toBe([null, null]);
});
