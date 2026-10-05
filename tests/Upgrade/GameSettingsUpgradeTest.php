<?php

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('keeps every room, round and vote playing as before by running the migrations themselves', function () {
    $first = '2026_10_27_100000_add_game_settings_and_turns.php';
    migrateBefore($first);

    $workspace = insertLegacyRow('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = insertLegacyRow('teams', ['workspace_id' => $workspace, 'name' => 'Platform', 'slug' => 'platform']);
    $room = insertLegacyRow('game_rooms', ['team_id' => $team, 'name' => 'Friday', 'game' => 'gif', 'locale' => 'en', 'guest_token' => Str::random(40)]);
    $ada = insertLegacyRow('game_players', ['game_room_id' => $room, 'guest_name' => 'Ada']);
    $bob = insertLegacyRow('game_players', ['game_room_id' => $room, 'guest_name' => 'Bob']);
    $cy = insertLegacyRow('game_players', ['game_room_id' => $room, 'guest_name' => 'Cy']);
    $round = insertLegacyRow('game_rounds', [
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
    $adaAnswer = insertLegacyRow('game_gif_answers', ['game_round_id' => $round, 'player_id' => $ada, 'gif_id' => 'gifA']);
    $bobAnswer = insertLegacyRow('game_gif_answers', ['game_round_id' => $round, 'player_id' => $bob, 'gif_id' => 'gifB']);
    $vote = insertLegacyRow('game_gif_votes', ['game_round_id' => $round, 'voter_player_id' => $cy, 'answer_id' => $adaAnswer]);

    foreach ([$first, '2026_10_27_100100_create_game_choice_tables.php'] as $migration) {
        runMigration($migration);
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
