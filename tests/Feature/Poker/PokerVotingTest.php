<?php

use App\Actions\Poker\PlayPokerCard;
use App\Enums\PokerDeck;
use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{
 *     game: PokerGame,
 *     round: PokerRound,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer
 * }
 */
function pokerVotingSetup(PokerDeck $deck = PokerDeck::Fibonacci): array
{
    $game = PokerGame::factory()->deck($deck)->withGuestAccess()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    return [
        'game' => $game,
        'round' => openPokerRound($game),
        'facilitator' => $facilitator,
        'facilitatorPlayer' => $facilitatorPlayer,
        'member' => $member,
        'memberPlayer' => $memberPlayer,
    ];
}

function castPokerVote(mixed $test, User $user, PokerGame $game, PokerRound $round, string $value): mixed
{
    return $test->actingAs($user)->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => $value]);
}

it('creates round 1 when a task is first selected', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($facilitator)
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $task->id])
        ->assertNoContent();

    $round = $task->rounds()->sole();

    expect($game->fresh()->current_task_id)->toBe($task->id)
        ->and($round->number)->toBe(1)
        ->and($round->isRevealed())->toBeFalse()
        ->and($round->timer_ends_at)->toBeNull();
    Event::assertDispatched(fn (PokerRoundChanged $event) => $event->gameId === $game->id);
});

it('copies anonymous votes into round 1', function () {
    $game = PokerGame::factory()->create(['anonymous_votes' => true]);
    [$facilitator] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($facilitator)
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $task->id])
        ->assertNoContent();

    expect($task->rounds()->sole()->anonymous)->toBeTrue();
});

it('resumes an open round with its hidden votes', function () {
    ['game' => $game, 'round' => $round, 'facilitator' => $facilitator, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();
    pokerVote($round, $memberPlayer, '8');
    $other = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($facilitator)->putJson(route('poker.current-task.update', $game), ['task_id' => $other->id])->assertNoContent();
    $this->actingAs($facilitator)->putJson(route('poker.current-task.update', $game), ['task_id' => $round->poker_task_id])->assertNoContent();

    expect($round->task->rounds()->count())->toBe(1)
        ->and($round->votes()->sole()->value)->toBe('8')
        ->and($game->fresh()->latestRoundOfCurrentTask()?->id)->toBe($round->id);
});

it('clears the current task', function () {
    ['game' => $game, 'facilitator' => $facilitator] = pokerVotingSetup();

    $this->actingAs($facilitator)->putJson(route('poker.current-task.update', $game), ['task_id' => null])->assertNoContent();

    expect($game->fresh()->current_task_id)->toBeNull();
});

it('refuses tasks of another game', function () {
    ['game' => $game, 'facilitator' => $facilitator] = pokerVotingSetup();
    $foreign = PokerTask::factory()->create();

    $this->actingAs($facilitator)
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $foreign->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('task_id');
});

it('lets only the facilitator select', function () {
    ['game' => $game, 'member' => $member] = pokerVotingSetup();
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($member)
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $task->id])
        ->assertForbidden()
        ->assertJsonPath('message', 'Only the facilitator can do this.');

    expect($task->rounds()->count())->toBe(0);
});

it('votes, replaces and withdraws', function () {
    ['game' => $game, 'round' => $round, 'member' => $member, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();

    castPokerVote($this, $member, $game, $round, '5')
        ->assertOk()
        ->assertExactJson(['roundId' => $round->id, 'myVote' => '5', 'votesCount' => 1, 'version' => 1, 'revealed' => false]);

    castPokerVote($this, $member, $game, $round, '8')
        ->assertOk()
        ->assertJsonPath('myVote', '8')
        ->assertJsonPath('votesCount', 1)
        ->assertJsonPath('version', 2);

    expect($round->votes()->sole()->only(['poker_player_id', 'value']))
        ->toBe(['poker_player_id' => $memberPlayer->id, 'value' => '8']);

    $this->actingAs($member)
        ->deleteJson(route('poker.rounds.vote.destroy', [$game, $round]))
        ->assertOk()
        ->assertExactJson(['roundId' => $round->id, 'myVote' => null, 'votesCount' => 0, 'version' => 3, 'revealed' => false]);

    expect($round->votes()->count())->toBe(0);
});

it('accepts ½ and ☕ where the deck has them', function (string $value) {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup(PokerDeck::ModifiedFibonacci);

    castPokerVote($this, $member, $game, $round, $value)->assertOk()->assertJsonPath('myVote', $value);
})->with(['½', '☕', '?', '100']);

it('refuses values outside the deck', function (PokerDeck $deck, string $value) {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup($deck);

    castPokerVote($this, $member, $game, $round, $value)
        ->assertUnprocessable()
        ->assertJsonPath('errors.value.0', 'Choose a card from the deck.');

    expect($round->votes()->count())->toBe(0);
})->with([
    'not fibonacci' => [PokerDeck::Fibonacci, '4'],
    'half outside modified' => [PokerDeck::Fibonacci, '½'],
    'number in t-shirt' => [PokerDeck::Tshirt, '5'],
    'lowercase size' => [PokerDeck::Tshirt, 'm'],
]);

it('requires a value', function () {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup();

    $this->actingAs($member)
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('value');
});

it('refuses votes on closed, older or non-current rounds', function (string $case) {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup();

    $target = match ($case) {
        'revealed' => tap($round)->update(['revealed_at' => now()]),
        'older' => tap($round, function (PokerRound $round): void {
            $round->update(['revealed_at' => now()]);
            PokerRound::factory()->create(['poker_task_id' => $round->poker_task_id, 'number' => 2]);
        }),
        'not current' => PokerRound::factory()->create([
            'poker_task_id' => PokerTask::factory()->create(['poker_game_id' => $game->id])->id,
        ]),
    };

    castPokerVote($this, $member, $game, $target, '5')
        ->assertUnprocessable()
        ->assertJsonPath('errors.votes.0', 'Voting is closed for this round.');

    expect($target->votes()->count())->toBe(0);
})->with(['revealed', 'older', 'not current']);

it('ignores a playerId in the body', function () {
    ['game' => $game, 'round' => $round, 'facilitator' => $facilitator, 'facilitatorPlayer' => $facilitatorPlayer, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();

    $this->actingAs($facilitator)
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), [
            'value' => '13',
            'playerId' => $memberPlayer->id,
            'player_id' => $memberPlayer->id,
            'poker_player_id' => $memberPlayer->id,
        ])
        ->assertOk();

    expect($round->votes()->sole()->poker_player_id)->toBe($facilitatorPlayer->id);
});

it('lets guests and the facilitator vote', function () {
    ['game' => $game, 'round' => $round, 'facilitator' => $facilitator] = pokerVotingSetup();
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => '3'])
        ->assertOk()
        ->assertJsonPath('myVote', '3');

    castPokerVote($this, $facilitator, $game, $round, '5')
        ->assertOk()
        ->assertJsonPath('votesCount', 2);
});

it('refuses votes on an ended game', function () {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup();
    $game->update(['ended_at' => now()]);

    castPokerVote($this, $member, $game, $round, '5')
        ->assertForbidden()
        ->assertJsonPath('message', 'This game has ended.');
    $this->actingAs($member)->deleteJson(route('poker.rounds.vote.destroy', [$game, $round]))->assertForbidden();
});

it('refuses spectators', function () {
    ['game' => $game, 'round' => $round, 'member' => $member, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();
    $memberPlayer->update(['is_spectator' => true]);

    castPokerVote($this, $member, $game, $round, '5')
        ->assertForbidden()
        ->assertJsonPath('message', "Spectators can't vote.");

    expect($round->votes()->count())->toBe(0);
});

it('refuses a vote after a concurrent reveal', function () {
    ['game' => $game, 'round' => $round, 'facilitatorPlayer' => $facilitatorPlayer, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();
    pokerVote($round, $facilitatorPlayer, '3');
    $staleRound = PokerRound::query()->findOrFail($round->id);

    PokerRound::query()->whereKey($round->id)->update(['revealed_at' => now()]);

    expect(fn () => resolve(PlayPokerCard::class)->handle($game->fresh(), $staleRound, $memberPlayer->fresh(), '5'))
        ->toThrow(ValidationException::class, 'Voting is closed for this round.')
        ->and($round->votes()->count())->toBe(1);
});

it('answers 404 for a round of a deleted task', function () {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup();
    $round->task->delete();

    castPokerVote($this, $member, $game, $round, '5')->assertNotFound();
});

it('answers 404 for a round of another game', function () {
    ['game' => $game, 'member' => $member] = pokerVotingSetup();
    $foreign = openPokerRound(PokerGame::factory()->create());

    castPokerVote($this, $member, $game, $foreign, '5')->assertNotFound();
});

it('broadcasts vote changes without values', function () {
    ['game' => $game, 'round' => $round, 'member' => $member, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();

    castPokerVote($this, $member, $game, $round, '13')->assertOk();
    $this->actingAs($member)->deleteJson(route('poker.rounds.vote.destroy', [$game, $round]))->assertOk();

    Event::assertDispatched(fn (PokerVoteChanged $event) => $event->broadcastWith() === [
        'roundId' => $round->id,
        'playerId' => $memberPlayer->id,
        'hasVoted' => true,
        'votesCount' => 1,
        'version' => 1,
    ]);
    Event::assertDispatched(fn (PokerVoteChanged $event) => $event->broadcastWith() === [
        'roundId' => $round->id,
        'playerId' => $memberPlayer->id,
        'hasVoted' => false,
        'votesCount' => 0,
        'version' => 2,
    ]);
    Event::assertNotDispatched(PokerVoteChanged::class, fn (PokerVoteChanged $event) => str_contains((string) json_encode($event->broadcastWith()), '"13"'));
});

it('increments the version on every change', function () {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup();

    castPokerVote($this, $member, $game, $round, '5')->assertJsonPath('version', 1);
    castPokerVote($this, $member, $game, $round, '5')->assertJsonPath('version', 1);
    castPokerVote($this, $member, $game, $round, '8')->assertJsonPath('version', 2);
    $this->actingAs($member)->deleteJson(route('poker.rounds.vote.destroy', [$game, $round]))->assertJsonPath('version', 3);
    $this->actingAs($member)->deleteJson(route('poker.rounds.vote.destroy', [$game, $round]))->assertJsonPath('version', 3);

    expect($round->fresh()->version)->toBe(3)
        ->and(PokerVote::query()->count())->toBe(0);
    Event::assertDispatched(PokerVoteChanged::class, 3);
});
