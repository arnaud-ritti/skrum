<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{game: PokerGame, round: PokerRound, users: array<string, User|null>, players: array<string, PokerPlayer>, values: array<string, string>}
 */
function anonymousTable(): array
{
    $game = PokerGame::factory()->withGuestAccess()->create(['anonymous_votes' => true]);
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $guest = pokerGuest($game);
    $round = openPokerRound($game);
    $round->update(['anonymous' => true]);

    return [
        'game' => $game,
        'round' => $round,
        'users' => ['F' => $facilitatorUser, 'M' => $memberUser, 'G' => null],
        'players' => ['F' => $facilitator, 'M' => $member, 'G' => $guest],
        'values' => ['F' => '8', 'M' => '13', 'G' => '3'],
    ];
}

/**
 * @param  array<string, mixed>  $round
 * @return array<string, string|null>
 */
function pokerRoundValuesByPlayer(array $round): array
{
    return collect($round['votes'])->pluck('value', 'playerId')->all();
}

/**
 * @param  array{players: array<string, PokerPlayer>, values: array<string, string>}  $table
 */
function expectNoOtherValueLinked(array $table, string $viewer, array|string $payload): void
{
    foreach ($table['players'] as $key => $player) {
        if ($key === $viewer) {
            continue;
        }

        expect(pokerPayloadExposes($payload, $player, $table['values'][$key]))
            ->toBeFalse("{$viewer} sees {$key}'s value linked to {$key}");
    }
}

/**
 * @param  array<string, mixed>  $round
 */
function expectFullDistribution(array $round): void
{
    expect(collect($round['result']['distribution'])->pluck('count', 'value')->all())
        ->toBe(['3' => 1, '8' => 1, '13' => 1]);
}

it('never links a value to another player in an anonymous round, for everyone', function () {
    $table = anonymousTable();
    ['game' => $game, 'round' => $round] = $table;

    foreach (['F', 'M', 'G'] as $viewer) {
        pokerViewerRequest($this, $table['users'][$viewer] ?? $table['players'][$viewer])
            ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => $table['values'][$viewer]])
            ->assertOk();
    }

    $voteEvents = Event::dispatched(PokerVoteChanged::class);

    expect($voteEvents)->toHaveCount(3);

    foreach ($voteEvents as [$event]) {
        expect(array_keys($event->broadcastWith()))->toBe(['roundId', 'playerId', 'hasVoted', 'votesCount', 'version']);
    }

    $reveal = pokerViewerRequest($this, $table['users']['F'])
        ->postJson(route('poker.rounds.reveal.store', [$game, $round]))
        ->assertOk();

    expectNoOtherValueLinked($table, 'F', $reveal->json());
    expect(pokerRoundValuesByPlayer($reveal->json()))->toBe([
        $table['players']['F']->id => '8',
        $table['players']['M']->id => null,
        $table['players']['G']->id => null,
    ]);
    expectFullDistribution($reveal->json());

    pokerViewerRequest($this, $table['users']['F'])
        ->putJson(route('poker.tasks.estimate.update', [$game, $round->task]), ['value' => '8'])
        ->assertOk();

    foreach (['F', 'M', 'G'] as $viewer) {
        $snapshot = resolve(BuildPokerSnapshot::class)->handle($game->fresh(), $table['players'][$viewer]->fresh());
        $current = $snapshot['current']['round'];

        expectNoOtherValueLinked($table, $viewer, $snapshot);
        expect($current['myVote'])->toBe($table['values'][$viewer])
            ->and(pokerRoundValuesByPlayer($current)[$table['players'][$viewer]->id])->toBe($table['values'][$viewer]);
        expectFullDistribution($current);

        $snapshotResponse = pokerViewerRequest($this, $table['users'][$viewer] ?? $table['players'][$viewer])
            ->getJson(route('poker.snapshot.show', $game))
            ->assertOk();
        expectNoOtherValueLinked($table, $viewer, $snapshotResponse->json());

        $history = pokerViewerRequest($this, $table['users'][$viewer] ?? $table['players'][$viewer])
            ->getJson(route('poker.tasks.rounds.index', [$game, $round->task]))
            ->assertOk();
        expectNoOtherValueLinked($table, $viewer, $history->json());
        expectFullDistribution($history->json()[0]);
    }

    foreach (['F', 'M'] as $viewer) {
        $page = pokerViewerRequest($this, $table['users'][$viewer] ?? $table['players'][$viewer])
            ->get(route('teams.estimates.index', [$game->team->workspace, $game->team]))
            ->assertOk();
        $props = $page->viewData('page')['props'];

        expectNoOtherValueLinked($table, $viewer, $props['tasks']);
        expectFullDistribution($props['tasks'][0]['rounds'][0]);
    }
});

it('hides even the voters\' values from the facilitator before reveal', function () {
    $table = anonymousTable();
    ['game' => $game, 'round' => $round, 'players' => $players] = $table;
    pokerVote($round, $players['M'], '13');

    $snapshot = resolve(BuildPokerSnapshot::class)->handle($game->fresh(), $players['F']->fresh());

    expect(pokerRoundValuesByPlayer($snapshot['current']['round']))->toBe([$players['M']->id => null])
        ->and($snapshot['current']['round']['result'])->toBeNull();
});

it('marks only unrevealed rounds anonymous when switched on', function () {
    $game = PokerGame::factory()->create();
    [$user, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $revealed = openPokerRound($game);
    pokerVote($revealed, $member, '5');
    $revealed->update(['revealed_at' => now()]);
    $open = openPokerRound($game);

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), ['anonymous_votes' => true])
        ->assertNoContent();

    expect($open->fresh()->anonymous)->toBeTrue()
        ->and($revealed->fresh()->anonymous)->toBeFalse()
        ->and($game->fresh()->anonymous_votes)->toBeTrue();

    $history = $this->actingAs($user)
        ->getJson(route('poker.tasks.rounds.index', [$game, $revealed->task]))
        ->assertOk();

    expect(pokerRoundValuesByPlayer($history->json()[0]))->toBe([$member->id => '5']);
});

it('never de-anonymizes when switched off', function () {
    $game = PokerGame::factory()->create(['anonymous_votes' => true]);
    [$user] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $revealed = openPokerRound($game);
    $revealed->update(['anonymous' => true]);
    pokerVote($revealed, $member, '5');
    $revealed->update(['revealed_at' => now()]);
    $open = openPokerRound($game);
    $open->update(['anonymous' => true]);

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), ['anonymous_votes' => false])
        ->assertNoContent();

    expect($revealed->fresh()->anonymous)->toBeTrue()
        ->and($open->fresh()->anonymous)->toBeTrue();

    $history = $this->actingAs($user)
        ->getJson(route('poker.tasks.rounds.index', [$game, $revealed->task]))
        ->assertOk();

    expect(pokerRoundValuesByPlayer($history->json()[0]))->toBe([$member->id => null]);
});

it('copies the setting into round 1 and re-vote rounds', function () {
    $game = PokerGame::factory()->create(['anonymous_votes' => true]);
    [$user, $facilitator] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($user)
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $task->id])
        ->assertNoContent();

    $first = $task->rounds()->sole();
    expect($first->anonymous)->toBeTrue();

    pokerVote($first, $facilitator, '5');
    $this->actingAs($user)->postJson(route('poker.rounds.reveal.store', [$game, $first]))->assertOk();
    $this->actingAs($user)->postJson(route('poker.tasks.rounds.store', [$game, $task]))->assertCreated();

    $second = $task->rounds()->where('number', 2)->sole();
    expect($second->anonymous)->toBeTrue();

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), ['anonymous_votes' => false])
        ->assertNoContent();

    pokerVote($second, $facilitator, '5');
    $this->actingAs($user)->postJson(route('poker.rounds.reveal.store', [$game, $second]))->assertOk();
    $this->actingAs($user)->postJson(route('poker.tasks.rounds.store', [$game, $task]))->assertCreated();

    expect($task->rounds()->where('number', 3)->sole()->anonymous)->toBeFalse()
        ->and($second->fresh()->anonymous)->toBeTrue();
});
