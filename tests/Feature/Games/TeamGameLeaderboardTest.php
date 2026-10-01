<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Actions\Games\GameStreaks;
use App\Actions\Games\TeamGameLeaderboard;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-07 12:00:00'));
});

/**
 * @return array{0: User, 1: GamePlayer}
 */
function leaderboardPlayer(GameRoom $room, string $name): array
{
    [$user, $player] = gameRoomMember($room);
    $user->forceFill(['name' => $name])->save();

    return [$user, $player];
}

function teamLeaderboardOf(Team $team, string $period = 'all'): array
{
    return resolve(TeamGameLeaderboard::class)->handle($team->fresh(), $period);
}

it('ranks current members by points, wins and name across standalone and icebreaker rooms', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [$ada, $adaPlayer] = leaderboardPlayer($room, 'Ada');
    [$bea, $beaPlayer] = leaderboardPlayer($room, 'Bea');
    [, $cydPlayer] = leaderboardPlayer($room, 'Cyd');
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create(['team_id' => $team->id, 'icebreaker_game' => GameKind::Hangman]);
    $icebreaker = resolve(EnsureIcebreakerRoom::class)->handle($retro);
    $adaParticipant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $ada->id]);
    $adaIcebreakerPlayer = GamePlayer::factory()->forParticipant($adaParticipant)->create(['game_room_id' => $icebreaker->id]);

    awardGamePoints($room, $adaPlayer, 5, true);
    awardGamePoints($icebreaker, $adaIcebreakerPlayer, 5);
    awardGamePoints($room, $beaPlayer, 10, true);
    awardGamePoints($room, $cydPlayer, 3);

    expect(teamLeaderboardOf($team))->toBe([
        ['userId' => $ada->id, 'name' => 'Ada', 'avatarUrl' => $ada->avatarUrl(), 'points' => 10, 'wins' => 1, 'roundsPlayed' => 2, 'streak' => 1],
        ['userId' => $bea->id, 'name' => 'Bea', 'avatarUrl' => $bea->avatarUrl(), 'points' => 10, 'wins' => 1, 'roundsPlayed' => 1, 'streak' => 1],
        ['userId' => $cydPlayer->user_id, 'name' => 'Cyd', 'avatarUrl' => User::query()->find($cydPlayer->user_id)->avatarUrl(), 'points' => 3, 'wins' => 0, 'roundsPlayed' => 1, 'streak' => 1],
    ]);
});

it('lists current members only', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id]);
    [$ada, $adaPlayer] = leaderboardPlayer($room, 'Ada');
    [$removed, $removedPlayer] = leaderboardPlayer($room, 'Removed');
    [$deleted, $deletedPlayer] = leaderboardPlayer($room, 'Deleted');
    $admin = workspaceManager($team->workspace);
    $adminPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);
    $guest = gameRoomGuest($room);

    foreach ([$adaPlayer, $removedPlayer, $deletedPlayer, $adminPlayer, $guest] as $player) {
        awardGamePoints($room, $player, 4);
    }

    $team->members()->detach($removed);
    $deleted->delete();

    expect(collect(teamLeaderboardOf($team))->pluck('name')->all())->toBe(['Ada']);
});

it('honours the period', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [, $adaPlayer] = leaderboardPlayer($room, 'Ada');
    [, $beaPlayer] = leaderboardPlayer($room, 'Bea');
    awardGamePoints($room, $adaPlayer, 8, false, ['created_at' => now()->subDays(31)]);
    awardGamePoints($room, $beaPlayer, 2, false, ['created_at' => now()->subDays(29)]);

    expect(collect(teamLeaderboardOf($team, '30d'))->pluck('name')->all())->toBe(['Bea'])
        ->and(collect(teamLeaderboardOf($team, 'all'))->pluck('name')->all())->toBe(['Ada', 'Bea'])
        ->and(TeamGameLeaderboard::period('all'))->toBe('all')
        ->and(TeamGameLeaderboard::period('7d'))->toBe('30d')
        ->and(TeamGameLeaderboard::period(null))->toBe('30d');
});

it('keeps the top twenty', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);

    foreach (range(1, 21) as $points) {
        [, $player] = leaderboardPlayer($room, "Player {$points}");
        awardGamePoints($room, $player, $points);
    }

    $leaderboard = teamLeaderboardOf($team);

    expect($leaderboard)->toHaveCount(20)
        ->and($leaderboard[0]['points'])->toBe(21)
        ->and($leaderboard[19]['points'])->toBe(2);
});

it('counts weekly streaks back from this week or the last one', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [$ada, $adaPlayer] = leaderboardPlayer($room, 'Ada');
    [$bea, $beaPlayer] = leaderboardPlayer($room, 'Bea');
    [$cyd, $cydPlayer] = leaderboardPlayer($room, 'Cyd');
    [$dan, $danPlayer] = leaderboardPlayer($room, 'Dan');
    $thisWeek = now();
    $lastWeek = now()->subWeek();
    $twoWeeksAgo = now()->subWeeks(2);

    foreach ([$thisWeek, $lastWeek, $twoWeeksAgo] as $at) {
        awardGamePoints($room, $adaPlayer, 1, false, ['created_at' => $at]);
    }

    foreach ([$lastWeek, $twoWeeksAgo] as $at) {
        awardGamePoints($room, $beaPlayer, 1, false, ['created_at' => $at]);
    }

    foreach ([$thisWeek, $twoWeeksAgo] as $at) {
        awardGamePoints($room, $cydPlayer, 1, false, ['created_at' => $at]);
    }

    awardGamePoints($room, $danPlayer, 1, false, ['created_at' => $twoWeeksAgo]);

    expect(resolve(GameStreaks::class)->forUsers($team, [$ada->id, $bea->id, $cyd->id, $dan->id]))->toBe([
        $ada->id => 3,
        $bea->id => 2,
        $cyd->id => 1,
        $dan->id => 0,
    ]);
});

it('starts ISO weeks on Monday in UTC', function () {
    $monday = CarbonImmutable::parse('2026-10-05', 'UTC');

    expect(resolve(GameStreaks::class)->streak(['2026-10-05', '2026-09-28'], $monday))->toBe(2)
        ->and(resolve(GameStreaks::class)->streak(['2026-09-28', '2026-09-14'], $monday))->toBe(1)
        ->and(resolve(GameStreaks::class)->streak([], $monday))->toBe(0);
});

it('drops the points of a deleted room', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [, $player] = leaderboardPlayer($room, 'Ada');
    awardGamePoints($room, $player, 5);

    $room->delete();

    expect(teamLeaderboardOf($team))->toBeEmpty();
});

it('defers the leaderboard on the team games page', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [$ada, $player] = leaderboardPlayer($room, 'Ada');
    awardGamePoints($room, $player, 5, true, ['created_at' => now()->subDays(40)]);
    $url = fn (array $query = []) => route('teams.games.index', ['workspace' => $team->workspace->slug, 'team' => $team->id, ...$query]);

    $this->actingAs($ada)
        ->get($url())
        ->assertInertia(fn (Assert $page) => $page
            ->component('games/index')
            ->where('period', '30d')
            ->missing('leaderboard')
            ->loadDeferredProps('leaderboard', fn (Assert $reload) => $reload->where('leaderboard', [])));

    $this->actingAs($ada)
        ->get($url(['period' => 'all']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('period', 'all')
            ->loadDeferredProps('leaderboard', fn (Assert $reload) => $reload
                ->where('leaderboard.0.name', 'Ada')
                ->where('leaderboard.0.points', 5)));

    $this->actingAs($ada)
        ->get($url(['period' => 'forever']))
        ->assertInertia(fn (Assert $page) => $page->where('period', '30d'));
});

it('refuses the team games page to people outside the team', function () {
    $team = Team::factory()->create();
    $outsider = teamMember(Team::factory()->create(['workspace_id' => $team->workspace_id]));

    $this->actingAs($outsider)
        ->get(route('teams.games.index', ['workspace' => $team->workspace->slug, 'team' => $team->id]))
        ->assertForbidden();
});

it('breaks ties by name without regard to case', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [, $lowerPlayer] = leaderboardPlayer($room, 'bea');
    [, $upperPlayer] = leaderboardPlayer($room, 'Cyd');
    [, $firstPlayer] = leaderboardPlayer($room, 'Ada');

    foreach ([$lowerPlayer, $upperPlayer, $firstPlayer] as $player) {
        awardGamePoints($room, $player, 4);
    }

    expect(collect(teamLeaderboardOf($team))->pluck('name')->all())->toBe(['Ada', 'bea', 'Cyd']);
});
