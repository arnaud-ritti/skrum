<?php

use App\Enums\PokerDeck;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\Team;
use App\Models\User;

function createPokerGameRequest(array $overrides = []): array
{
    return [
        'title' => 'Sprint 12 sizing',
        'deck' => PokerDeck::Fibonacci->value,
        ...$overrides,
    ];
}

function postPokerGame(mixed $test, User $user, Team $team, array $payload): mixed
{
    return $test->actingAs($user)->post(route('teams.pokerGames.store', [$team->workspace, $team]), $payload);
}

it('creates a game with each deck', function (PokerDeck $deck, array $extra, array $expectedCards) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $response = postPokerGame($this, $user, $team, createPokerGameRequest(['deck' => $deck->value, ...$extra]));

    $game = PokerGame::query()->sole();

    $response->assertRedirect(route('poker.show', $game));

    $player = $game->players()->sole();

    expect($game->team_id)->toBe($team->id)
        ->and($game->title)->toBe('Sprint 12 sizing')
        ->and($game->deck)->toBe($deck)
        ->and($game->cards)->toBe($expectedCards)
        ->and($game->deck_name)->toBeNull()
        ->and($game->guest_access_enabled)->toBeFalse()
        ->and(strlen($game->guest_token))->toBe(40)
        ->and($player->user_id)->toBe($user->id)
        ->and($game->facilitator_player_id)->toBe($player->id);
})->with([
    'fibonacci' => [PokerDeck::Fibonacci, [], PokerDeck::Fibonacci->cards()],
    'modified fibonacci' => [PokerDeck::ModifiedFibonacci, [], PokerDeck::ModifiedFibonacci->cards()],
    't-shirt' => [PokerDeck::Tshirt, [], PokerDeck::Tshirt->cards()],
    'powers of two' => [PokerDeck::PowersOfTwo, [], PokerDeck::PowersOfTwo->cards()],
    'custom' => [PokerDeck::Custom, ['custom_cards' => ['1', '2', '3']], ['1', '2', '3', '?', '☕']],
]);

it('validates custom decks', function (array $customCards, array $flags, ?array $expectedCards) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $response = postPokerGame($this, $user, $team, createPokerGameRequest([
        'deck' => PokerDeck::Custom->value,
        'custom_cards' => $customCards,
        ...$flags,
    ]));

    if ($expectedCards === null) {
        $response->assertSessionHasErrors();
        expect(PokerGame::query()->count())->toBe(0);

        return;
    }

    $response->assertSessionHasNoErrors();
    expect(PokerGame::query()->sole()->cards)->toBe($expectedCards);
})->with([
    'collide after trimming' => [[' 3', '3', '5'], [], null],
    'nine multibyte characters' => [['ＡＢＣＤＥＦＧＨＩ', '1'], [], null],
    'only special cards' => [['?', '☕'], [], null],
    'twenty-one cards' => [array_map(strval(...), range(1, 21)), [], null],
    'a single card' => [['1'], [], null],
    'blank card' => [['1', '   '], [], null],
    '? typed and requested' => [['1', '2', '?'], ['include_unknown' => true, 'include_coffee' => true], ['1', '2', '?', '☕']],
    'no special cards asked' => [['S', 'M', 'L'], ['include_unknown' => false, 'include_coffee' => false], ['S', 'M', 'L']],
    'eight multibyte characters' => [['ＡＢＣＤＥＦＧＨ', '1'], ['include_unknown' => false, 'include_coffee' => false], ['ＡＢＣＤＥＦＧＨ', '1']],
    'twenty cards' => [array_map(strval(...), range(1, 20)), ['include_unknown' => false, 'include_coffee' => false], array_map(strval(...), range(1, 20))],
]);

it('ignores custom cards for built-in decks', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    postPokerGame($this, $user, $team, createPokerGameRequest(['custom_cards' => ['x']]))->assertSessionHasNoErrors();

    expect(PokerGame::query()->sole()->cards)->toBe(PokerDeck::Fibonacci->cards());
});

it('requires a title and a known deck', function (array $payload, string $field) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    postPokerGame($this, $user, $team, createPokerGameRequest($payload))->assertSessionHasErrors($field);
})->with([
    'no title' => [['title' => ''], 'title'],
    'long title' => [['title' => str_repeat('a', 121)], 'title'],
    'unknown deck' => [['deck' => 'bananas'], 'deck'],
]);

it('stores anonymous votes and auto-reveal from the form', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    postPokerGame($this, $user, $team, createPokerGameRequest(['anonymous_votes' => true, 'auto_reveal' => true]))
        ->assertSessionHasNoErrors();

    $game = PokerGame::query()->sole();

    expect($game->anonymous_votes)->toBeTrue()
        ->and($game->auto_reveal)->toBeTrue();
});

it('refuses non-members', function () {
    $team = Team::factory()->create();
    $outsider = User::factory()->create();
    $team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    postPokerGame($this, $outsider, $team, createPokerGameRequest())->assertForbidden();

    expect(PokerGame::query()->count())->toBe(0);
});

it('lets workspace managers create games for any team', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);

    postPokerGame($this, $admin, $team, createPokerGameRequest())->assertRedirect();

    expect(PokerGame::query()->sole()->facilitator->user_id)->toBe($admin->id);
});

it('stores the guest access flag of a game, false by default', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    postPokerGame($this, $user, $team, createPokerGameRequest(['title' => 'Open', 'guest_access_enabled' => true]));
    postPokerGame($this, $user, $team, createPokerGameRequest(['title' => 'Closed']));

    expect(PokerGame::query()->where('title', 'Open')->sole()->guest_access_enabled)->toBeTrue()
        ->and(PokerGame::query()->where('title', 'Closed')->sole()->guest_access_enabled)->toBeFalse();
});

it('creates a game whose creator is watching', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    postPokerGame($this, $user, $team, createPokerGameRequest(['spectator' => true]));

    expect(PokerGame::query()->sole()->players()->sole()->is_spectator)->toBeTrue();
});

it('creates the typed tasks in order', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    postPokerGame($this, $user, $team, createPokerGameRequest(['tasks' => ['Login page', 'Billing', 'Export']]))->assertRedirect();

    $tasks = PokerGame::query()->sole()->tasks()->orderBy('position')->get();

    expect($tasks->pluck('title')->all())->toBe(['Login page', 'Billing', 'Export'])
        ->and($tasks->pluck('position')->all())->toBe([1, 2, 3]);
});

it('refuses too many or too long task titles', function (array $tasks, string $field) {
    $team = Team::factory()->create();

    postPokerGame($this, teamMember($team), $team, createPokerGameRequest(['tasks' => $tasks]))->assertSessionHasErrors($field);

    expect(PokerGame::query()->count())->toBe(0);
})->with([
    '51 titles' => [fn () => array_fill(0, 51, 'Task'), 'tasks'],
    'a 201-character title' => [[str_repeat('a', 201)], 'tasks.0'],
]);
