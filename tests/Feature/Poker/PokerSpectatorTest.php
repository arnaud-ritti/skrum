<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Actions\Poker\PlayPokerCard;
use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: PokerGame, 1: array{0: User, 1: PokerPlayer}, 2: array{0: User, 1: PokerPlayer}, 3: PokerRound}
 */
function spectatorTable(): array
{
    $game = PokerGame::factory()->withGuestAccess()->create();
    $facilitator = pokerFacilitator($game);
    $member = pokerMember($game);
    $round = openPokerRound($game);

    return [$game, $facilitator, $member, $round];
}

it('switches oneself to spectator and back', function () {
    [$game, , [$user, $member]] = spectatorTable();

    $this->actingAs($user)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => true])
        ->assertNoContent();

    expect($member->fresh()->is_spectator)->toBeTrue();
    Event::assertDispatched(PokerGameChanged::class, fn (PokerGameChanged $event) => $event->gameId === $game->id);

    $this->actingAs($user)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => false])
        ->assertNoContent();

    expect($member->fresh()->is_spectator)->toBeFalse();
});

it('lets the facilitator switch any player, guests included', function () {
    [$game, [$facilitatorUser], [, $member]] = spectatorTable();
    $guest = pokerGuest($game);

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => true])
        ->assertNoContent();

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.players.spectator.update', [$game, $guest]), ['spectator' => true])
        ->assertNoContent();

    expect($member->fresh()->is_spectator)->toBeTrue()
        ->and($guest->fresh()->is_spectator)->toBeTrue();
});

it('refuses other players switching someone else', function () {
    [$game, [, $facilitator], [$memberUser]] = spectatorTable();
    $guest = pokerGuest($game);

    $this->actingAs($memberUser)
        ->putJson(route('poker.players.spectator.update', [$game, $facilitator]), ['spectator' => true])
        ->assertForbidden();

    Auth::forgetGuards();

    $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->putJson(route('poker.players.spectator.update', [$game, $facilitator]), ['spectator' => true])
        ->assertForbidden();

    expect($facilitator->fresh()->is_spectator)->toBeFalse();
});

it('refuses switches on an ended game', function () {
    [$game, , [$user, $member]] = spectatorTable();
    $game->update(['ended_at' => now(), 'current_task_id' => null]);

    $this->actingAs($user)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => true])
        ->assertForbidden();

    expect($member->fresh()->is_spectator)->toBeFalse();
});

it('withdraws the spectator\'s votes from every unrevealed round', function () {
    [$game, [, $facilitator], [$user, $member], $openRound] = spectatorTable();
    $otherTask = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $leftOpen = PokerRound::factory()->create(['poker_task_id' => $otherTask->id]);
    $revealedTask = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $revealed = PokerRound::factory()->revealed()->create(['poker_task_id' => $revealedTask->id]);

    pokerVote($openRound, $member, '5');
    pokerVote($openRound, $facilitator, '8');
    pokerVote($leftOpen, $member, '3');
    pokerVote($revealed, $member, '13');
    $openRound->update(['version' => 4]);

    $this->actingAs($user)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => true])
        ->assertNoContent();

    expect($openRound->votes()->pluck('poker_player_id')->all())->toBe([$facilitator->id])
        ->and($openRound->fresh()->version)->toBe(5)
        ->and($leftOpen->votes()->count())->toBe(0)
        ->and($leftOpen->fresh()->version)->toBe(1)
        ->and($revealed->votes()->where('poker_player_id', $member->id)->value('value'))->toBe('13')
        ->and($revealed->fresh()->version)->toBe(0);

    Event::assertDispatchedTimes(PokerVoteChanged::class, 2);
    Event::assertDispatched(PokerVoteChanged::class, fn (PokerVoteChanged $event) => $event->broadcastWith() === [
        'roundId' => $openRound->id,
        'playerId' => $member->id,
        'hasVoted' => false,
        'votesCount' => 1,
        'version' => 5,
    ]);
    Event::assertDispatched(PokerVoteChanged::class, fn (PokerVoteChanged $event) => $event->roundId === $leftOpen->id
        && $event->votesCount === 0);
});

it('does nothing when the role does not change', function () {
    [$game, , [$user, $member], $round] = spectatorTable();
    pokerVote($round, $member, '5');

    $this->actingAs($user)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => false])
        ->assertNoContent();

    expect($round->votes()->count())->toBe(1);
    Event::assertNotDispatched(PokerGameChanged::class);
});

it('refuses a spectator\'s vote', function () {
    [$game, , [$user, $member], $round] = spectatorTable();
    $member->update(['is_spectator' => true]);

    $this->actingAs($user)
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => '5'])
        ->assertForbidden()
        ->assertJsonPath('message', "Spectators can't vote.");

    expect($round->votes()->count())->toBe(0);
});

it('never leaves a spectator vote when the switch races the vote', function () {
    [$game, , [, $member], $round] = spectatorTable();
    $staleMember = PokerPlayer::query()->findOrFail($member->id);

    PokerPlayer::query()->whereKey($member->id)->update(['is_spectator' => true]);

    expect(fn () => app(PlayPokerCard::class)->handle($game->fresh(), $round->fresh(), $staleMember, '5'))
        ->toThrow(AuthorizationException::class);

    expect($round->votes()->count())->toBe(0);
});

it('lets a spectating facilitator facilitate but not vote', function () {
    [$game, [$facilitatorUser, $facilitator], [$memberUser], $round] = spectatorTable();
    $task = $round->task;

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.players.spectator.update', [$game, $facilitator]), ['spectator' => true])
        ->assertNoContent();

    $this->actingAs($memberUser)
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => '5'])
        ->assertOk();

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => '8'])
        ->assertForbidden();

    $this->actingAs($facilitatorUser)
        ->postJson(route('poker.rounds.reveal.store', [$game, $round]))
        ->assertOk();

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.tasks.estimate.update', [$game, $task]), ['value' => '5'])
        ->assertOk();

    $this->actingAs($facilitatorUser)
        ->postJson(route('poker.tasks.rounds.store', [$game, $task]))
        ->assertCreated();

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.players.spectator.update', [$game, $facilitator]), ['spectator' => false])
        ->assertNoContent();

    $newRound = $task->rounds()->where('number', 2)->sole();

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.rounds.vote.update', [$game, $newRound]), ['value' => '8'])
        ->assertOk();

    expect($task->fresh()->estimate)->toBe('5')
        ->and($newRound->votes()->where('poker_player_id', $facilitator->id)->value('value'))->toBe('8');
});

it('lets non-guest spectators add tasks', function () {
    [$game, , [$user, $member]] = spectatorTable();
    $member->update(['is_spectator' => true]);

    $this->actingAs($user)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Login page'])
        ->assertCreated();
});

it('joins as a spectator from the guest link', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();

    $this->post(route('poker.join.store', $game->guest_token), ['name' => 'Watcher', 'spectator' => true])
        ->assertRedirect(route('poker.show', $game));

    $this->post(route('poker.join.store', $game->guest_token), ['name' => 'Player'])
        ->assertRedirect(route('poker.show', $game));

    expect($game->players()->where('guest_name', 'Watcher')->sole()->is_spectator)->toBeTrue()
        ->and($game->players()->where('guest_name', 'Player')->sole()->is_spectator)->toBeFalse();
});

it('keeps the stored role when a guest resumes', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $guest = pokerGuest($game);
    $guest->update(['is_spectator' => true]);

    $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertOk()
        ->assertJsonPath('me.isSpectator', true)
        ->assertJsonPath('me.canVote', false);
});

it('exposes isSpectator and canVote in the snapshot', function () {
    [$game, [, $facilitator], [, $member]] = spectatorTable();
    $member->update(['is_spectator' => true]);

    $asMember = app(BuildPokerSnapshot::class)->handle($game->fresh(), $member->fresh());
    $asFacilitator = app(BuildPokerSnapshot::class)->handle($game->fresh(), $facilitator->fresh());

    expect($asMember['me']['isSpectator'])->toBeTrue()
        ->and($asMember['me']['canVote'])->toBeFalse()
        ->and($asFacilitator['me']['canVote'])->toBeTrue()
        ->and(collect($asFacilitator['players'])->firstWhere('id', $member->id)['isSpectator'])->toBeTrue()
        ->and(collect($asFacilitator['players'])->firstWhere('id', $facilitator->id)['isSpectator'])->toBeFalse();
});
