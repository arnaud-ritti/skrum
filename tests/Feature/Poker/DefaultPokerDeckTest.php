<?php

use App\Models\SavedPokerDeck;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

function defaultDeckUrl(Team $team): string
{
    return route('teams.defaultPokerDeck.update', [$team->workspace, $team]);
}

it('refuses a member who cannot update the team', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)
        ->put(defaultDeckUrl($team), ['deck' => 'fibonacci'])
        ->assertForbidden();

    expect($team->fresh()->default_poker_deck)->toBeNull();
});

it('stores a built-in deck and clears the saved deck', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $saved = SavedPokerDeck::factory()->create(['team_id' => $team->id]);
    $team->forceFill(['default_saved_poker_deck_id' => $saved->id])->save();

    $this->actingAs($admin)
        ->put(defaultDeckUrl($team), ['deck' => 'tshirt'])
        ->assertSessionHasNoErrors();

    $team->refresh();

    expect($team->default_poker_deck)->toBe('tshirt')
        ->and($team->default_saved_poker_deck_id)->toBeNull();
});

it('stores a saved deck of the team and clears the built-in deck', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $saved = SavedPokerDeck::factory()->create(['team_id' => $team->id]);
    $team->forceFill(['default_poker_deck' => 'tshirt'])->save();

    $this->actingAs($admin)
        ->put(defaultDeckUrl($team), ['saved_deck_id' => $saved->id])
        ->assertSessionHasNoErrors();

    $team->refresh();

    expect($team->default_saved_poker_deck_id)->toBe($saved->id)
        ->and($team->default_poker_deck)->toBeNull();
});

it('refuses custom, both fields, neither field and a deck of another team', function (array $payload) {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $other = SavedPokerDeck::factory()->create(['team_id' => Team::factory()->create(['workspace_id' => $team->workspace_id])->id]);
    $own = SavedPokerDeck::factory()->create(['team_id' => $team->id]);

    $payload = array_map(fn ($value) => match ($value) {
        '{own}' => $own->id,
        '{other}' => $other->id,
        default => $value,
    }, $payload);

    $this->actingAs($admin)
        ->put(defaultDeckUrl($team), $payload)
        ->assertSessionHasErrors();

    $team->refresh();

    expect($team->default_poker_deck)->toBeNull()
        ->and($team->default_saved_poker_deck_id)->toBeNull();
})->with([
    'custom' => [['deck' => 'custom']],
    'both' => [['deck' => 'fibonacci', 'saved_deck_id' => '{own}']],
    'neither' => [[]],
    'deck of another team' => [['saved_deck_id' => '{other}']],
]);

it('leaves both columns null when the default saved deck is deleted', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $saved = SavedPokerDeck::factory()->create(['team_id' => $team->id]);

    $this->actingAs($admin)->put(defaultDeckUrl($team), ['saved_deck_id' => $saved->id]);
    $saved->delete();

    $team->refresh();

    expect($team->default_saved_poker_deck_id)->toBeNull()
        ->and($team->default_poker_deck)->toBeNull();
});

it('shares the default deck on the team page', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $team->forceFill(['default_poker_deck' => 'powers_of_two'])->save();

    $this->actingAs($member)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('defaultPokerDeck', ['deck' => 'powers_of_two', 'savedDeckId' => null]));
});
