<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Actions\Poker\PresentPokerRound;
use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Support\Facades\DB;

/**
 * @return array<string, mixed>
 */
function pokerSnapshot(PokerGame $game, PokerPlayer $viewer): array
{
    return app(BuildPokerSnapshot::class)->handle($game->fresh(), $viewer->fresh());
}

/**
 * @param  array<int, array{playerId: string, value: ?string}>  $votes
 * @return array<string, ?string>
 */
function pokerVotesByPlayer(array $votes): array
{
    return collect($votes)->pluck('value', 'playerId')->all();
}

it("hides other players' values before reveal, for the facilitator too", function () {
    $game = PokerGame::factory()->create();
    [, $facilitator] = pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '5');
    pokerVote($round, $member, '8');

    $forFacilitator = pokerSnapshot($game, $facilitator);
    $forMember = pokerSnapshot($game, $member);

    expect(pokerVotesByPlayer($forFacilitator['current']['round']['votes']))->toEqual([
        $facilitator->id => '5',
        $member->id => null,
    ])
        ->and($forFacilitator['current']['round']['myVote'])->toBe('5')
        ->and($forFacilitator['current']['round']['votesCount'])->toBe(2)
        ->and($forFacilitator['current']['round']['result'])->toBeNull()
        ->and($forFacilitator['current']['taskId'])->toBe($round->poker_task_id)
        ->and($forFacilitator['me']['isFacilitator'])->toBeTrue()
        ->and(collect($forFacilitator['me']['transferCandidates'])->pluck('userId')->all())->toContain($memberUser->id)
        ->and(pokerVotesByPlayer($forMember['current']['round']['votes']))->toEqual([
            $facilitator->id => null,
            $member->id => '8',
        ])
        ->and($forMember['current']['round']['myVote'])->toBe('8')
        ->and($forMember['me']['transferCandidates'])->toBe([]);
});

it('shows every value after reveal', function () {
    $game = PokerGame::factory()->create();
    [, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '5');
    pokerVote($round, $member, '8');
    $round->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);

    $snapshot = pokerSnapshot($game, $member);

    expect(pokerVotesByPlayer($snapshot['current']['round']['votes']))->toEqual([
        $facilitator->id => '5',
        $member->id => '8',
    ])
        ->and($snapshot['current']['round']['revealReason'])->toBe('manual')
        ->and($snapshot['current']['round']['result']['average'])->toBe(6.5)
        ->and($snapshot['current']['round']['result']['nearestCard'])->toBe('8')
        ->and($snapshot['game']['hasVotes'])->toBeTrue();
});

it('lists no voters in the history mode of an unrevealed round', function () {
    $game = PokerGame::factory()->create();
    [, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '5');
    pokerVote($round, $member, '8');

    $presented = app(PresentPokerRound::class)->handle($round->fresh(['votes']), $game->fresh(), $member->id, listUnrevealedVoters: false);

    expect($presented['votes'])->toBe([])
        ->and($presented['votesCount'])->toBe(2)
        ->and($presented['myVote'])->toBe('8')
        ->and($presented['result'])->toBeNull();
});

it('orders voters by join order', function () {
    $game = PokerGame::factory()->create();
    [, $first] = pokerFacilitator($game);
    $this->travel(1)->seconds();
    [, $second] = pokerMember($game);
    $this->travel(1)->seconds();
    $third = pokerGuest($game);
    $round = openPokerRound($game);
    pokerVote($round, $third, '1');
    pokerVote($round, $second, '2');
    pokerVote($round, $first, '3');
    $round->update(['revealed_at' => now()]);

    $snapshot = pokerSnapshot($game, $first);

    expect(array_column($snapshot['current']['round']['votes'], 'playerId'))->toBe([$first->id, $second->id, $third->id])
        ->and(array_column($snapshot['players'], 'id'))->toBe([$first->id, $second->id, $third->id]);
});

it('gives guests no guest url, team link or transfer candidates', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    pokerFacilitator($game);
    $guest = pokerGuest($game);

    $snapshot = pokerSnapshot($game, $guest);

    expect($snapshot['game']['guestUrl'])->toBeNull()
        ->and($snapshot['links']['team'])->toBeNull()
        ->and($snapshot['me'])->toMatchArray([
            'playerId' => $guest->id,
            'userId' => null,
            'isGuest' => true,
            'isFacilitator' => false,
            'canVote' => true,
            'canEditTasks' => false,
            'canTakeControl' => false,
            'canDelete' => false,
            'transferCandidates' => [],
        ])
        ->and(collect($snapshot['players'])->firstWhere('id', $guest->id))->toMatchArray([
            'name' => $guest->guest_name,
            'isGuest' => true,
            'isSpectator' => false,
        ]);
});

it('describes what members and workspace admins may do', function () {
    $game = PokerGame::factory()->create();
    pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $admin = PokerPlayer::factory()->create([
        'poker_game_id' => $game->id,
        'user_id' => workspaceManager($game->team->workspace)->id,
    ]);

    $forMember = pokerSnapshot($game, $member);
    $forAdmin = pokerSnapshot($game, $admin);

    expect($forMember['me'])->toMatchArray([
        'userId' => $memberUser->id,
        'canEditTasks' => true,
        'canTakeControl' => true,
        'canDelete' => false,
    ])
        ->and($forMember['links']['team'])->toBe(route('teams.show', [$game->team->workspace, $game->team]))
        ->and($forMember['game']['guestUrl'])->toBeNull()
        ->and($forMember['serverTime'])->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/')
        ->and($forAdmin['me']['canDelete'])->toBeTrue();

    $game->update(['ended_at' => now()]);

    expect(pokerSnapshot($game, $member)['me']['canTakeControl'])->toBeTrue();
});

it('computes counts and total points', function () {
    $game = PokerGame::factory()->create();
    [, $facilitator] = pokerFacilitator($game);
    PokerTask::factory()->estimated('5')->create(['poker_game_id' => $game->id]);
    PokerTask::factory()->estimated('8')->create(['poker_game_id' => $game->id]);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'description' => '**Bold**']);

    $tshirt = PokerGame::factory()->deck(PokerDeck::Tshirt)->create();
    [, $tshirtFacilitator] = pokerFacilitator($tshirt);
    PokerTask::factory()->estimated('M')->create(['poker_game_id' => $tshirt->id]);

    $snapshot = pokerSnapshot($game, $facilitator);
    $tshirtSnapshot = pokerSnapshot($tshirt, $tshirtFacilitator);

    expect($snapshot['game'])->toMatchArray([
        'deck' => 'fibonacci',
        'deckLabel' => 'Fibonacci',
        'isNumeric' => true,
        'tasksCount' => 3,
        'estimatedCount' => 2,
        'totalPoints' => 13.0,
        'hasVotes' => false,
        'currentTaskId' => null,
        'autoReveal' => false,
        'anonymousVotes' => false,
        'cursorsEnabled' => true,
        'reactionsEnabled' => true,
    ])
        ->and($snapshot['current'])->toBeNull()
        ->and(array_column($snapshot['tasks'], 'position'))->toBe([1, 2, 3])
        ->and($snapshot['tasks'][2]['descriptionHtml'])->toContain('<strong>Bold</strong>')
        ->and($tshirtSnapshot['game']['totalPoints'])->toBeNull()
        ->and($tshirtSnapshot['game']['estimatedCount'])->toBe(1)
        ->and($tshirtSnapshot['game']['isNumeric'])->toBeFalse();
});

it('builds the snapshot with a constant number of queries', function () {
    $game = PokerGame::factory()->create();
    [, $facilitator] = pokerFacilitator($game);
    $seed = function (int $tasks, int $rounds, int $players) use ($game): void {
        $voters = collect(range(1, $players))->map(fn () => pokerMember($game)[1]);

        foreach (range(1, $tasks) as $index) {
            $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

            foreach (range(1, $rounds) as $number) {
                $round = PokerRound::factory()->create(['poker_task_id' => $task->id]);
                $voters->each(fn (PokerPlayer $voter) => pokerVote($round, $voter, '3'));
            }

            $game->forceFill(['current_task_id' => $task->id])->save();
        }
    };
    $countQueries = function () use ($game, $facilitator): int {
        $fresh = $game->fresh();
        $viewer = $facilitator->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(BuildPokerSnapshot::class)->handle($fresh, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(3, 2, 2);
    $small = $countQueries();

    $seed(9, 5, 6);

    expect($countQueries())->toBe($small);
});
