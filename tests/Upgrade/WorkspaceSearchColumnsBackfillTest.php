<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Support\SqlProbe;

it('fills the folded columns the workspace search reads when the migration runs', function () {
    $migration = '2026_10_19_100700_add_search_columns_for_workspace_search.php';
    migrateBefore($migration);

    $workspace = insertLegacyRow('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = insertLegacyRow('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $game = insertLegacyRow('poker_games', ['team_id' => $team, 'title' => 'Sprint ÉTÉ', 'deck' => 'fibonacci', 'cards' => '["1","2","3"]', 'guest_token' => Str::random(40)]);
    $board = insertLegacyRow('whiteboards', ['team_id' => $team, 'title' => 'Carte MENTALE', 'guest_token' => Str::random(40)]);
    $namedRoom = insertLegacyRow('game_rooms', ['team_id' => $team, 'name' => 'Pause CAFÉ', 'locale' => 'fr', 'guest_token' => Str::random(40)]);
    $unnamedRoom = insertLegacyRow('game_rooms', ['team_id' => $team, 'locale' => 'fr', 'guest_token' => Str::random(40)]);

    runMigration($migration);

    expect(DB::table('poker_games')->where('id', $game)->value('title_search'))->toBe('sprint été')
        ->and(DB::table('whiteboards')->where('id', $board)->value('title_search'))->toBe('carte mentale')
        ->and(DB::table('game_rooms')->where('id', $namedRoom)->value('name_search'))->toBe('pause café')
        ->and(DB::table('game_rooms')->where('id', $unnamedRoom)->value('name_search'))->toBeNull();
});

it('can run a second time and then fills only the rows a stopped run left empty', function () {
    $migration = '2026_10_19_100700_add_search_columns_for_workspace_search.php';
    migrateBefore($migration);

    $workspace = insertLegacyRow('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = insertLegacyRow('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $filledGame = insertLegacyRow('poker_games', ['team_id' => $team, 'title' => 'Sprint ÉTÉ', 'deck' => 'fibonacci', 'cards' => '["1","2","3"]', 'guest_token' => Str::random(40)]);
    $unfilledGame = insertLegacyRow('poker_games', ['team_id' => $team, 'title' => 'Sprint HIVER', 'deck' => 'fibonacci', 'cards' => '["1","2","3"]', 'guest_token' => Str::random(40)]);
    $board = insertLegacyRow('whiteboards', ['team_id' => $team, 'title' => 'Carte MENTALE', 'guest_token' => Str::random(40)]);
    $run = fn () => runMigration($migration);
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
