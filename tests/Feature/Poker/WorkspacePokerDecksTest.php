<?php

use App\Actions\Poker\SavedPokerDeckRules;
use App\Enums\WorkspaceRole;
use App\Exceptions\ModelInvariantViolation;
use App\Models\PokerGame;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

function workspaceDeck(Workspace $workspace, array $attributes = []): SavedPokerDeck
{
    return SavedPokerDeck::factory()->forWorkspace($workspace)->create($attributes);
}

it('lets a workspace manager create, rename and delete a workspace deck', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace);

    $this->actingAs($admin)
        ->post(route('workspaces.pokerDecks.store', $workspace), [
            'name' => 'House scale',
            'cards' => ['1', '2', '4'],
            'include_unknown' => true,
            'include_coffee' => false,
        ])
        ->assertSessionHasNoErrors();

    $deck = $workspace->pokerDecks()->sole();

    expect($deck->cards)->toBe(['1', '2', '4', '?'])
        ->and($deck->team_id)->toBeNull()
        ->and($deck->isWorkspaceDeck())->toBeTrue()
        ->and($deck->created_by_user_id)->toBe($admin->id);

    $this->actingAs($admin)
        ->patch(route('workspaces.pokerDecks.update', [$workspace, $deck]), ['name' => 'Renamed', 'cards' => ['S', 'M']])
        ->assertSessionHasNoErrors();

    expect($deck->fresh()->name)->toBe('Renamed')
        ->and($deck->fresh()->cards)->toBe(['S', 'M', '?', '☕']);

    $this->actingAs($admin)
        ->delete(route('workspaces.pokerDecks.destroy', [$workspace, $deck]))
        ->assertRedirect();

    expect($workspace->pokerDecks()->count())->toBe(0);
});

it('refuses a plain member on the three write routes', function () {
    $workspace = Workspace::factory()->create();
    $member = workspaceManager($workspace, WorkspaceRole::Member);
    $deck = workspaceDeck($workspace, ['created_by_user_id' => $member->id]);

    $this->actingAs($member)
        ->post(route('workspaces.pokerDecks.store', $workspace), ['name' => 'Scale', 'cards' => ['1', '2']])
        ->assertForbidden();

    $this->actingAs($member)
        ->patch(route('workspaces.pokerDecks.update', [$workspace, $deck]), ['name' => 'Renamed'])
        ->assertForbidden();

    $this->actingAs($member)
        ->delete(route('workspaces.pokerDecks.destroy', [$workspace, $deck]))
        ->assertForbidden();

    expect($workspace->pokerDecks()->count())->toBe(1)
        ->and($deck->fresh()->name)->not->toBe('Renamed');
});

it('answers 404 for a deck of another workspace', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace);
    $otherWorkspace = Workspace::factory()->create();
    $otherAdmin = workspaceManager($otherWorkspace);
    $deck = workspaceDeck($workspace);

    $this->actingAs($otherAdmin)
        ->patch(route('workspaces.pokerDecks.update', [$otherWorkspace, $deck]), ['name' => 'Renamed'])
        ->assertNotFound();

    $this->actingAs($otherAdmin)
        ->delete(route('workspaces.pokerDecks.destroy', [$otherWorkspace, $deck]))
        ->assertNotFound();

    $team = Team::factory()->create(['workspace_id' => $otherWorkspace->id]);

    $this->actingAs($otherAdmin)
        ->patch(route('teams.pokerDecks.update', [$otherWorkspace, $team, $deck]), ['name' => 'Renamed'])
        ->assertNotFound();

    expect($deck->fresh()->name)->not->toBe('Renamed');
});

it('keeps names unique per workspace, case-insensitively, and free against team decks', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace);
    $team = Team::factory()->create(['workspace_id' => $workspace->id]);
    SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Shared name']);
    workspaceDeck($workspace, ['name' => 'House scale']);
    workspaceDeck(Workspace::factory()->create(), ['name' => 'Elsewhere']);

    $this->actingAs($admin)
        ->post(route('workspaces.pokerDecks.store', $workspace), ['name' => ' house SCALE ', 'cards' => ['1', '2']])
        ->assertSessionHasErrors(['name' => 'A deck with this name already exists.']);

    $this->actingAs($admin)
        ->post(route('workspaces.pokerDecks.store', $workspace), ['name' => 'Shared name', 'cards' => ['1', '2']])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('workspaces.pokerDecks.store', $workspace), ['name' => 'Elsewhere', 'cards' => ['1', '2']])
        ->assertSessionHasNoErrors();

    expect($workspace->pokerDecks()->count())->toBe(3);
});

it('refuses a deck beyond the limit of the workspace', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace);
    SavedPokerDeck::factory()->forWorkspace($workspace)->count(SavedPokerDeckRules::MaxDecks)->create();

    $this->actingAs($admin)
        ->post(route('workspaces.pokerDecks.store', $workspace), ['name' => 'One too many', 'cards' => ['1', '2']])
        ->assertSessionHasErrors('name');

    expect($workspace->pokerDecks()->count())->toBe(SavedPokerDeckRules::MaxDecks);
});

it('lists a workspace deck on the team page of every team of the workspace and of no other', function () {
    $workspace = Workspace::factory()->create();
    $deck = workspaceDeck($workspace, ['name' => 'House scale']);
    $teamA = Team::factory()->create(['workspace_id' => $workspace->id]);
    $teamB = Team::factory()->create(['workspace_id' => $workspace->id]);
    $otherTeam = Team::factory()->create();
    SavedPokerDeck::factory()->create(['team_id' => $teamA->id, 'name' => 'Team scale']);

    $member = teamMember($teamA);
    $teamB->members()->attach($member);

    foreach ([$teamA, $teamB] as $team) {
        $this->actingAs($member)
            ->get(route('teams.show', [$workspace, $team]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('pokerDecks', fn ($decks) => collect($decks)->contains(
                    fn ($listed) => $listed['id'] === $deck->id
                        && $listed['scope'] === 'workspace'
                        && $listed['canManage'] === false,
                )));
    }

    $this->actingAs($member)
        ->get(route('teams.show', [$workspace, $teamA]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('pokerDecks', fn ($decks) => collect($decks)->firstWhere('name', 'Team scale')['scope'] === 'team'));

    $outsider = teamMember($otherTeam);

    $this->actingAs($outsider)
        ->get(route('teams.show', [$otherTeam->workspace, $otherTeam]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('pokerDecks', fn ($decks) => collect($decks)->doesntContain(fn ($listed) => $listed['id'] === $deck->id)));
});

it('marks a workspace deck as manageable for a workspace manager only', function () {
    $team = Team::factory()->create();
    $deck = workspaceDeck($team->workspace);
    $admin = workspaceManager($team->workspace);

    $this->actingAs($admin)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('pokerDecks', fn ($decks) => collect($decks)->firstWhere('id', $deck->id)['canManage'] === true));
});

it('lists a workspace deck in the game settings list', function () {
    Event::fake();

    $team = Team::factory()->create();
    $member = teamMember($team);
    $deck = workspaceDeck($team->workspace, ['name' => 'House scale']);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $facilitator = $game->players()->create(['user_id' => $member->id]);
    $game->update(['facilitator_player_id' => $facilitator->id]);

    $this->actingAs($member)
        ->getJson(route('poker.saved-decks.index', $game))
        ->assertOk()
        ->assertJsonFragment(['id' => $deck->id, 'name' => 'House scale', 'scope' => 'workspace']);
});

it('creates a game from a workspace deck', function () {
    Event::fake();

    $team = Team::factory()->create();
    $member = teamMember($team);
    $deck = workspaceDeck($team->workspace, ['name' => 'House scale', 'cards' => ['1', '2', '?']]);

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $deck->id,
        ])
        ->assertSessionHasNoErrors();

    $game = $team->pokerGames()->sole();

    expect($game->saved_deck_id)->toBe($deck->id)
        ->and($game->cards)->toBe(['1', '2', '?'])
        ->and($game->deck_name)->toBe('House scale');
});

it('refuses a workspace deck of another workspace when creating a game', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $foreign = workspaceDeck(Workspace::factory()->create());

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $foreign->id,
        ])
        ->assertSessionHasErrors('saved_deck_id');
});

it('lets a team take a workspace deck as its default and clears it on deletion', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $deck = workspaceDeck($team->workspace);

    $this->actingAs($admin)
        ->put(route('teams.defaultPokerDeck.update', [$team->workspace, $team]), ['saved_deck_id' => $deck->id])
        ->assertSessionHasNoErrors();

    expect($team->fresh()->default_saved_poker_deck_id)->toBe($deck->id);

    $this->actingAs($admin)
        ->delete(route('workspaces.pokerDecks.destroy', [$team->workspace, $deck]))
        ->assertRedirect();

    expect($team->fresh()->default_saved_poker_deck_id)->toBeNull()
        ->and($team->fresh()->default_poker_deck)->toBeNull();
});

it('refuses a workspace deck of another workspace as default', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $foreign = workspaceDeck(Workspace::factory()->create());

    $this->actingAs($admin)
        ->put(route('teams.defaultPokerDeck.update', [$team->workspace, $team]), ['saved_deck_id' => $foreign->id])
        ->assertSessionHasErrors('saved_deck_id');
});

it('refuses a deck with both owners or none', function (bool $withTeam, bool $withWorkspace) {
    $team = Team::factory()->create();
    $attributes = [
        'team_id' => $withTeam ? $team->id : null,
        'workspace_id' => $withWorkspace ? $team->workspace_id : null,
    ];

    expect(fn () => SavedPokerDeck::factory()->create($attributes))->toThrow(ModelInvariantViolation::class);
})->with([
    'both owners' => [true, true],
    'no owner' => [false, false],
]);
