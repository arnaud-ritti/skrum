<?php

use App\Actions\Poker\SavedPokerDeckRules;
use App\Enums\WorkspaceRole;
use App\Models\SavedPokerDeck;
use App\Models\Team;

function duplicateUrl(Team $team, SavedPokerDeck $deck): string
{
    return route('teams.pokerDecks.duplicate.store', [$team->workspace, $team, $deck]);
}

it('copies the cards under the name Copy of the name', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Fibonacci+', 'cards' => ['1', '2', '3']]);

    $this->actingAs($member)->post(duplicateUrl($team, $deck))->assertSessionHasNoErrors();

    $copy = $team->pokerDecks()->where('name', 'Copy of Fibonacci+')->sole();

    expect($copy->cards)->toBe(['1', '2', '3'])
        ->and($copy->created_by_user_id)->toBe($member->id);
});

it('numbers a second copy', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Fibonacci+']);

    $this->actingAs($member)->post(duplicateUrl($team, $deck));
    $this->actingAs($member)->post(duplicateUrl($team, $deck));

    expect($team->pokerDecks()->pluck('name')->all())
        ->toContain('Copy of Fibonacci+', 'Copy of Fibonacci+ 2');
});

it('keeps a 40 character name valid and unique', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => str_repeat('a', 40)]);

    $this->actingAs($member)->post(duplicateUrl($team, $deck));
    $this->actingAs($member)->post(duplicateUrl($team, $deck));

    $names = $team->pokerDecks()->pluck('name');

    expect($names)->toHaveCount(3)
        ->and($names->unique(fn (string $name) => mb_strtolower($name)))->toHaveCount(3)
        ->and($names->every(fn (string $name) => mb_strlen($name) <= 40))->toBeTrue()
        ->and($names->contains(str_repeat('a', 40)))->toBeTrue();
});

it('refuses a copy beyond the deck limit', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $decks = SavedPokerDeck::factory()->count(SavedPokerDeckRules::MaxDecks)->create(['team_id' => $team->id]);

    $this->actingAs($member)
        ->post(duplicateUrl($team, $decks->first()))
        ->assertSessionHasErrors('name');

    expect($team->pokerDecks()->count())->toBe(SavedPokerDeckRules::MaxDecks);
});

it('refuses a user who cannot view the team', function () {
    $team = Team::factory()->create();
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id]);
    $outsider = workspaceManager($team->workspace, WorkspaceRole::Member);

    $this->actingAs($outsider)->post(duplicateUrl($team, $deck))->assertForbidden();

    expect($team->pokerDecks()->count())->toBe(1);
});

it('answers not found for a deck of another team', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $deck = SavedPokerDeck::factory()->create(['team_id' => Team::factory()->create(['workspace_id' => $team->workspace_id])->id]);

    $this->actingAs($member)->post(duplicateUrl($team, $deck))->assertNotFound();
});
