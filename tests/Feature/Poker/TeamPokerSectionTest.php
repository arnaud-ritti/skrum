<?php

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function pokerTeamPage(mixed $test, User $user, Team $team): mixed
{
    return $test->actingAs($user)->get(route('teams.show', [$team->workspace, $team]));
}

it('lists active and ended games with their tasks and points on the sessions page', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->travelTo(now()->subHours(2));
    $ended = PokerGame::factory()->ended()->create(['team_id' => $team->id, 'title' => 'Ended game']);
    PokerTask::factory()->create(['poker_game_id' => $ended->id]);

    $this->travelTo(now()->addHour());
    $sized = PokerGame::factory()->deck(PokerDeck::Tshirt)->create(['team_id' => $team->id, 'title' => 'Shirts']);
    PokerTask::factory()->create(['poker_game_id' => $sized->id, 'estimate' => 'M', 'estimate_numeric' => null, 'estimated_at' => now()]);

    $this->travelBack();
    $active = PokerGame::factory()->create(['team_id' => $team->id, 'title' => 'Active game']);
    PokerTask::factory()->create(['poker_game_id' => $active->id, 'estimate' => '3', 'estimate_numeric' => 3, 'estimated_at' => now()]);
    PokerTask::factory()->create(['poker_game_id' => $active->id, 'estimate' => '5', 'estimate_numeric' => 5, 'estimated_at' => now()]);
    PokerTask::factory()->create(['poker_game_id' => $active->id]);

    $this->actingAs($user)->get(route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'poker']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/sessions')
            ->where('canCreatePokerGame', true)
            ->has('pokerDeckOptions', 5)
            ->has('sessions', 3)
            ->where('sessions.0.id', $active->id)
            ->where('sessions.0.tasks', 3)
            ->where('sessions.0.points', 8)
            ->where('sessions.0.state', 'upcoming')
            ->where('sessions.1.id', $sized->id)
            ->where('sessions.1.points', null)
            ->where('sessions.2.id', $ended->id)
            ->where('sessions.2.tasks', 1)
            ->where('sessions.2.points', null)
            ->where('sessions.2.state', 'finished'));
});

it('only lists the games of the team', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    PokerGame::factory()->create();

    pokerTeamPage($this, $user, $team)->assertInertia(fn (Assert $page) => $page->where('hasSessions', false)->where('recentSessions', []));
});

it('keeps the team page query count constant as games grow', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $seed = function (int $count) use ($team): void {
        PokerGame::factory()->count($count)->create(['team_id' => $team->id])
            ->each(fn (PokerGame $game) => PokerTask::factory()->count(2)->create([
                'poker_game_id' => $game->id,
                'estimate' => '3',
                'estimate_numeric' => 3,
                'estimated_at' => now(),
            ]));
    };
    $countQueries = function () use ($team, $user): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        pokerTeamPage($this, $user, $team)->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $countQueries();
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});
