<?php

use App\Support\Database\SearchText;
use Illuminate\Support\Facades\DB;

it('gives every existing team membership the member role by running the migration itself', function () {
    $migration = '2026_10_23_100000_add_role_to_team_user_table.php';
    migrateBefore($migration);

    $workspace = insertLegacyRow('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = insertLegacyRow('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $users = collect(['Ada', 'Grace'])->map(fn (string $name): string => insertLegacyRow('users', [
        'name' => $name,
        'email' => strtolower($name).'@example.test',
        'email_key' => strtolower($name).'@example.test',
        'name_search' => SearchText::fold($name),
        'password' => 'secret',
    ]));

    foreach ($users as $user) {
        DB::table('team_user')->insert(['team_id' => $team, 'user_id' => $user, 'created_at' => now(), 'updated_at' => now()]);
    }

    runMigration($migration);

    expect(DB::table('team_user')->where('team_id', $team)->orderBy('user_id')->pluck('role')->all())->toBe(['member', 'member']);
});
