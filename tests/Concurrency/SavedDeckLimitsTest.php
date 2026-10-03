<?php

use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\Workspace;
use Tests\Concurrency\Support\Race;

/**
 * @param  array<int, string>  $names
 */
function deckRace(string $userId, string $uri, array $names): array
{
    $contenders = [];

    foreach ($names as $name) {
        $contenders[] = static fn (): int => Race::request($userId, 'POST', $uri, ['name' => $name, 'cards' => ['1', '2', '3']]);
    }

    return array_column(Race::run($contenders), 'value');
}

function teamDeckRace(Team $team, array $names): array
{
    return deckRace(integrationAdmin($team)->id, route('teams.pokerDecks.store', [$team->workspace, $team], false), $names);
}

it('stops at thirty saved decks per team', function () {
    $team = Team::factory()->create();
    SavedPokerDeck::factory()->count(29)->create(['team_id' => $team->id]);

    $statuses = teamDeckRace($team, ['Race 1', 'Race 2', 'Race 3', 'Race 4', 'Race 5', 'Race 6']);

    expect(SavedPokerDeck::query()->where('team_id', $team->id)->count())->toBe(30)
        ->and(array_count_values($statuses))->toEqual([302 => 1, 422 => 5]);
});

it('keeps one team deck when the same name is saved six times at once, and answers the others 422', function () {
    $team = Team::factory()->create();

    $statuses = teamDeckRace($team, array_fill(0, 6, 'Fibonacci plus'));

    expect(SavedPokerDeck::query()->where('team_id', $team->id)->count())->toBe(1)
        ->and(array_count_values($statuses))->toEqual([302 => 1, 422 => 5]);
});

it('keeps one workspace deck when the same name is saved six times at once, and answers the others 422', function () {
    $workspace = Workspace::factory()->create();
    $uri = route('workspaces.pokerDecks.store', $workspace, false);

    $statuses = deckRace(workspaceManager($workspace)->id, $uri, ['House scale', 'house scale', ' House scale', 'House scale ', 'HOUSE SCALE', 'House scale']);

    expect(SavedPokerDeck::query()->where('workspace_id', $workspace->id)->count())->toBe(1)
        ->and(array_count_values($statuses))->toEqual([302 => 1, 422 => 5]);
});

it('keeps names unique when two team decks are renamed to the same name at once, and answers the second 422', function () {
    $team = Team::factory()->create();
    $userId = integrationAdmin($team)->id;
    $contenders = [];

    foreach (SavedPokerDeck::factory()->count(2)->create(['team_id' => $team->id]) as $deck) {
        $uri = route('teams.pokerDecks.update', [$team->workspace, $team, $deck], false);
        $contenders[] = static fn (): int => Race::request($userId, 'PATCH', $uri, ['name' => 'Same name']);
    }

    $statuses = array_column(Race::run($contenders, Race::firstQueryMentioning('name_key')), 'value');

    expect(SavedPokerDeck::query()->where('team_id', $team->id)->where('name', 'Same name')->count())->toBe(1)
        ->and(array_count_values($statuses))->toEqual([302 => 1, 422 => 1]);
});

it('keeps names unique when two workspace decks are renamed to the same name at once, and answers the second 422', function () {
    $workspace = Workspace::factory()->create();
    $userId = workspaceManager($workspace)->id;
    $contenders = [];

    foreach (SavedPokerDeck::factory()->forWorkspace($workspace)->count(2)->create() as $deck) {
        $uri = route('workspaces.pokerDecks.update', [$workspace, $deck], false);
        $contenders[] = static fn (): int => Race::request($userId, 'PATCH', $uri, ['name' => 'Same name']);
    }

    $statuses = array_column(Race::run($contenders, Race::firstQueryMentioning('name_key')), 'value');

    expect(SavedPokerDeck::query()->where('workspace_id', $workspace->id)->where('name', 'Same name')->count())->toBe(1)
        ->and(array_count_values($statuses))->toEqual([302 => 1, 422 => 1]);
});
