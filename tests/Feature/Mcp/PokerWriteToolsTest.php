<?php

use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\Poker\PokerTaskSaved;
use App\Mcp\Tools\Poker\AddTasks;
use App\Mcp\Tools\Poker\CreateGame;
use App\Mcp\Tools\Poker\RevealTask;
use App\Mcp\Tools\Poker\SelectTask;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;

beforeEach(function () {
    Event::fake([PokerTaskSaved::class, PokerRoundChanged::class, PokerTaskEstimated::class]);
});

it('creates a game with the creator as player and facilitator', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $result = mcpStructured(mcpWriter($user)->tool(CreateGame::class, [
        'team_id' => $team->id,
        'title' => 'Sprint 12',
        'deck' => 'custom',
        'custom_cards' => ['1', '2', '3'],
        'include_coffee' => false,
    ])->assertOk());

    $game = PokerGame::query()->sole();
    $player = PokerPlayer::query()->where('poker_game_id', $game->id)->where('user_id', $user->id)->sole();

    expect($game->cards)->toBe(['1', '2', '3', '?'])
        ->and($game->facilitator_player_id)->toBe($player->id)
        ->and($player->is_spectator)->toBeFalse()
        ->and($game->guest_access_enabled)->toBeFalse()
        ->and($game->auto_reveal)->toBeFalse()
        ->and($game->anonymous_votes)->toBeFalse()
        ->and($result['game']['title'])->toBe('Sprint 12')
        ->and($result['me']['isFacilitator'])->toBeTrue();
});

it('ignores game options the tool does not offer', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    mcpWriter($user)->tool(CreateGame::class, [
        'team_id' => $team->id,
        'title' => 'Defaults',
        'deck' => 'fibonacci',
        'anonymous_votes' => true,
        'auto_reveal' => true,
    ])->assertOk();

    $game = PokerGame::query()->sole();

    expect($game->anonymous_votes)->toBeFalse()
        ->and($game->auto_reveal)->toBeFalse();
});

it('creates a game from a saved deck of the same team only', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Team scale', 'cards' => ['1', '2', '5']]);
    $foreignDeck = SavedPokerDeck::factory()->create();

    mcpWriter($user)->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Saved', 'deck' => 'custom', 'saved_deck_id' => $deck->id])->assertOk();

    $game = PokerGame::query()->sole();

    expect($game->cards)->toBe(['1', '2', '5'])
        ->and($game->deck_name)->toBe('Team scale');

    mcpWriter($user)->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Foreign', 'deck' => 'custom', 'saved_deck_id' => $foreignDeck->id])
        ->assertHasErrors(['Choose a saved deck of this team.']);
    mcpWriter($user)->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Both', 'deck' => 'custom', 'saved_deck_id' => $deck->id, 'custom_cards' => ['1', '2']])
        ->assertHasErrors(['Choose either a saved deck or custom cards.']);

    expect(PokerGame::query()->count())->toBe(1);
});

it('refuses to create a game when the team policy denies it', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    Gate::before(fn ($user, string $ability): ?bool => $ability === 'createPokerGame' ? false : null);

    mcpWriter($user)->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Denied', 'deck' => 'fibonacci'])
        ->assertHasErrors(['This action is unauthorized.']);

    expect(PokerGame::query()->count())->toBe(0);
});

it('treats an empty saved deck id as absent like the web form', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    mcpWriter($user)->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Fib', 'deck' => 'fibonacci', 'saved_deck_id' => ''])->assertOk();

    expect(PokerGame::query()->sole()->deck)->toBe(PokerDeck::Fibonacci);
});

it('validates games like the web form', function () {
    $team = Team::factory()->create();

    mcpWriter(teamMember($team))->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Bad', 'deck' => 'custom', 'custom_cards' => ['3', '3']])
        ->assertHasErrors(['Each card can appear only once.']);
    mcpWriter(teamMember(Team::factory()->create()))->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Hidden', 'deck' => 'fibonacci'])
        ->assertHasErrors(['Not found.']);

    expect(PokerGame::query()->count())->toBe(0);
});

it('adds tasks in order and creates a player once', function () {
    $game = PokerGame::factory()->create();
    pokerFacilitator($game);
    $user = teamMember($game->team);

    $result = mcpStructured(mcpWriter($user)->tool(AddTasks::class, [
        'game_id' => $game->id,
        'tasks' => [['title' => 'Login page', 'description' => '**Bold**'], ['title' => 'Password reset']],
    ])->assertOk());

    mcpWriter($user)->tool(AddTasks::class, ['game_id' => $game->id, 'tasks' => [['title' => 'Third']]])->assertOk();

    expect($result['added'])->toBe(2)
        ->and(PokerTask::query()->where('poker_game_id', $game->id)->orderBy('position')->pluck('title')->all())->toBe(['Login page', 'Password reset', 'Third'])
        ->and(PokerPlayer::query()->where('poker_game_id', $game->id)->where('user_id', $user->id)->count())->toBe(1)
        ->and(PokerPlayer::query()->where('user_id', $user->id)->sole()->is_spectator)->toBeFalse();

    Event::assertDispatchedTimes(PokerTaskSaved::class, 3);
});

it('keeps an existing spectator role', function () {
    $game = PokerGame::factory()->create();
    $user = teamMember($game->team);
    $spectator = PokerPlayer::factory()->spectator()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);

    mcpWriter($user)->tool(AddTasks::class, ['game_id' => $game->id, 'tasks' => [['title' => 'Watched']]])->assertOk();

    expect($spectator->fresh()->is_spectator)->toBeTrue();
});

it('lets a spectator member add tasks since only guests are refused', function () {
    $game = PokerGame::factory()->create();
    $user = teamMember($game->team);
    PokerPlayer::factory()->spectator()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);

    $result = mcpStructured(mcpWriter($user)->tool(AddTasks::class, ['game_id' => $game->id, 'tasks' => [['title' => 'Spectated']]])->assertOk());

    expect($result['added'])->toBe(1)
        ->and(PokerTask::query()->where('poker_game_id', $game->id)->count())->toBe(1);
});

it('adds all tasks or none', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);
    PokerTask::factory()->count(190)->create(['poker_game_id' => $game->id]);

    mcpWriter($user)->tool(AddTasks::class, [
        'game_id' => $game->id,
        'tasks' => collect(range(1, 50))->map(fn (int $n): array => ['title' => "Task {$n}"])->all(),
    ])->assertHasErrors(['A game can hold at most 200 tasks.']);

    expect(PokerTask::query()->where('poker_game_id', $game->id)->count())->toBe(190);

    Event::assertNotDispatched(PokerTaskSaved::class);
});

it('refuses a batch of more than 50 tasks', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);

    mcpWriter($user)->tool(AddTasks::class, [
        'game_id' => $game->id,
        'tasks' => collect(range(1, 51))->map(fn (int $n): array => ['title' => "Task {$n}"])->all(),
    ])->assertHasErrors(['The tasks field must not have more than 50 items.']);

    expect(PokerTask::query()->where('poker_game_id', $game->id)->count())->toBe(0);
});

it('refuses poker writes on an ended game', function () {
    $game = PokerGame::factory()->ended()->create();
    [$user] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    mcpWriter($user)->tool(AddTasks::class, ['game_id' => $game->id, 'tasks' => [['title' => 'Late']]])->assertHasErrors(['This game has ended.']);
    mcpWriter($user)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => $task->id])->assertHasErrors(['This game has ended.']);
});

it('refuses poker writes on a game ended under the lock', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $flipped = false;

    PokerGame::retrieved(function (PokerGame $loaded) use (&$flipped, $game): void {
        if ($flipped || $loaded->id !== $game->id) {
            return;
        }

        $flipped = true;
        DB::table('poker_games')->where('id', $game->id)->update(['ended_at' => now()]);
    });

    mcpWriter($user)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => $task->id])->assertHasErrors(['This game has ended.']);

    expect($game->fresh()->current_task_id)->toBeNull();
});

it('lets only the facilitator select a task, starting round one', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Checkout']);

    mcpWriter($member)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => $task->id])->assertHasErrors(['Only the facilitator can do this.']);

    $result = mcpStructured(mcpWriter($facilitator)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => $task->id])->assertOk());

    expect($game->fresh()->current_task_id)->toBe($task->id)
        ->and($result['currentTask']['title'])->toBe('Checkout')
        ->and($result['currentTask']['round']['number'])->toBe(1);

    mcpWriter($facilitator)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => null])->assertOk();

    expect($game->fresh()->current_task_id)->toBeNull();

    Event::assertDispatched(PokerRoundChanged::class);
});

it('reports tasks of another game as not found', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    $other = PokerTask::factory()->create(['poker_game_id' => PokerGame::factory()->create(['team_id' => $game->team_id])->id]);

    mcpWriter($facilitator)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => $other->id])->assertHasErrors(['Not found.']);
});

it('reveals and stores the nearest card, ties going to the higher card', function () {
    $game = PokerGame::factory()->create();
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '3');
    pokerVote($round, $member, '5');

    $result = mcpStructured(mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertOk());

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::Manual)
        ->and($round->task->fresh()->estimate)->toBe('5')
        ->and($result)->toMatchArray(['estimate' => '5', 'estimateSet' => true, 'reason' => null])
        ->and($result['round']['result']['average'])->toBe(4);

    Event::assertDispatched(PokerTaskEstimated::class);
});

it('stores the single most played card of a non-numeric deck', function () {
    $game = PokerGame::factory()->deck(PokerDeck::Tshirt)->create();
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    [, $other] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, 'M');
    pokerVote($round, $member, 'M');
    pokerVote($round, $other, 'L');

    mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertOk();

    expect($round->task->fresh()->estimate)->toBe('M');
});

it('leaves the estimate unchanged when no card is determined', function (PokerDeck $deck, array $values) {
    $game = PokerGame::factory()->deck($deck)->create();
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, $values[0]);
    pokerVote($round, $member, $values[1]);

    $result = mcpStructured(mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertOk());

    expect($result['estimateSet'])->toBeFalse()
        ->and($result['estimate'])->toBeNull()
        ->and($result['reason'])->toBe('No card could be chosen from the votes.')
        ->and($round->fresh()->revealed_at)->not->toBeNull();

    Event::assertNotDispatched(PokerTaskEstimated::class);
})->with([
    'tied modes' => [PokerDeck::Tshirt, ['S', 'L']],
    'only special cards' => [PokerDeck::Fibonacci, ['?', '☕']],
]);

it('answers a reveal on a task without a round that the round has not started', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $game->forceFill(['current_task_id' => $task->id])->save();

    mcpWriter($user)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $task->id])
        ->assertHasErrors(['This round has not started.']);
});

it('refuses reveals the table does not allow', function () {
    $game = PokerGame::factory()->create();
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $round = openPokerRound($game);
    $otherTask = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertHasErrors(['Nobody has voted yet.']);
    mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $otherTask->id])->assertHasErrors(['This task is not on the table.']);

    pokerVote($round, $member, '8');

    mcpWriter($memberUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertHasErrors(['Only the facilitator can do this.']);

    $round->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::EveryoneVoted]);

    mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertHasErrors(['These cards are already revealed.']);
});

it('keeps anonymous rounds unnamed when revealing', function () {
    $game = PokerGame::factory()->create(['anonymous_votes' => true]);
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '3');
    pokerVote($round, $member, '13');

    $result = mcpStructured(mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertOk());
    $values = collect($result['round']['votes'])->mapWithKeys(fn (array $vote): array => [$vote['playerId'] => $vote['value']])->all();

    expect($values[$member->id])->toBeNull()
        ->and($values[$facilitator->id])->toBe('3')
        ->and(collect($result['round']['result']['distribution'])->pluck('value')->all())->toBe(['3', '13']);
});

it('offers no tool that takes a vote or an estimate value', function () {
    $tools = [CreateGame::class, AddTasks::class, SelectTask::class, RevealTask::class];

    foreach ($tools as $tool) {
        $properties = array_keys((new ReflectionClass($tool))->newInstanceWithoutConstructor()->schema(new JsonSchemaTypeFactory));

        expect($properties)->not->toContain('value')->not->toContain('estimate')->not->toContain('vote');
    }
});
