<?php

use App\Enums\PokerRevealReason;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * @param  array<string, string>  $query
 */
function pokerEstimatesPage(TestCase $test, User $user, Team $team, array $query = []): TestResponse
{
    return $test->actingAs($user)
        ->get(route('teams.estimates.index', ['workspace' => $team->workspace, 'team' => $team, ...$query]))
        ->assertOk();
}

/**
 * @return array<int, array<string, mixed>>
 */
function pokerEstimateRows(TestResponse $response): array
{
    return $response->viewData('page')['props']['tasks'];
}

function estimatedPokerTask(PokerGame $game, string $title, string $estimatedAt, string $estimate = '5'): PokerTask
{
    return PokerTask::factory()->estimated($estimate)->create([
        'poker_game_id' => $game->id,
        'title' => $title,
        'estimated_at' => $estimatedAt,
    ]);
}

it('lists estimated tasks newest first', function () {
    $game = PokerGame::factory()->create(['title' => 'Sprint 12']);
    [$user] = pokerFacilitator($game);
    $older = estimatedPokerTask($game, 'Login page', '2026-09-01 10:00:00', '3');
    $newer = estimatedPokerTask($game, 'Search', '2026-09-20 10:00:00', '8');
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Not estimated']);
    $otherTeamGame = PokerGame::factory()->create();
    estimatedPokerTask($otherTeamGame, 'Elsewhere', '2026-09-25 10:00:00');

    $response = pokerEstimatesPage($this, $user, $game->team)
        ->assertInertia(fn (Assert $page) => $page
            ->component('poker/estimates')
            ->where('team.id', $game->team_id)
            ->where('games', [['id' => $game->id, 'title' => 'Sprint 12']])
            ->where('filters', ['game' => null, 'q' => ''])
            ->where('pagination', ['currentPage' => 1, 'lastPage' => 1, 'total' => 2]));

    $rows = pokerEstimateRows($response);

    expect(collect($rows)->pluck('id')->all())->toBe([$newer->id, $older->id])
        ->and($rows[0])->toMatchArray([
            'title' => 'Search',
            'gameId' => $game->id,
            'gameTitle' => 'Sprint 12',
            'estimate' => '8',
            'roundsCount' => 0,
            'rounds' => [],
            'players' => [],
        ]);
});

it('filters by game and title', function () {
    $team = Team::factory()->create();
    $first = PokerGame::factory()->create(['team_id' => $team->id]);
    $second = PokerGame::factory()->create(['team_id' => $team->id]);
    [$user] = pokerFacilitator($first);
    $login = estimatedPokerTask($first, 'Login page', '2026-09-01 10:00:00');
    $percent = estimatedPokerTask($first, 'Raise coverage to 80%', '2026-09-02 10:00:00');
    $other = estimatedPokerTask($second, 'Login flow', '2026-09-03 10:00:00');
    estimatedPokerTask($first, 'Coverage report 80 pages', '2026-09-04 10:00:00');

    $ids = fn (array $query) => collect(pokerEstimateRows(pokerEstimatesPage($this, $user, $team, $query)))->pluck('id')->all();

    expect($ids(['game' => $second->id]))->toBe([$other->id])
        ->and($ids(['q' => 'LOGIN']))->toBe([$other->id, $login->id])
        ->and($ids(['game' => $first->id, 'q' => 'login']))->toBe([$login->id])
        ->and($ids(['q' => '80%']))->toBe([$percent->id])
        ->and($ids(['game' => 'not-a-game']))->toHaveCount(4);

    pokerEstimatesPage($this, $user, $team, ['game' => 'not-a-game'])
        ->assertInertia(fn (Assert $page) => $page->where('filters.game', null));
});

it('paginates by 50', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);

    foreach (range(1, 51) as $index) {
        estimatedPokerTask($game, "Task {$index}", now()->subMinutes($index)->toDateTimeString());
    }

    $firstPage = pokerEstimatesPage($this, $user, $game->team);

    expect(pokerEstimateRows($firstPage))->toHaveCount(50);
    $firstPage->assertInertia(fn (Assert $page) => $page->where('pagination', ['currentPage' => 1, 'lastPage' => 2, 'total' => 51]));

    $secondPage = pokerEstimatesPage($this, $user, $game->team, ['page' => '2']);

    expect(collect(pokerEstimateRows($secondPage))->pluck('title')->all())->toBe(['Task 51']);
});

it('shows revealed rounds only with their values and results', function () {
    $table = pokerRevealTable();
    $game = $table['game'];
    $task = $table['round']->task;
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    pokerVote($table['round'], $table['memberPlayer'], '8');
    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);
    $task->update(['estimate' => '8', 'estimate_numeric' => 8, 'estimated_at' => now()]);
    $open = PokerRound::factory()->create(['poker_task_id' => $task->id, 'number' => 2]);
    pokerVote($open, $table['facilitatorPlayer'], '13');
    pokerVote($open, $table['memberPlayer'], '21');

    $response = pokerEstimatesPage($this, $table['member'], $game->team);
    $row = pokerEstimateRows($response)[0];

    expect($row['roundsCount'])->toBe(2)
        ->and($row['rounds'])->toHaveCount(1)
        ->and($row['rounds'][0]['number'])->toBe(1)
        ->and($row['rounds'][0]['myVote'])->toBe('8')
        ->and($row['rounds'][0]['result']['average'])->toBe(6.5)
        ->and(collect($row['rounds'][0]['votes'])->pluck('value', 'playerId')->all())->toEqual([
            $table['facilitatorPlayer']->id => '5',
            $table['memberPlayer']->id => '8',
        ])
        ->and(collect($row['players'])->pluck('name', 'id')->all())->toEqual([
            $table['facilitatorPlayer']->id => $table['facilitator']->name,
            $table['memberPlayer']->id => $table['member']->name,
        ])
        ->and(json_encode($response->viewData('page')['props']))->not->toContain('"21"')
        ->and(json_encode($response->viewData('page')['props']))->not->toContain('"13"');
});

it('refuses non-members and guests', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $guest = pokerGuest($game);
    $url = route('teams.estimates.index', ['workspace' => $game->team->workspace, 'team' => $game->team]);

    $this->withCookies(pokerGuestCookie($guest))->get($url)->assertRedirect(route('login'));

    $outsider = User::factory()->create();
    $game->team->workspace->members()->attach($outsider, ['role' => 'member']);

    $this->actingAs($outsider)->get($url)->assertForbidden();
});

it('loads with a constant number of queries', function () {
    $game = PokerGame::factory()->create();
    [$user, $facilitatorPlayer] = pokerFacilitator($game);

    $seed = function (int $count) use ($game, $facilitatorPlayer): void {
        $member = pokerMember($game)[1];

        foreach (range(1, $count) as $index) {
            $task = estimatedPokerTask($game, "Task {$index}", now()->subMinutes($index)->toDateTimeString());
            $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
            pokerVote($round, $facilitatorPlayer, '5');
            pokerVote($round, $member, '8');
        }

        $otherGame = PokerGame::factory()->create(['team_id' => $game->team_id]);
        estimatedPokerTask($otherGame, 'Other game task', now()->toDateTimeString());
    };

    $countQueries = function () use ($user, $game): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        pokerEstimatesPage($this, $user, $game->team);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $countQueries();
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});
