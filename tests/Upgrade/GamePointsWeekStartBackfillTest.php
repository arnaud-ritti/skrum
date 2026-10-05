<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('gives every existing points row the monday of its week by running the migration itself', function () {
    $migration = '2026_10_19_100400_add_week_start_to_game_points.php';
    migrateBefore($migration);

    $workspace = insertLegacyRow('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = insertLegacyRow('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $room = insertLegacyRow('game_rooms', ['team_id' => $team, 'locale' => 'en', 'guest_token' => Str::random(40)]);
    $player = insertLegacyRow('game_players', ['game_room_id' => $room, 'guest_name' => 'Grace']);
    $mondayByCreatedAt = [
        '2026-09-28 00:00:00' => '2026-09-28',
        '2026-10-04 23:59:59' => '2026-09-28',
        '2026-10-05 00:00:00' => '2026-10-05',
        '2026-10-07 12:30:00' => '2026-10-05',
        '2025-12-31 18:00:00' => '2025-12-29',
    ];
    $idByCreatedAt = [];

    foreach (array_keys($mondayByCreatedAt) as $createdAt) {
        $idByCreatedAt[$createdAt] = (string) Str::uuid7();

        DB::table('game_points')->insert([
            'id' => $idByCreatedAt[$createdAt],
            'team_id' => $team,
            'game_room_id' => $room,
            'player_id' => $player,
            'game' => 'hangman',
            'points' => 1,
            'is_win' => false,
            'created_at' => $createdAt,
        ]);
    }

    runMigration($migration);

    $stored = DB::table('game_points')->pluck('week_start', 'id')->map(fn (mixed $week): string => substr((string) $week, 0, 10));

    foreach ($mondayByCreatedAt as $createdAt => $monday) {
        expect($stored->get($idByCreatedAt[$createdAt]))->toBe($monday);
    }

    expect(Schema::hasIndex('game_points', ['team_id', 'user_id', 'week_start']))->toBeTrue()
        ->and(DB::table('game_points')->whereNull('week_start')->count())->toBe(0);
});
