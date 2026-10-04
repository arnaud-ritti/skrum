<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('keeps a Draw & Guess round in play ending at its first find by running the migration itself', function () {
    $migration = '2026_10_27_100200_add_draw_finders.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $row = function (string $table, array $values): string {
        $id = (string) Str::uuid7();

        DB::table($table)->insert(['id' => $id, 'created_at' => now(), ...$values]);

        return $id;
    };
    $workspace = $row('workspaces', ['name' => 'Acme', 'slug' => 'acme', 'updated_at' => now()]);
    $team = $row('teams', ['workspace_id' => $workspace, 'name' => 'Platform', 'slug' => 'platform', 'updated_at' => now()]);
    $room = $row('game_rooms', ['team_id' => $team, 'name' => 'Friday', 'game' => 'draw', 'locale' => 'en', 'guest_token' => Str::random(40), 'updated_at' => now()]);
    $ada = $row('game_players', ['game_room_id' => $room, 'guest_name' => 'Ada', 'updated_at' => now()]);
    $round = $row('game_rounds', [
        'game_room_id' => $room,
        'game' => 'draw',
        'word' => 'rocket',
        'revealed_positions' => '[]',
        'picked_letters' => '[]',
        'picked_by' => '[]',
        'clue' => '[]',
        'drawing' => '[]',
        'started_at' => now(),
        'updated_at' => now(),
    ]);
    $guess = $row('game_guesses', ['game_round_id' => $round, 'player_id' => $ada, 'text' => 'planet', 'is_near_miss' => false, 'is_correct' => false]);

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    $storedRound = DB::table('game_rounds')->where('id', $round)->first();

    expect($storedRound->guessers_total)->toBeNull()
        ->and((int) $storedRound->word_changes)->toBe(0)
        ->and(DB::table('game_guesses')->where('id', $guess)->value('hints'))->toBeNull();
});
