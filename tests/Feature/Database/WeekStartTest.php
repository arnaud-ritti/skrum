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

it('stores the week of the instant, in UTC, when the creation time is given in another timezone', function () {
    $point = GamePoint::factory()->create(['created_at' => CarbonImmutable::parse('2026-10-05 01:00:00', '+02:00')]);

    $stored = DB::table('game_points')->where('id', $point->id)->first();

    expect(substr((string) $stored->week_start, 0, 10))->toBe('2026-09-28')
        ->and(substr((string) $stored->created_at, 0, 19))->toBe('2026-10-04 23:00:00');
});

it('stores the week of a creation time given as a string', function () {
    $point = GamePoint::factory()->create(['created_at' => '2026-09-16 09:30:00']);

    expect(substr((string) DB::table('game_points')->where('id', $point->id)->value('week_start'), 0, 10))->toBe('2026-09-14');
});

it('moves the week with the creation time when a saved point is given another one', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-07 12:00:00', 'UTC'));
    $point = GamePoint::factory()->create();

    $point->created_at = CarbonImmutable::parse('2026-09-20 23:59:59', 'UTC');
    $point->save();

    expect(substr((string) DB::table('game_points')->where('id', $point->id)->value('week_start'), 0, 10))->toBe('2026-09-14');
});

it('has the index the streak reads', function () {
    expect(Schema::hasIndex('game_points', ['team_id', 'user_id', 'week_start']))->toBeTrue();
});

it('counts consecutive weeks from the stored week, two rows of one week counting once', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();

    foreach (['2026-09-22', '2026-09-29', '2026-09-30', '2026-10-06'] as $day) {
        $this->travelTo(CarbonImmutable::parse("{$day} 10:00:00", 'UTC'));
        GamePoint::factory()->create(['team_id' => $team->id, 'user_id' => $user->id]);
    }

    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00:00', 'UTC'));

    expect(resolve(GameStreaks::class)->forUsers($team, [$user->id]))->toBe([$user->id => 3]);
});
