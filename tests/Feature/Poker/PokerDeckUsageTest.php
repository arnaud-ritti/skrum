<?php

use App\Models\PokerGame;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('stores the saved deck id on a game created from a saved deck', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id]);

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $deck->id,
        ])
        ->assertSessionHasNoErrors();

    expect($team->pokerGames()->sole()->saved_deck_id)->toBe($deck->id)
        ->and($deck->games()->count())->toBe(1);
});

it('stores no saved deck id on a game created from a built-in deck', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), ['title' => 'Sprint 7', 'deck' => 'fibonacci'])
        ->assertSessionHasNoErrors();

    expect($team->pokerGames()->sole()->saved_deck_id)->toBeNull();
});

it('clears the saved deck id when the game changes its deck', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id]);

    $this->actingAs($member)->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
        'title' => 'Sprint 7',
        'deck' => 'custom',
        'saved_deck_id' => $deck->id,
    ]);

    $game = $team->pokerGames()->sole();

    $this->actingAs($member)
        ->patch(route('poker.settings.update', $game), ['deck' => 'tshirt'])
        ->assertNoContent();

    expect($game->fresh()->saved_deck_id)->toBeNull();
});

it('sets the saved deck id when the game switches to a saved deck', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id]);

    $this->actingAs($member)->post(route('teams.pokerGames.store', [$team->workspace, $team]), ['title' => 'S', 'deck' => 'fibonacci']);

    $game = $team->pokerGames()->sole();

    $this->actingAs($member)
        ->patch(route('poker.settings.update', $game), ['saved_deck_id' => $deck->id])
        ->assertNoContent();

    expect($game->fresh()->saved_deck_id)->toBe($deck->id);
});

it('counts no game created before the change', function () {
    $team = Team::factory()->create();
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Team scale', 'cards' => ['1', '2']]);

    PokerGame::factory()->customCards(['1', '2'])->create(['team_id' => $team->id, 'deck_name' => 'Team scale']);

    expect($deck->games()->count())->toBe(0);
});

it('nulls the saved deck id of games when the deck is deleted', function () {
    $team = Team::factory()->create();
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $game->forceFill(['saved_deck_id' => $deck->id])->save();

    $deck->delete();

    expect($game->fresh()->saved_deck_id)->toBeNull();
});
