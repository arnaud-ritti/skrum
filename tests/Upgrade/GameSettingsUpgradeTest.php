<?php

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('keeps every room, round and vote playing as before by running the migrations themselves', function () {
    $first = '2026_10_27_100000_add_game_settings_and_turns.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $first)
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
    $room = $row('game_rooms', ['team_id' => $team, 'name' => 'Friday', 'game' => 'gif', 'locale' => 'en', 'guest_token' => Str::random(40)]);
    $ada = $row('game_players', ['game_room_id' => $room, 'guest_name' => 'Ada']);
    $bob = $row('game_players', ['game_room_id' => $room, 'guest_name' => 'Bob']);
    $cy = $row('game_players', ['game_room_id' => $room, 'guest_name' => 'Cy']);
    $round = $row('game_rounds', [
        'game_room_id' => $room,
        'game' => 'gif',
        'question' => 'How was the sprint?',
        'revealed_positions' => '[]',
        'picked_letters' => '[]',
        'picked_by' => '[]',
        'clue' => '[]',
        'drawing' => '[]',
        'started_at' => now(),
        'revealed_at' => now(),
    ]);
    $adaAnswer = $row('game_gif_answers', ['game_round_id' => $round, 'player_id' => $ada, 'gif_id' => 'gifA']);
    $bobAnswer = $row('game_gif_answers', ['game_round_id' => $round, 'player_id' => $bob, 'gif_id' => 'gifB']);
    $vote = $row('game_gif_votes', ['game_round_id' => $round, 'voter_player_id' => $cy, 'answer_id' => $adaAnswer]);

    foreach ([$first, '2026_10_27_100100_create_game_choice_tables.php'] as $migration) {
        Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);
    }

    $storedRoom = DB::table('game_rooms')->where('id', $room)->first();
    $storedRound = DB::table('game_rounds')->where('id', $round)->first();

    expect($storedRoom->word_themes)->toBeNull()
        ->and($storedRoom->turn_seconds)->toBeNull()
        ->and($storedRoom->auto_hints)->toBeFalsy()
        ->and($storedRoom->takes_turns)->toBeFalsy()
        ->and($storedRoom->rounds_per_game)->toBeNull()
        ->and((int) $storedRoom->gif_votes)->toBe(1)
        ->and($storedRoom->gif_authors_hidden)->toBeFalsy()
        ->and($storedRound->number)->toBeNull()
        ->and($storedRound->turn_order)->toBeNull()
        ->and((int) $storedRound->votes_allowed)->toBe(1)
        ->and($storedRound->authors_hidden)->toBeFalsy()
        ->and(DB::table('game_gif_votes')->where('id', $vote)->exists())->toBeTrue()
        ->and(DB::table('game_gif_answers')->where('id', $adaAnswer)->value('caption'))->toBeNull()
        ->and(Schema::hasTable('game_choices'))->toBeTrue()
        ->and(Schema::hasTable('game_text_answers'))->toBeTrue()
        ->and(Schema::hasColumn('game_text_answers', 'is_drawn'))->toBeTrue()
        ->and(Schema::hasTable('game_statement_sets'))->toBeTrue();

    DB::table('game_gif_votes')->insert(['id' => (string) Str::uuid7(), 'game_round_id' => $round, 'voter_player_id' => $cy, 'answer_id' => $bobAnswer, 'created_at' => now(), 'updated_at' => now()]);

    expect(fn () => DB::transaction(fn () => DB::table('game_gif_votes')->insert([
        'id' => (string) Str::uuid7(),
        'game_round_id' => $round,
        'voter_player_id' => $cy,
        'answer_id' => $bobAnswer,
        'created_at' => now(),
        'updated_at' => now(),
    ])))->toThrow(UniqueConstraintViolationException::class);
});
