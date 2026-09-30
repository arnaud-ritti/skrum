<?php

use App\Enums\PokerRevealReason;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('lists rounds newest first with values only when revealed', function () {
    $table = pokerRevealTable();
    $task = $table['round']->task;
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    pokerVote($table['round'], $table['memberPlayer'], '8');
    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);
    $open = PokerRound::factory()->create(['poker_task_id' => $task->id, 'number' => 2]);
    pokerVote($open, $table['facilitatorPlayer'], '13');
    pokerVote($open, $table['memberPlayer'], '3');
    $guest = pokerGuest($table['game']);

    $response = $this->actingAs($table['member'])
        ->getJson(route('poker.tasks.rounds.index', [$table['game'], $task]))
        ->assertOk()
        ->assertJsonCount(2)
        ->assertJsonPath('0.number', 2)
        ->assertJsonPath('0.votes', [])
        ->assertJsonPath('0.votesCount', 2)
        ->assertJsonPath('0.myVote', '3')
        ->assertJsonPath('0.result', null)
        ->assertJsonPath('1.number', 1)
        ->assertJsonPath('1.result.average', 6.5);

    expect(collect($response->json('1.votes'))->pluck('value', 'playerId')->all())->toEqual([
        $table['facilitatorPlayer']->id => '5',
        $table['memberPlayer']->id => '8',
    ])->and($response->getContent())->not->toContain('"13"');

    app('auth')->forgetGuards();

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.tasks.rounds.index', [$table['game'], $task]))
        ->assertOk()
        ->assertJsonPath('0.votes', [])
        ->assertJsonPath('0.myVote', null);
});

it('keeps never-revealed rounds hidden forever', function () {
    $table = pokerRevealTable();
    $task = $table['round']->task;
    pokerVote($table['round'], $table['facilitatorPlayer'], '13');
    pokerVote($table['round'], $table['memberPlayer'], '21');

    $other = PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.current-task.update', $table['game']), ['task_id' => $other->id])
        ->assertNoContent();

    $response = $this->actingAs($table['facilitator'])
        ->getJson(route('poker.tasks.rounds.index', [$table['game'], $task]))
        ->assertOk()
        ->assertJsonPath('0.revealedAt', null)
        ->assertJsonPath('0.votes', [])
        ->assertJsonPath('0.votesCount', 2)
        ->assertJsonPath('0.myVote', '13');

    expect($response->getContent())->not->toContain('"21"');
});

it('loads the history with a constant number of queries', function () {
    $game = PokerGame::factory()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $addRounds = function (int $roundCount, int $playerCount) use ($game, $task, $facilitatorPlayer): void {
        $voters = collect([$facilitatorPlayer])
            ->merge(collect(range(1, $playerCount - 1))->map(fn () => pokerMember($game)[1]));
        $next = (int) $task->rounds()->max('number');

        foreach (range(1, $roundCount) as $offset) {
            $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id, 'number' => $next + $offset]);
            $voters->each(fn ($voter) => pokerVote($round, $voter, '5'));
        }
    };

    $countQueries = function () use ($facilitator, $game, $task): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($facilitator)->getJson(route('poker.tasks.rounds.index', [$game, $task]))->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $addRounds(2, 2);
    $countQueries();
    $small = $countQueries();

    $addRounds(4, 4);

    expect($countQueries())->toBe($small);
});
