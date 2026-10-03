<?php

use App\Support\Database\SearchText;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('gives every existing team membership the member role by running the migration itself', function () {
    $migration = '2026_10_23_100000_add_role_to_team_user_table.php';
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
    $team = $row('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $users = collect(['Ada', 'Grace'])->map(fn (string $name): string => $row('users', [
        'name' => $name,
        'email' => strtolower($name).'@example.test',
        'email_key' => strtolower($name).'@example.test',
        'name_search' => SearchText::fold($name),
        'password' => 'secret',
    ]));

    foreach ($users as $user) {
        DB::table('team_user')->insert(['team_id' => $team, 'user_id' => $user, 'created_at' => now(), 'updated_at' => now()]);
    }

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    expect(DB::table('team_user')->where('team_id', $team)->orderBy('user_id')->pluck('role')->all())->toBe(['member', 'member']);
});
