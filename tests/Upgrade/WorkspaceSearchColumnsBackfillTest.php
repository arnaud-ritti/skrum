<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Support\SqlProbe;

it('fills the folded columns the workspace search reads when the migration runs', function () {
    $migration = '2026_10_19_100700_add_search_columns_for_workspace_search.php';
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
    $game = $row('poker_games', ['team_id' => $team, 'title' => 'Sprint ÉTÉ', 'deck' => 'fibonacci', 'cards' => '["1","2","3"]', 'guest_token' => Str::random(40)]);
    $board = $row('whiteboards', ['team_id' => $team, 'title' => 'Carte MENTALE', 'guest_token' => Str::random(40)]);
    $namedRoom = $row('game_rooms', ['team_id' => $team, 'name' => 'Pause CAFÉ', 'locale' => 'fr', 'guest_token' => Str::random(40)]);
    $unnamedRoom = $row('game_rooms', ['team_id' => $team, 'locale' => 'fr', 'guest_token' => Str::random(40)]);

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    expect(DB::table('poker_games')->where('id', $game)->value('title_search'))->toBe('sprint été')
        ->and(DB::table('whiteboards')->where('id', $board)->value('title_search'))->toBe('carte mentale')
        ->and(DB::table('game_rooms')->where('id', $namedRoom)->value('name_search'))->toBe('pause café')
        ->and(DB::table('game_rooms')->where('id', $unnamedRoom)->value('name_search'))->toBeNull();
});

it('can run a second time and then fills only the rows a stopped run left empty', function () {
    $migration = '2026_10_19_100700_add_search_columns_for_workspace_search.php';
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
    $filledGame = $row('poker_games', ['team_id' => $team, 'title' => 'Sprint ÉTÉ', 'deck' => 'fibonacci', 'cards' => '["1","2","3"]', 'guest_token' => Str::random(40)]);
    $unfilledGame = $row('poker_games', ['team_id' => $team, 'title' => 'Sprint HIVER', 'deck' => 'fibonacci', 'cards' => '["1","2","3"]', 'guest_token' => Str::random(40)]);
    $board = $row('whiteboards', ['team_id' => $team, 'title' => 'Carte MENTALE', 'guest_token' => Str::random(40)]);
    $run = fn () => Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);
    $run();
    DB::table('migrations')->where('migration', Str::before($migration, '.php'))->delete();
    DB::table('poker_games')->where('id', $unfilledGame)->update(['title_search' => null]);

    $updates = SqlProbe::updateConditions('poker_games', $run);

    expect($updates)->toHaveCount(1)
        ->and(DB::table('poker_games')->where('id', $filledGame)->value('title_search'))->toBe('sprint été')
        ->and(DB::table('poker_games')->where('id', $unfilledGame)->value('title_search'))->toBe('sprint hiver')
        ->and(DB::table('whiteboards')->where('id', $board)->value('title_search'))->toBe('carte mentale')
        ->and(collect(Schema::getColumns('poker_games'))->where('name', 'title_search'))->toHaveCount(1)
        ->and(DB::table('migrations')->where('migration', Str::before($migration, '.php'))->exists())->toBeTrue();
});
