<?php

use App\Actions\Poker\AutoRevealPokerRound;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerRoundChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{game: PokerGame, round: PokerRound, facilitatorUser: User, facilitator: PokerPlayer, memberUser: User, member: PokerPlayer, guest: PokerPlayer}
 */
function autoRevealTable(bool $autoReveal = true): array
{
    $game = PokerGame::factory()->withGuestAccess()->create(['auto_reveal' => $autoReveal]);
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $guest = pokerGuest($game);

    return [
        'game' => $game,
        'round' => openPokerRound($game),
        'facilitatorUser' => $facilitatorUser,
        'facilitator' => $facilitator,
        'memberUser' => $memberUser,
        'member' => $member,
        'guest' => $guest,
    ];
}

function autoReveal(PokerRound $round): bool
{
    return app(AutoRevealPokerRound::class)->handle($round->fresh());
}

it('never reveals while auto-reveal is off', function () {
    $table = autoRevealTable(autoReveal: false);
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '8');
    $table['round']->update(['timer_ends_at' => now()->subMinute()]);

    expect(autoReveal($table['round']))->toBeFalse()
        ->and($table['round']->fresh()->revealed_at)->toBeNull();
});

it('reveals when every online non-spectator player voted', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '8');

    expect(autoReveal($table['round']))->toBeTrue();

    $round = $table['round']->fresh();

    expect($round->revealed_at)->not->toBeNull()
        ->and($round->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted);
    Event::assertDispatched(PokerRoundChanged::class);
});

it('waits for an online player who has not voted', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    expect(autoReveal($table['round']))->toBeFalse()
        ->and($table['round']->fresh()->revealed_at)->toBeNull();
});

it('does not wait for offline players', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    expect(autoReveal($table['round']))->toBeTrue();
});

it('counts a vote of a player who went offline', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '8');

    expect(autoReveal($table['round']))->toBeTrue()
        ->and($table['round']->votes()->count())->toBe(2);
});

it('leaves spectators out of everyone-voted', function () {
    $table = autoRevealTable();
    $table['member']->update(['is_spectator' => true]);
    $table['facilitator']->update(['is_spectator' => true]);
    fakePokerRoster([$table['facilitator']->id, $table['member']->id, $table['guest']->id]);
    pokerVote($table['round'], $table['guest'], '3');

    expect(autoReveal($table['round']))->toBeTrue()
        ->and($table['round']->fresh()->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted);
});

it('never reveals when only spectators are online', function () {
    $table = autoRevealTable();
    $table['member']->update(['is_spectator' => true]);
    fakePokerRoster([$table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '3');

    expect(autoReveal($table['round']))->toBeFalse();
});

it('counts a player online in two tabs once', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '5');

    expect(autoReveal($table['round']))->toBeTrue();
});

it('never reveals a round without votes', function () {
    $table = autoRevealTable();
    fakePokerRoster([]);
    $table['round']->update(['timer_ends_at' => now()->subMinute()]);

    expect(autoReveal($table['round']))->toBeFalse();

    fakePokerRoster([$table['facilitator']->id]);

    expect(autoReveal($table['round']))->toBeFalse()
        ->and($table['round']->fresh()->revealed_at)->toBeNull();
});

it('reveals when the timer ended with at least one vote', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00'));
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    $table['round']->update(['timer_ends_at' => now()->addSeconds(30)]);

    expect(autoReveal($table['round']))->toBeFalse();

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:30'));

    expect(autoReveal($table['round']))->toBeTrue()
        ->and($table['round']->fresh()->reveal_reason)->toBe(PokerRevealReason::Timer);
});

it('falls back to the timer condition when the roster is unavailable', function () {
    $table = autoRevealTable();
    fakePokerRoster(null);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '5');
    pokerVote($table['round'], $table['guest'], '5');

    expect(autoReveal($table['round']))->toBeFalse();

    $table['round']->update(['timer_ends_at' => now()->subSecond()]);

    expect(autoReveal($table['round']))->toBeTrue()
        ->and($table['round']->fresh()->reveal_reason)->toBe(PokerRevealReason::Timer);
});

it('ignores roster ids that are not players of the game', function () {
    $table = autoRevealTable();
    $otherGame = PokerGame::factory()->create();
    [, $stranger] = pokerMember($otherGame);
    $gone = PokerPlayer::factory()->create(['poker_game_id' => $table['game']->id]);
    $goneId = $gone->id;
    $gone->delete();

    fakePokerRoster(['not-a-uuid', $stranger->id, $goneId]);
    pokerVote($table['round'], $table['facilitator'], '5');

    expect(autoReveal($table['round']))->toBeFalse();

    fakePokerRoster(['not-a-uuid', $stranger->id, $goneId, $table['facilitator']->id]);

    expect(autoReveal($table['round']))->toBeTrue();
});

it('reveals when auto-reveal is turned on for a round that already qualifies', function () {
    $table = autoRevealTable(autoReveal: false);
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '8');

    $this->actingAs($table['facilitatorUser'])
        ->patchJson(route('poker.settings.update', $table['game']), ['auto_reveal' => true])
        ->assertNoContent();

    expect($table['game']->fresh()->auto_reveal)->toBeTrue()
        ->and($table['round']->fresh()->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted);
});

it('reveals when the last non-voter switches to spectator', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    $this->actingAs($table['memberUser'])
        ->putJson(route('poker.players.spectator.update', [$table['game'], $table['member']]), ['spectator' => true])
        ->assertNoContent();

    expect($table['round']->fresh()->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted);
});

it('never reveals on a withdrawn vote', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '8');

    $this->actingAs($table['memberUser'])
        ->deleteJson(route('poker.rounds.vote.destroy', [$table['game'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('revealed', false);

    expect($table['round']->fresh()->revealed_at)->toBeNull();
});

it('answers revealed to the voter who completed the table', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    $this->actingAs($table['memberUser'])
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '8'])
        ->assertOk()
        ->assertJsonPath('revealed', true)
        ->assertJsonPath('myVote', '8');

    expect($table['round']->fresh()->revealed_at)->not->toBeNull();
    Event::assertDispatched(PokerRoundChanged::class, fn (PokerRoundChanged $event) => $event->gameId === $table['game']->id);
});

it('re-checks on demand for any player', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    $this->withCookies(pokerGuestCookie($table['guest']))
        ->withCredentials()
        ->postJson(route('poker.rounds.auto-reveal.store', [$table['game'], $table['round']]))
        ->assertOk()
        ->assertExactJson(['revealed' => false]);

    fakePokerRoster([$table['facilitator']->id]);

    $this->withCookies(pokerGuestCookie($table['guest']))
        ->withCredentials()
        ->postJson(route('poker.rounds.auto-reveal.store', [$table['game'], $table['round']]))
        ->assertOk()
        ->assertExactJson(['revealed' => true]);
});

it('never reveals on an ended game or a round that is not current', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    $older = $table['round'];
    pokerVote($older, $table['facilitator'], '5');
    $table['game']->update(['current_task_id' => null]);

    expect(autoReveal($older))->toBeFalse();

    $table['game']->update(['current_task_id' => $older->poker_task_id, 'ended_at' => now()]);

    expect(autoReveal($older))->toBeFalse()
        ->and($older->fresh()->revealed_at)->toBeNull();
});

it('never reveals an older round of the current task', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    $older = $table['round'];
    pokerVote($older, $table['facilitator'], '5');
    PokerRound::factory()->create(['poker_task_id' => $older->poker_task_id, 'number' => 2]);

    expect(autoReveal($older))->toBeFalse();
});

it('never sets the estimate', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    autoReveal($table['round']);

    expect($table['round']->task->fresh()->estimate)->toBeNull();
});

it('refuses the auto-reveal switch to other players', function () {
    $table = autoRevealTable(autoReveal: false);

    $this->actingAs($table['memberUser'])
        ->patchJson(route('poker.settings.update', $table['game']), ['auto_reveal' => true])
        ->assertForbidden();

    expect($table['game']->fresh()->auto_reveal)->toBeFalse();
});

it('throttles the auto-reveal route', function () {
    $route = Route::getRoutes()->getByName('poker.rounds.auto-reveal.store');

    expect($route->gatherMiddleware())->toContain('throttle:30,1');
});
