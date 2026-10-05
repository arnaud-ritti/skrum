<?php

use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerRound;
use Illuminate\Support\Facades\Event;

function revealedTable(bool $revote): array
{
    $table = pokerRevealTable();
    $table['game']->update(['revote_after_reveal' => $revote]);
    pokerVote($table['round'], $table['memberPlayer'], '3');
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    $table['round']->update(['revealed_at' => now()]);

    return $table;
}

it('lets a player change their card after reveal until the estimate is saved', function () {
    Event::fake([PokerRoundChanged::class, PokerVoteChanged::class]);
    $table = revealedTable(revote: true);

    $this->actingAs($table['member'])
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '5'])
        ->assertOk()
        ->assertJsonPath('myVote', '5')
        ->assertJsonPath('revealed', true);

    $this->actingAs($table['facilitator'])
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertJsonPath('current.round.result.consensus', true);

    Event::assertDispatched(PokerRoundChanged::class);
    Event::assertNotDispatched(PokerVoteChanged::class);
});

it('closes the revealed round once the estimate is saved', function () {
    $table = revealedTable(revote: true);
    $task = $table['round']->task;

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => '5'])
        ->assertOk();

    $this->actingAs($table['member'])
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '8'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'Voting is closed for this round.']);
});

it('refuses a change after reveal when the game does not allow it, and a withdrawal always', function () {
    $closed = revealedTable(revote: false);

    $this->actingAs($closed['member'])
        ->putJson(route('poker.rounds.vote.update', [$closed['game'], $closed['round']]), ['value' => '5'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'Voting is closed for this round.']);

    expect($closed['round']->votes()->where('poker_player_id', $closed['memberPlayer']->id)->value('value'))->toBe('3');

    $open = revealedTable(revote: true);

    $this->actingAs($open['member'])
        ->deleteJson(route('poker.rounds.vote.destroy', [$open['game'], $open['round']]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'Voting is closed for this round.']);

    expect($open['round']->votes()->where('poker_player_id', $open['memberPlayer']->id)->value('value'))->toBe('3');
});

it('still refuses a second reveal and a timer on a revealed round', function () {
    $table = revealedTable(revote: true);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$table['game'], $table['round']]))
        ->assertUnprocessable();

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.rounds.timer.update', [$table['game'], $table['round']]), ['seconds' => 60])
        ->assertUnprocessable();
});

it('refuses a change in a revealed round that is not the latest', function () {
    $table = revealedTable(revote: true);
    $next = PokerRound::factory()->create(['poker_task_id' => $table['round']->poker_task_id]);

    $this->actingAs($table['member'])
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '5'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'Voting is closed for this round.']);

    expect($table['round']->votes()->where('poker_player_id', $table['memberPlayer']->id)->value('value'))->toBe('3')
        ->and($next->votes()->count())->toBe(0);
});

it('lets a guest change their card after reveal', function () {
    $table = revealedTable(revote: true);
    $guest = pokerGuest($table['game']);
    pokerVote($table['round'], $guest, '8');

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '3'])
        ->assertOk()
        ->assertJsonPath('myVote', '3');

    expect($table['round']->votes()->where('poker_player_id', $guest->id)->value('value'))->toBe('3');
});

it('refuses a card after reveal to a spectator', function () {
    $table = revealedTable(revote: true);
    $table['memberPlayer']->update(['is_spectator' => true]);

    $this->actingAs($table['member'])
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '8'])
        ->assertForbidden();

    expect($table['round']->votes()->where('poker_player_id', $table['memberPlayer']->id)->value('value'))->toBe('3');
});

it('refuses a card after reveal once the game is ended', function () {
    $table = revealedTable(revote: true);
    $table['game']->forceFill(['ended_at' => now()])->save();

    $this->actingAs($table['member'])
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '8'])
        ->assertForbidden();

    expect($table['round']->votes()->where('poker_player_id', $table['memberPlayer']->id)->value('value'))->toBe('3');
});
