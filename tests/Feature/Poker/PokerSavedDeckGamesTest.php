<?php

use App\Actions\Poker\CreatePokerGame;
use App\Actions\Poker\NewPokerGame;
use App\Actions\Poker\SavedPokerDeckRules;
use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Team, 1: User, 2: SavedPokerDeck}
 */
function savedDeckTeam(): array
{
    $team = Team::factory()->create();
    $user = teamMember($team);
    $deck = SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'created_by_user_id' => $user->id,
        'name' => 'Team scale',
        'cards' => ['1', '2', '4', '8', '?'],
    ]);

    return [$team, $user, $deck];
}

it('creates a game from a saved deck by copying it', function () {
    [$team, $user, $deck] = savedDeckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $deck->id,
        ])
        ->assertSessionHasNoErrors();

    $game = $team->pokerGames()->sole();

    expect($game->deck)->toBe(PokerDeck::Custom)
        ->and($game->cards)->toBe(['1', '2', '4', '8', '?'])
        ->and($game->deck_name)->toBe('Team scale')
        ->and($game->deckLabel())->toBe('Team scale');
});

it('keeps the game unchanged when the saved deck is edited or deleted', function () {
    [$team, $user, $deck] = savedDeckTeam();

    $this->actingAs($user)->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
        'title' => 'Sprint 7',
        'deck' => 'custom',
        'saved_deck_id' => $deck->id,
    ])->assertSessionHasNoErrors();

    $game = $team->pokerGames()->sole();

    $this->actingAs($user)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $deck]), [
            'name' => 'Renamed',
            'cards' => ['XS', 'S'],
            'include_unknown' => false,
            'include_coffee' => false,
        ])
        ->assertSessionHasNoErrors();

    expect($game->fresh()->cards)->toBe(['1', '2', '4', '8', '?'])
        ->and($game->fresh()->deck_name)->toBe('Team scale');

    $this->actingAs($user)->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))->assertRedirect();

    expect($game->fresh()->cards)->toBe(['1', '2', '4', '8', '?'])
        ->and($game->fresh()->deck_name)->toBe('Team scale');
});

it('refuses foreign or mixed deck choices', function () {
    [$team, $user, $deck] = savedDeckTeam();
    [$otherTeam, , $foreign] = savedDeckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $foreign->id,
        ])
        ->assertSessionHasErrors(['saved_deck_id' => 'Choose a saved deck of this team.']);

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $deck->id,
            'custom_cards' => ['1', '2'],
        ])
        ->assertSessionHasErrors(['saved_deck_id' => 'Choose either a saved deck or custom cards.']);

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => 'not-a-uuid',
        ])
        ->assertSessionHasErrors('saved_deck_id');

    expect($team->pokerGames()->count())->toBe(0)
        ->and($otherTeam->pokerGames()->count())->toBe(0);
});

it('saves the custom cards as a deck while creating the game', function () {
    [$team, $user] = savedDeckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'custom_cards' => ['1', '3', '5'],
            'include_unknown' => true,
            'include_coffee' => false,
            'save_deck_as' => 'Odd scale',
        ])
        ->assertSessionHasNoErrors();

    $saved = $team->pokerDecks()->where('name', 'Odd scale')->sole();
    $game = $team->pokerGames()->sole();

    expect($saved->cards)->toBe(['1', '3', '5', '?'])
        ->and($saved->created_by_user_id)->toBe($user->id)
        ->and($game->cards)->toBe(['1', '3', '5', '?'])
        ->and($game->deck_name)->toBe('Odd scale');
});

it('creates nothing when the deck cannot be saved', function (string $case) {
    [$team, $user] = savedDeckTeam();

    if ($case === 'limit') {
        SavedPokerDeck::factory()->count(SavedPokerDeckRules::MaxDecks - 1)->create(['team_id' => $team->id]);
    }

    $name = $case === 'duplicate' ? 'TEAM SCALE' : 'Fresh name';

    $response = $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'custom_cards' => ['1', '3', '5'],
            'save_deck_as' => $name,
        ]);

    $response->assertSessionHasErrors(['save_deck_as' => $case === 'limit' ? 'This team already has '.SavedPokerDeckRules::MaxDecks.' saved decks.' : 'A deck with this name already exists.']);

    expect($team->pokerGames()->count())->toBe(0)
        ->and($team->pokerDecks()->count())->toBe($case === 'limit' ? SavedPokerDeckRules::MaxDecks : 1);
})->with(['duplicate', 'limit']);

it('refuses a deck name taken after the request was validated, under the team lock', function () {
    [$team, $user] = savedDeckTeam();
    $new = new NewPokerGame(title: 'Sprint 7', deck: PokerDeck::Custom, cards: ['1', '3', '5'], saveDeckAs: 'team scale');

    expect(fn () => resolve(CreatePokerGame::class)->handle($team, $user, $new))
        ->toThrow(fn (ValidationException $exception) => expect($exception->errors())->toBe(['save_deck_as' => ['A deck with this name already exists.']]))
        ->and($team->pokerGames()->count())->toBe(0)
        ->and($team->pokerDecks()->count())->toBe(1);
});

it('saves only custom cards as a deck', function () {
    [$team, $user, $deck] = savedDeckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'fibonacci',
            'save_deck_as' => 'Fibo copy',
        ])
        ->assertSessionHasErrors(['save_deck_as' => 'Save only custom cards as a deck.']);

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $deck->id,
            'save_deck_as' => 'Copy',
        ])
        ->assertSessionHasErrors('save_deck_as');

    expect($team->pokerGames()->count())->toBe(0);
});

it('lists the team decks to the facilitator only', function () {
    [$team, $user, $deck] = savedDeckTeam();
    SavedPokerDeck::factory()->create(['name' => 'Elsewhere']);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    [$facilitatorUser] = pokerFacilitator($game);
    [$memberUser] = pokerMember($game);

    $this->actingAs($facilitatorUser)
        ->getJson(route('poker.saved-decks.index', $game))
        ->assertOk()
        ->assertExactJson([['id' => $deck->id, 'name' => 'Team scale', 'cards' => ['1', '2', '4', '8', '?'], 'scope' => 'team']]);

    $this->actingAs($memberUser)
        ->getJson(route('poker.saved-decks.index', $game))
        ->assertForbidden();
});

it('re-decks a game from a saved deck until votes exist', function () {
    [$team, , $deck] = savedDeckTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitatorUser)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'custom', 'saved_deck_id' => $deck->id])
        ->assertNoContent();

    expect($game->fresh()->cards)->toBe(['1', '2', '4', '8', '?'])
        ->and($game->fresh()->deck_name)->toBe('Team scale')
        ->and($game->fresh()->deck)->toBe(PokerDeck::Custom);

    $this->actingAs($facilitatorUser)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'tshirt'])
        ->assertNoContent();

    expect($game->fresh()->deck_name)->toBeNull();

    pokerVote(openPokerRound($game->fresh()), $facilitator, 'M');

    $this->actingAs($facilitatorUser)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'custom', 'saved_deck_id' => $deck->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['deck' => "The deck can't change once votes exist."]);

    expect($game->fresh()->deck)->toBe(PokerDeck::Tshirt);
});

it('refuses a foreign or mixed saved deck in the settings', function () {
    [$team] = savedDeckTeam();
    [, , $foreign] = savedDeckTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    [$facilitatorUser] = pokerFacilitator($game);
    $deckBefore = $game->fresh()->only(['deck', 'cards', 'deck_name', 'saved_deck_id']);

    $this->actingAs($facilitatorUser)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'custom', 'saved_deck_id' => $foreign->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['saved_deck_id' => 'Choose a saved deck of this team.']);

    $this->actingAs($facilitatorUser)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'custom', 'saved_deck_id' => $foreign->id, 'custom_cards' => ['1', '2']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['saved_deck_id' => 'Choose either a saved deck or custom cards.']);

    expect($game->fresh()->only(['deck', 'cards', 'deck_name', 'saved_deck_id']))->toBe($deckBefore);
});
