<?php

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Team;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('gives every existing points row the monday of its week by running the migration itself', function () {
    $migration = '2026_10_19_100400_add_week_start_to_game_points.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    $player = GamePlayer::factory()->create(['game_room_id' => $room->id]);
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
            'team_id' => $team->id,
            'game_room_id' => $room->id,
            'player_id' => $player->id,
            'game' => 'hangman',
            'points' => 1,
            'is_win' => false,
            'created_at' => $createdAt,
        ]);
    }

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    $stored = DB::table('game_points')->pluck('week_start', 'id')->map(fn (mixed $week): string => substr((string) $week, 0, 10));

    foreach ($mondayByCreatedAt as $createdAt => $monday) {
        expect($stored->get($idByCreatedAt[$createdAt]))->toBe($monday);
    }

    expect(Schema::hasIndex('game_points', ['team_id', 'user_id', 'week_start']))->toBeTrue()
        ->and(DB::table('game_points')->whereNull('week_start')->count())->toBe(0);
});
