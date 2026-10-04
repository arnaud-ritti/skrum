<?php

use App\Actions\Poker\SavedPokerDeckRules;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

function savedDecksPage(TestCase $test, User $user, Team $team): TestResponse
{
    return $test->actingAs($user)->get(route('teams.pokerDecks.index', [$team->workspace, $team]));
}

/**
 * @return array<string, mixed>
 */
function savedDecksProps(TestCase $test, User $user, Team $team): array
{
    return savedDecksPage($test, $user, $team)->assertOk()->viewData('page')['props'];
}

/**
 * @param  array<int, array<string, mixed>>  $decks
 * @return array<string, mixed>
 */
function deckNamed(array $decks, string $name): array
{
    return collect($decks)->firstWhere('name', $name);
}

it('shows a team member the built-in decks and the saved decks of the team and of the workspace', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $member = teamMember($team);
    SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Hours', 'cards' => ['1 h', '2 h', '?'], 'created_by_user_id' => $member->id]);
    SavedPokerDeck::factory()->forWorkspace($team->workspace)->create(['name' => 'House scale']);
    SavedPokerDeck::factory()->create(['name' => 'Elsewhere']);

    savedDecksPage($this, $member, $team)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('poker/decks')
            ->where('workspace.slug', $team->workspace->slug)
            ->where('team', ['id' => $team->id, 'name' => 'Atlas'])
            ->where('builtInDecks', fn ($decks) => collect($decks)->pluck('key')->all() === ['fibonacci', 'modified_fibonacci', 'tshirt', 'powers_of_two'])
            ->where('builtInDecks.0.name', 'Fibonacci')
            ->where('builtInDecks.2.cards', ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'])
            ->where('savedDecks', fn ($decks) => collect($decks)->pluck('name')->all() === ['Hours', 'House scale'])
            ->where('savedDecks.0.cards', ['1 h', '2 h', '?'])
            ->where('savedDecks.0.scope', 'team')
            ->where('savedDecks.0.createdBy', $member->name)
            ->where('savedDecks.1.scope', 'workspace')
            ->where('canCreate', true)
            ->where('deckLimit', SavedPokerDeckRules::MaxDecks)
        );
});

it('refuses a user who cannot view the team', function () {
    $team = Team::factory()->create();
    $outsider = workspaceManager($team->workspace, WorkspaceRole::Member);

    savedDecksPage($this, $outsider, $team)->assertForbidden();
});

it('marks the first built-in deck as the default when the team stored none', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    SavedPokerDeck::factory()->create(['team_id' => $team->id]);

    $props = savedDecksProps($this, $member, $team);

    expect(collect($props['builtInDecks'])->pluck('isDefault')->all())->toBe([true, false, false, false])
        ->and(collect($props['savedDecks'])->pluck('isDefault')->all())->toBe([false]);
});

it('marks the stored built-in deck as the default', function () {
    $team = Team::factory()->create(['default_poker_deck' => 'tshirt']);
    $member = teamMember($team);
    SavedPokerDeck::factory()->create(['team_id' => $team->id]);

    $props = savedDecksProps($this, $member, $team);

    expect(collect($props['builtInDecks'])->where('isDefault', true)->pluck('key')->all())->toBe(['tshirt'])
        ->and(collect($props['savedDecks'])->pluck('isDefault')->all())->toBe([false]);
});

it('marks the stored saved deck as the default and no built-in deck', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Hours']);
    SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Other']);
    $team->forceFill(['default_saved_poker_deck_id' => $deck->id])->save();

    $props = savedDecksProps($this, $member, $team);

    expect(collect($props['builtInDecks'])->where('isDefault', true)->all())->toBeEmpty()
        ->and(collect($props['savedDecks'])->where('isDefault', true)->pluck('name')->all())->toBe(['Hours']);
});

it('counts the games of this team only', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Hours']);
    $shared = SavedPokerDeck::factory()->forWorkspace($team->workspace)->create(['name' => 'House scale']);

    PokerGame::factory()->count(2)->create(['team_id' => $team->id, 'deck' => 'tshirt']);
    PokerGame::factory()->create(['team_id' => $otherTeam->id, 'deck' => 'tshirt']);
    PokerGame::factory()->customCards($deck->cards)->create(['team_id' => $team->id, 'saved_deck_id' => $deck->id]);
    PokerGame::factory()->customCards($deck->cards)->create(['team_id' => $team->id]);
    PokerGame::factory()->customCards($shared->cards)->create(['team_id' => $team->id, 'saved_deck_id' => $shared->id]);
    PokerGame::factory()->customCards($shared->cards)->count(3)->create(['team_id' => $otherTeam->id, 'saved_deck_id' => $shared->id]);

    $props = savedDecksProps($this, $member, $team);

    expect(collect($props['builtInDecks'])->pluck('usageCount', 'key')->all())
        ->toBe(['fibonacci' => 0, 'modified_fibonacci' => 0, 'tshirt' => 2, 'powers_of_two' => 0])
        ->and(deckNamed($props['savedDecks'], 'Hours')['usageCount'])->toBe(1)
        ->and(deckNamed($props['savedDecks'], 'House scale')['usageCount'])->toBe(1);
});

it('lets the creator and a workspace admin manage a team deck, and only the admin a workspace deck', function () {
    $team = Team::factory()->create();
    $creator = teamMember($team);
    $member = teamMember($team);
    $admin = workspaceManager($team->workspace);
    SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Hours', 'created_by_user_id' => $creator->id]);
    SavedPokerDeck::factory()->forWorkspace($team->workspace)->create(['name' => 'House scale', 'created_by_user_id' => $creator->id]);

    $manages = fn (User $user): array => collect(savedDecksProps($this, $user, $team)['savedDecks'])->pluck('canManage', 'name')->all();

    expect($manages($creator))->toBe(['Hours' => true, 'House scale' => false])
        ->and($manages($member))->toBe(['Hours' => false, 'House scale' => false])
        ->and($manages($admin))->toBe(['Hours' => true, 'House scale' => true]);
});

it('does not offer to manage a team deck to its creator once they only observe the team', function () {
    $team = Team::factory()->create();
    $creator = teamMember($team, TeamRole::Observer);
    SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Hours', 'created_by_user_id' => $creator->id]);

    expect(deckNamed(savedDecksProps($this, $creator, $team)['savedDecks'], 'Hours')['canManage'])->toBeFalse();
});

it('lets only a user who can update the team set the default deck', function () {
    $team = Team::factory()->create();

    expect(savedDecksProps($this, teamMember($team), $team)['canSetDefault'])->toBeFalse()
        ->and(savedDecksProps($this, workspaceManager($team->workspace), $team)['canSetDefault'])->toBeTrue();
});
