<?php

use App\Actions\Games\GameStreaks;
use App\Models\GamePoint;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

it('stores the monday of the week a points row was created in', function (string $createdAt, string $monday) {
    $this->travelTo(CarbonImmutable::parse($createdAt, 'UTC'));

    $point = GamePoint::factory()->create();

    expect(substr((string) DB::table('game_points')->where('id', $point->id)->value('week_start'), 0, 10))->toBe($monday);
})->with([
    'a wednesday' => ['2026-10-07 12:00:00', '2026-10-05'],
    'a monday at midnight' => ['2026-10-05 00:00:00', '2026-10-05'],
    'a sunday at the last second' => ['2026-10-11 23:59:59', '2026-10-05'],
]);

it('has the index the streak reads', function () {
    expect(Schema::hasIndex('game_points', ['team_id', 'user_id', 'week_start']))->toBeTrue();
});

it('counts consecutive weeks from the stored week, reading one row per week', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();

    foreach (['2026-09-22', '2026-09-29', '2026-09-30', '2026-10-06'] as $day) {
        $this->travelTo(CarbonImmutable::parse("{$day} 10:00:00", 'UTC'));
        GamePoint::factory()->create(['team_id' => $team->id, 'user_id' => $user->id]);
    }

    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00:00', 'UTC'));

    expect(resolve(GameStreaks::class)->forUsers($team, [$user->id]))->toBe([$user->id => 3]);
});
