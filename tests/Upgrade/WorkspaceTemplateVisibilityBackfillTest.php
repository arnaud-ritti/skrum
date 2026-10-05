<?php

use App\Support\Database\NameKey;
use App\Support\Database\SearchText;
use Illuminate\Support\Facades\DB;

it('makes every existing template a workspace template without a team by running the migration itself', function () {
    $migration = '2026_10_23_100300_add_visibility_to_workspace_templates_table.php';
    migrateBefore($migration);

    $workspace = insertLegacyRow('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $author = insertLegacyRow('users', [
        'name' => 'Ada',
        'email' => 'ada@example.test',
        'email_key' => 'ada@example.test',
        'name_search' => SearchText::fold('Ada'),
        'password' => 'secret',
    ]);

    foreach (['Team pulse', 'Sailboat plus'] as $name) {
        insertLegacyRow('workspace_templates', [
            'workspace_id' => $workspace,
            'name' => $name,
            'name_key' => NameKey::of($name),
            'category' => 'team_mood',
            'created_by_user_id' => $author,
        ]);
    }

    runMigration($migration);

    $templates = DB::table('workspace_templates')->where('workspace_id', $workspace)->orderBy('name_key')->get(['visibility', 'team_id']);

    expect($templates->pluck('visibility')->all())->toBe(['workspace', 'workspace'])
        ->and($templates->pluck('team_id')->all())->toBe([null, null]);
});
