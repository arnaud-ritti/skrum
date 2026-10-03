<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * @return array{0: Team, 1: User}
 */
function deckTeam(): array
{
    $team = Team::factory()->create();

    return [$team, teamMember($team)];
}

function saveDeck(Team $team, User $creator, array $attributes = []): SavedPokerDeck
{
    return SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'created_by_user_id' => $creator->id,
        ...$attributes,
    ]);
}

it('lets a team member save a deck', function () {
    [$team, $user] = deckTeam();

    $this->actingAs($user)
        ->from(route('teams.show', [$team->workspace, $team]))
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), [
            'name' => 'Team scale',
            'cards' => ['1', '2', '4', '8'],
            'include_unknown' => true,
            'include_coffee' => false,
        ])
        ->assertRedirect(route('teams.show', [$team->workspace, $team]))
        ->assertSessionHasNoErrors();

    $deck = $team->pokerDecks()->sole();

    expect($deck->name)->toBe('Team scale')
        ->and($deck->cards)->toBe(['1', '2', '4', '8', '?'])
        ->and($deck->created_by_user_id)->toBe($user->id);
});

it('appends the special cards the checkboxes ask for', function (bool $unknown, bool $coffee, array $expected) {
    [$team, $user] = deckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), [
            'name' => 'Scale',
            'cards' => ['S', 'M', 'L'],
            'include_unknown' => $unknown,
            'include_coffee' => $coffee,
        ])
        ->assertSessionHasNoErrors();

    expect($team->pokerDecks()->sole()->cards)->toBe($expected);
})->with([
    'both' => [true, true, ['S', 'M', 'L', '?', '☕']],
    'none' => [false, false, ['S', 'M', 'L']],
    'coffee only' => [false, true, ['S', 'M', 'L', '☕']],
]);

it('validates the deck cards', function (array $cards) {
    [$team, $user] = deckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'Scale', 'cards' => $cards])
        ->assertSessionHasErrors();

    expect($team->pokerDecks()->count())->toBe(0);
})->with([
    'one card' => [['1']],
    'too long' => [['123456789', '2']],
    'duplicate after trim' => [[' 3', '3']],
    'only special cards' => [['?', '☕']],
    'twenty-one cards' => [array_map(strval(...), range(1, 21))],
]);

it('treats names case- and space-insensitively', function () {
    [$team, $user] = deckTeam();
    $deck = saveDeck($team, $user, ['name' => 'Team Scale']);

    $this->actingAs($user)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => ' team scale ', 'cards' => ['1', '2']])
        ->assertSessionHasErrors(['name' => 'A deck with this name already exists.']);

    $other = saveDeck($team, $user, ['name' => 'Other']);

    $this->actingAs($user)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $other]), ['name' => 'TEAM SCALE'])
        ->assertSessionHasErrors('name');

    $this->actingAs($user)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $deck]), ['name' => 'TEAM SCALE'])
        ->assertSessionHasNoErrors();

    expect($deck->fresh()->name)->toBe('TEAM SCALE')
        ->and($team->pokerDecks()->count())->toBe(2);
});

it('allows the same name in another team', function () {
    [$team, $user] = deckTeam();
    [$otherTeam, $otherUser] = deckTeam();
    saveDeck($otherTeam, $otherUser, ['name' => 'Scale']);

    $this->actingAs($user)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'Scale', 'cards' => ['1', '2']])
        ->assertSessionHasNoErrors();
});

it('limits a team to 30 saved decks', function () {
    [$team, $user] = deckTeam();
    SavedPokerDeck::factory()->count(30)->create(['team_id' => $team->id, 'created_by_user_id' => $user->id]);

    $this->actingAs($user)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'One more', 'cards' => ['1', '2']])
        ->assertSessionHasErrors(['name' => 'This team already has 30 saved decks.']);

    expect($team->pokerDecks()->count())->toBe(30);
});

it('lets the creator edit and delete their deck', function () {
    [$team, $user] = deckTeam();
    $deck = saveDeck($team, $user);

    $this->actingAs($user)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $deck]), [
            'cards' => ['XS', 'S', 'M'],
            'include_unknown' => false,
            'include_coffee' => false,
        ])
        ->assertSessionHasNoErrors();

    expect($deck->fresh()->cards)->toBe(['XS', 'S', 'M']);

    $this->actingAs($user)
        ->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))
        ->assertRedirect();

    expect(SavedPokerDeck::query()->find($deck->id))->toBeNull();
});

it('lets workspace owners and admins manage any deck', function (WorkspaceRole $role) {
    [$team, $user] = deckTeam();
    $deck = saveDeck($team, $user);
    $manager = workspaceManager($team->workspace, $role);

    $this->actingAs($manager)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $deck]), ['name' => 'Renamed'])
        ->assertSessionHasNoErrors();

    $this->actingAs($manager)
        ->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))
        ->assertRedirect();

    expect(SavedPokerDeck::query()->find($deck->id))->toBeNull();
})->with([WorkspaceRole::Owner, WorkspaceRole::Admin]);

it('refuses other members editing or deleting a deck', function () {
    [$team, $user] = deckTeam();
    $deck = saveDeck($team, $user);
    $other = teamMember($team);

    $this->actingAs($other)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $deck]), ['name' => 'Mine now'])
        ->assertForbidden();

    $this->actingAs($other)
        ->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))
        ->assertForbidden();

    expect($deck->fresh()->name)->not->toBe('Mine now');
});

it('refuses people outside the team', function () {
    [$team] = deckTeam();
    $outsider = User::factory()->create();
    $team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'Scale', 'cards' => ['1', '2']])
        ->assertForbidden();
});

it('never lets guests reach saved decks', function () {
    [$team, $user] = deckTeam();
    saveDeck($team, $user);
    $game = PokerGame::factory()->withGuestAccess()->create(['team_id' => $team->id]);
    $guest = pokerGuest($game);

    $this->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'Scale', 'cards' => ['1', '2']])
        ->assertRedirect(route('login'));

    $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('poker.saved-decks.index', $game))
        ->assertForbidden();

    $snapshot = $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertOk()
        ->json();

    expect(json_encode($snapshot))->not->toContain('savedDeck');
});

it('answers 404 for a deck deleted meanwhile', function () {
    [$team, $user] = deckTeam();
    $deck = saveDeck($team, $user);
    $deck->delete();

    $this->actingAs($user)
        ->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))
        ->assertNotFound();
});

it('answers 404 for a deck of another team', function () {
    [$team, $user] = deckTeam();
    [$otherTeam, $otherUser] = deckTeam();
    $foreign = saveDeck($otherTeam, $otherUser);

    $this->actingAs($user)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $foreign]), ['name' => 'X'])
        ->assertNotFound();
});

it('lists the team decks on the team page', function () {
    [$team, $user] = deckTeam();
    $own = saveDeck($team, $user, ['name' => 'B mine', 'cards' => ['1', '2']]);
    $others = saveDeck($team, teamMember($team), ['name' => 'A theirs']);

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('pokerDecks', 2)
            ->where('pokerDecks.0', ['id' => $others->id, 'name' => 'A theirs', 'cards' => $others->cards, 'scope' => 'team', 'canManage' => false])
            ->where('pokerDecks.1', ['id' => $own->id, 'name' => 'B mine', 'cards' => ['1', '2'], 'scope' => 'team', 'canManage' => true]));

    $this->actingAs(workspaceManager($team->workspace))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('pokerDecks.0.canManage', true)
            ->where('pokerDecks.1.canManage', true));
});

it('keeps team decks read-only to observers, including a deck they created before', function () {
    $team = Team::factory()->create();
    $observer = teamMember($team, TeamRole::Observer);
    $deck = saveDeck($team, $observer);

    $this->actingAs($observer)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'Scale', 'cards' => ['1', '2']])
        ->assertForbidden();

    $this->actingAs($observer)
        ->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))
        ->assertForbidden();

    expect($team->pokerDecks()->count())->toBe(1);
});
