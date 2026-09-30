<?php

use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Mcp\Tools\Poker\GetGame;
use App\Mcp\Tools\Poker\ListGames;
use App\Mcp\Tools\Poker\ListTasks;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Team;

it('lists the team\'s games newest first with counts and links', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $older = PokerGame::factory()->create(['team_id' => $team->id, 'title' => 'Older', 'created_at' => now()->subDay()]);
    $newer = PokerGame::factory()->create(['team_id' => $team->id, 'title' => 'Newer']);
    PokerTask::factory()->estimated('5')->create(['poker_game_id' => $newer->id]);
    PokerTask::factory()->create(['poker_game_id' => $newer->id]);
    PokerGame::factory()->ended()->create(['team_id' => $team->id, 'title' => 'Done']);

    $result = mcpStructured(actingAsMcp($user)->tool(ListGames::class, ['team_id' => $team->id])->assertOk());

    expect(collect($result['items'])->pluck('title')->all())->toBe(['Newer', 'Older'])
        ->and($result['items'][0])->toMatchArray([
            'id' => $newer->id,
            'deck' => 'fibonacci',
            'tasksCount' => 2,
            'estimatedCount' => 1,
            'totalPoints' => 5,
            'endedAt' => null,
            'url' => route('poker.show', $newer),
        ])
        ->and($result['page'])->toBe(1)
        ->and($result['hasMore'])->toBeFalse();

    $ended = mcpStructured(actingAsMcp($user)->tool(ListGames::class, ['team_id' => $team->id, 'status' => 'ended'])->assertOk());
    $all = mcpStructured(actingAsMcp($user)->tool(ListGames::class, ['team_id' => $team->id, 'status' => 'all'])->assertOk());

    expect(collect($ended['items'])->pluck('title')->all())->toBe(['Done'])
        ->and($all['items'])->toHaveCount(3);
});

it('paginates games', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    PokerGame::factory()->count(3)->create(['team_id' => $team->id]);

    $first = mcpStructured(actingAsMcp($user)->tool(ListGames::class, ['team_id' => $team->id, 'limit' => 2])->assertOk());
    $second = mcpStructured(actingAsMcp($user)->tool(ListGames::class, ['team_id' => $team->id, 'limit' => 2, 'page' => 2])->assertOk());

    expect($first['items'])->toHaveCount(2)
        ->and($first['hasMore'])->toBeTrue()
        ->and($second['items'])->toHaveCount(1)
        ->and($second['hasMore'])->toBeFalse();
});

it('reports games and teams of other teams as not found', function () {
    $game = PokerGame::factory()->create();
    $outsider = teamMember(Team::factory()->create());

    actingAsMcp($outsider)->tool(ListGames::class, ['team_id' => $game->team_id])->assertHasErrors(['Not found.']);
    actingAsMcp($outsider)->tool(GetGame::class, ['game_id' => $game->id])->assertHasErrors(['Not found.']);
    actingAsMcp($outsider)->tool(ListTasks::class, ['game_id' => $game->id])->assertHasErrors(['Not found.']);
});

it('describes a game with the spec 4 fields', function () {
    $game = PokerGame::factory()->create(['deck_name' => 'Team scale', 'deck' => PokerDeck::Custom, 'cards' => ['1', '2', '3', '?'], 'auto_reveal' => true, 'anonymous_votes' => true]);
    [$user, $facilitator] = pokerFacilitator($game);
    $spectator = PokerPlayer::factory()->spectator()->create(['poker_game_id' => $game->id]);
    $round = openPokerRound($game);
    $round->update(['timer_ends_at' => now()->addMinute()]);

    $result = mcpStructured(actingAsMcp($user)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());

    expect($result['game'])->toMatchArray([
        'id' => $game->id,
        'deck' => 'custom',
        'deckLabel' => 'Team scale',
        'cards' => ['1', '2', '3', '?'],
        'autoReveal' => true,
        'anonymousVotes' => true,
        'url' => route('poker.show', $game),
        'guestJoinUrl' => null,
    ])
        ->and($result['facilitator'])->toBe(['name' => $user->name])
        ->and(collect($result['players'])->firstWhere('name', $spectator->displayName())['isSpectator'])->toBeTrue()
        ->and($result['me'])->toBe(['isPlayer' => true, 'isFacilitator' => true, 'isSpectator' => false, 'canEditTasks' => true])
        ->and($result['currentTask']['round'])->toMatchArray([
            'number' => 1,
            'anonymous' => true,
            'revealed' => false,
            'revealReason' => null,
            'votesCount' => 0,
        ])
        ->and($result['currentTask']['round']['timerEndsAt'])->not->toBeNull()
        ->and(collect($result['currentTask']['round']['voters'])->pluck('name')->all())->not->toContain($spectator->displayName());
});

it('hides other players\' values before reveal, for the facilitator too', function () {
    $game = PokerGame::factory()->create();
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '5');
    pokerVote($round, $member, '13');

    $game = mcpStructured(actingAsMcp($facilitatorUser)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());
    $tasks = mcpStructured(actingAsMcp($facilitatorUser)->tool(ListTasks::class, ['game_id' => $round->task->poker_game_id])->assertOk());

    expect($game['currentTask']['round']['myVote'])->toBe('5')
        ->and($game['currentTask']['round']['result'])->toBeNull()
        ->and(collect($game['currentTask']['round']['voters'])->every(fn (array $voter): bool => $voter['hasVoted']))->toBeTrue()
        ->and(json_encode([$game['currentTask'], $game['players']]))->not->toContain('"13"')
        ->and(collect($tasks['items'][0]['latestRound']['votes'])->pluck('value')->filter()->values()->all())->toBe(['5'])
        ->and(json_encode($tasks))->not->toContain('"13"');
});

it('shows named values after reveal and keeps anonymous rounds unnamed', function (bool $anonymous) {
    $game = PokerGame::factory()->create(['anonymous_votes' => $anonymous]);
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '5');
    pokerVote($round, $member, '13');
    $round->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);

    $tasks = mcpStructured(actingAsMcp($facilitatorUser)->tool(ListTasks::class, ['game_id' => $game->id])->assertOk());
    $latest = $tasks['items'][0]['latestRound'];
    $memberValue = collect($latest['votes'])->firstWhere('player', $memberUser->name)['value'];

    expect($latest['revealed'])->toBeTrue()
        ->and($latest['revealReason'])->toBe('manual')
        ->and(collect($latest['result']['distribution'])->pluck('value')->all())->toBe(['5', '13'])
        ->and($memberValue)->toBe($anonymous ? null : '13');
})->with(['named' => false, 'anonymous' => true]);

it('returns the guest link only while guest access is on', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    [$user] = pokerMember($game);

    $withGuests = mcpStructured(actingAsMcp($user)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());

    $game->update(['guest_access_enabled' => false]);

    $withoutGuests = mcpStructured(actingAsMcp($user)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());

    expect($withGuests['game']['guestJoinUrl'])->toBe(route('poker.join.show', $game->guest_token))
        ->and($withoutGuests['game']['guestJoinUrl'])->toBeNull();
});

it('never creates a player when reading', function () {
    $game = PokerGame::factory()->create();
    pokerFacilitator($game);
    $round = openPokerRound($game);
    $reader = teamMember($game->team);

    $result = mcpStructured(actingAsMcp($reader)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());
    actingAsMcp($reader)->tool(ListTasks::class, ['game_id' => $game->id])->assertOk();

    expect(PokerPlayer::query()->where('user_id', $reader->id)->exists())->toBeFalse()
        ->and($result['me'])->toBe(['isPlayer' => false, 'isFacilitator' => false, 'isSpectator' => false, 'canEditTasks' => true])
        ->and($result['currentTask']['round']['myVote'])->toBeNull();
});

it('lists tasks in order with the current task and Markdown source', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerMember($game);
    $first = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'First', 'description' => '**Bold**']);
    $second = PokerTask::factory()->estimated('8')->create(['poker_game_id' => $game->id, 'title' => 'Second']);
    openPokerRound($game, $second);

    $result = mcpStructured(actingAsMcp($user)->tool(ListTasks::class, ['game_id' => $game->id])->assertOk());

    expect(collect($result['items'])->pluck('title')->all())->toBe(['First', 'Second'])
        ->and($result['items'][0])->toMatchArray(['id' => $first->id, 'description' => '**Bold**', 'isCurrent' => false, 'latestRound' => null, 'roundsCount' => 0, 'external' => null])
        ->and($result['items'][1])->toMatchArray(['isCurrent' => true, 'estimate' => '8', 'roundsCount' => 1]);
});

it('returns absolute avatar urls for players', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);

    $result = mcpStructured(actingAsMcp($user)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());

    expect($result['players'])->not->toBeEmpty()
        ->and(collect($result['players'])->every(fn (array $player): bool => str_starts_with($player['avatarUrl'], config('app.url'))))->toBeTrue();
});
