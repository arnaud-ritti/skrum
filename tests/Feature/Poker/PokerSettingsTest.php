<?php

use App\Enums\PokerDeck;
use App\Events\Poker\PokerGameChanged;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('renames the game', function () {
    $game = PokerGame::factory()->create(['title' => 'Old']);
    [$facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['title' => 'Sprint 12 sizing'])
        ->assertNoContent();

    expect($game->fresh()->title)->toBe('Sprint 12 sizing');

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['title' => str_repeat('a', 121)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('title');
});

it('changes the deck until votes exist', function () {
    $game = PokerGame::factory()->create(['deck_name' => 'Team scale']);
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'tshirt'])
        ->assertNoContent();

    $game->refresh();

    expect($game->deck)->toBe(PokerDeck::Tshirt)
        ->and($game->cards)->toBe(PokerDeck::Tshirt->cards())
        ->and($game->deck_name)->toBeNull();

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), [
            'deck' => 'custom',
            'custom_cards' => ['1', '2', '3'],
            'include_unknown' => false,
            'include_coffee' => false,
        ])
        ->assertNoContent();

    expect($game->fresh()->cards)->toBe(['1', '2', '3']);

    pokerVote(openPokerRound($game->fresh()), $facilitatorPlayer, '2');

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'fibonacci'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['deck' => "The deck can't change once votes exist."]);

    expect($game->fresh()->cards)->toBe(['1', '2', '3']);

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['title' => 'Still renamable'])
        ->assertNoContent();
});

it('toggles guest access', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['guest_access_enabled' => true])
        ->assertNoContent();

    expect($game->fresh()->guest_access_enabled)->toBeTrue();

    $this->actingAs($facilitator)
        ->getJson(route('poker.snapshot.show', $game))
        ->assertJsonPath('game.guestAccessEnabled', true)
        ->assertJsonPath('game.guestUrl', route('poker.join.show', $game->fresh()->guest_token));

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['guest_access_enabled' => false])
        ->assertNoContent();

    expect($game->fresh()->guest_access_enabled)->toBeFalse();
});

it('is facilitator-only', function () {
    $game = PokerGame::factory()->create();
    pokerFacilitator($game);
    [$member] = pokerMember($game);

    $this->actingAs($member)->patchJson(route('poker.settings.update', $game), ['title' => 'Mine'])->assertForbidden();
    $this->actingAs($member)->putJson(route('poker.status.update', $game), ['ended' => true])->assertForbidden();
    $this->actingAs($member)->postJson(route('poker.guest-token.store', $game))->assertForbidden();

    expect($game->fresh()->ended_at)->toBeNull();
    Event::assertNotDispatched(PokerGameChanged::class);
});

it('ends and reopens a game', function () {
    $table = pokerRevealTable();
    $game = $table['game'];
    $round = $table['round'];

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.status.update', $game), ['ended' => true])
        ->assertNoContent();

    $game->refresh();

    expect($game->ended_at)->not->toBeNull()
        ->and($game->current_task_id)->toBeNull();

    $this->actingAs($table['facilitator'])
        ->patchJson(route('poker.settings.update', $game), ['title' => 'Nope'])
        ->assertForbidden()
        ->assertJsonPath('message', 'This game has ended.');
    $this->actingAs($table['member'])
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Late task'])
        ->assertForbidden();
    $this->actingAs($table['member'])
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => '5'])
        ->assertForbidden();
    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $round->poker_task_id])
        ->assertForbidden();
    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.guest-token.store', $game))
        ->assertForbidden();

    expect(PokerTask::query()->where('title', 'Late task')->exists())->toBeFalse()
        ->and($round->votes()->count())->toBe(0);

    $this->actingAs($table['facilitator'])
        ->getJson(route('poker.snapshot.show', $game))
        ->assertOk()
        ->assertJsonPath('current', null);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.status.update', $game), ['ended' => false])
        ->assertNoContent();

    expect($game->fresh()->ended_at)->toBeNull();

    $this->actingAs($table['facilitator'])
        ->patchJson(route('poker.settings.update', $game), ['title' => 'Back again'])
        ->assertNoContent();
});

it('regenerates the guest link and signs guests out', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    [$facilitator] = pokerFacilitator($game);
    $guest = pokerGuest($game);
    $oldToken = $game->guest_token;

    $response = $this->actingAs($facilitator)
        ->postJson(route('poker.guest-token.store', $game))
        ->assertOk();

    $game->refresh();

    expect($game->guest_token)->not->toBe($oldToken)
        ->and($response->json('guestUrl'))->toBe(route('poker.join.show', $game->guest_token))
        ->and($guest->fresh()->guest_secret_hash)->toBeNull()
        ->and($guest->fresh()->guest_name)->not->toBeNull();

    resolve('auth')->forgetGuards();

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertForbidden();

    $this->get(route('poker.join.show', $oldToken))->assertNotFound();
    Event::assertDispatched(PokerGameChanged::class);
});

it('broadcasts game changes', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['title' => 'Renamed'])
        ->assertNoContent();

    $this->actingAs($facilitator)
        ->putJson(route('poker.status.update', $game), ['ended' => true])
        ->assertNoContent();

    Event::assertDispatchedTimes(PokerGameChanged::class, 2);
    Event::assertDispatched(fn (PokerGameChanged $event) => $event->gameId === $game->id
        && $event->broadcastWith() === []);
});
