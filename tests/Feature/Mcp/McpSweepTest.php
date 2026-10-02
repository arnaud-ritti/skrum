<?php

use App\Enums\IntegrationProvider;
use App\Enums\McpScope;
use App\Mcp\Prompts\AnalyzeRetro;
use App\Mcp\Prompts\TeamHealth;

/**
 * @return array<string, Closure(array<string, mixed>): array<string, mixed>>
 */
function mcpSweepArguments(): array
{
    return [
        'retro.teams.list' => fn (array $w): array => [],
        'retro.team.members.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'retro.boards.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'retro.boards.search' => fn (array $w): array => ['query' => 'Sweep'],
        'retro.actions.list' => fn (array $w): array => ['status' => 'all'],
        'retro.board.messages.list' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.summary.get' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.actions.list' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.insights.list' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.health.get' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.roti.get' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'poker.games.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'poker.game.get' => fn (array $w): array => ['game_id' => $w['game']->id],
        'poker.game.tasks.list' => fn (array $w): array => ['game_id' => $w['game']->id],
        'retro.actions.create' => fn (array $w): array => ['board_id' => $w['discussing']->id, 'content' => 'New sweep item'],
        'retro.actions.update' => fn (array $w): array => ['action_id' => $w['actionItem']->id, 'content' => 'Edited sweep item'],
        'retro.actions.complete' => fn (array $w): array => ['action_id' => $w['actionItem']->id],
        'retro.board.suggested_actions.promote' => fn (array $w): array => ['board_id' => $w['discussing']->id, 'suggested_action_id' => $w['promote']->id],
        'retro.board.suggested_actions.reject' => fn (array $w): array => ['board_id' => $w['discussing']->id, 'suggested_action_id' => $w['reject']->id],
        'retro.board.messages.update' => fn (array $w): array => ['message_id' => $w['editable']->id, 'content' => 'Edited sweep card'],
        'poker.games.create' => fn (array $w): array => ['team_id' => $w['team']->id, 'title' => 'Sweep game', 'deck' => 'fibonacci'],
        'poker.game.tasks.add' => fn (array $w): array => ['game_id' => $w['game']->id, 'tasks' => [['title' => 'Sweep story']]],
        'poker.game.task.select' => fn (array $w): array => ['game_id' => $w['game']->id, 'task_id' => $w['next']->id],
        'poker.game.task.reveal' => fn (array $w): array => ['game_id' => $w['game']->id, 'task_id' => $w['current']->id],
        'poker.sources.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'poker.iterations.list' => fn (array $w): array => ['team_id' => $w['team']->id, 'source' => 'jira'],
        'poker.game.tasks.import' => fn (array $w): array => ['game_id' => $w['game']->id, 'source' => 'jira', 'query' => 'project = SWEEP'],
        'poker.game.task.sync' => fn (array $w): array => ['task_id' => $w['imported']->id],
        'retro.board.messages.delete_own' => fn (array $w): array => ['message_id' => $w['deletable']->id],
    ];
}

/**
 * @return array<string, Closure(array<string, mixed>): string>
 */
function mcpSweepMarkers(): array
{
    return [
        'retro.teams.list' => fn (array $w): string => 'Sweep team',
        'retro.team.members.list' => fn (array $w): string => 'Sweep Other',
        'retro.boards.list' => fn (array $w): string => 'Sweep board',
        'retro.boards.search' => fn (array $w): string => 'Sweep board',
        'retro.actions.list' => fn (array $w): string => 'Sweep agreement',
        'retro.board.messages.list' => fn (array $w): string => 'Sweep message',
        'retro.board.summary.get' => fn (array $w): string => 'Sweep board',
        'retro.board.actions.list' => fn (array $w): string => 'Sweep agreement',
        'retro.board.insights.list' => fn (array $w): string => 'Promote me',
        'retro.board.health.get' => fn (array $w): string => 'not_run',
        'retro.board.roti.get' => fn (array $w): string => 'not_started',
        'poker.games.list' => fn (array $w): string => $w['game']->title,
        'poker.game.get' => fn (array $w): string => $w['game']->title,
        'poker.game.tasks.list' => fn (array $w): string => $w['current']->title,
        'retro.actions.create' => fn (array $w): string => 'New sweep item',
        'retro.actions.update' => fn (array $w): string => 'Edited sweep item',
        'retro.actions.complete' => fn (array $w): string => 'Sweep agreement',
        'retro.board.suggested_actions.promote' => fn (array $w): string => 'Promote me',
        'retro.board.suggested_actions.reject' => fn (array $w): string => 'Reject me',
        'retro.board.messages.update' => fn (array $w): string => 'Edited sweep card',
        'poker.games.create' => fn (array $w): string => 'Sweep game',
        'poker.game.tasks.add' => fn (array $w): string => 'Sweep story',
        'poker.game.task.select' => fn (array $w): string => $w['next']->title,
        'poker.game.task.reveal' => fn (array $w): string => 'estimateSet',
        'poker.sources.list' => fn (array $w): string => 'Acme',
        'poker.iterations.list' => fn (array $w): string => 'Sweep scrum board',
        'poker.game.tasks.import' => fn (array $w): string => 'truncated',
        'poker.game.task.sync' => fn (array $w): string => 'pending',
        'retro.board.messages.delete_own' => fn (array $w): string => 'deleted',
    ];
}

it('sweeps every contract tool', function () {
    $swept = array_keys(mcpSweepArguments());
    sort($swept);
    $marked = array_keys(mcpSweepMarkers());
    sort($marked);

    expect($swept)->toBe(mcpContractToolNames())
        ->and($marked)->toBe(mcpContractToolNames());
});

it('never returns an email, a guest token, a guest link or a secret', function (string $name) {
    enableIntegrations(IntegrationProvider::Jira);
    fakeJiraTrackerApi();
    configureLlm();
    $world = mcpSweepWorld();

    actingAsMcp($world['user'], McpScope::cases())
        ->tool(mcpToolClass($name), mcpSweepArguments()[$name]($world))
        ->assertHasNoErrors()
        ->assertSee(mcpSweepMarkers()[$name]($world))
        ->assertDontSee($world['secrets']);
})->with(array_keys(mcpSweepArguments()));

it('never puts secrets in prompts', function () {
    configureLlm();
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());

    $analysis = mcpPromptText($server->prompt(AnalyzeRetro::class, ['board_id' => $world['discussing']->id])->assertOk());
    $health = mcpPromptText($server->prompt(TeamHealth::class, ['team_id' => $world['team']->id])->assertOk());

    expect($analysis)->not->toContain(...$world['secrets'])
        ->and($health)->not->toContain(...$world['secrets']);
});

it('shows the poker guest link in poker.game.get and in no other poker tool', function () {
    $world = mcpSweepWorld();
    $world['game']->update(['guest_access_enabled' => true]);
    $server = actingAsMcp($world['user'], McpScope::cases());
    $guestPath = "/{$world['game']->guest_token}";

    $server->tool(mcpToolClass('poker.game.get'), ['game_id' => $world['game']->id])->assertSee($guestPath);

    foreach (['poker.games.list', 'poker.game.tasks.list', 'poker.game.tasks.add', 'poker.game.task.select', 'poker.game.task.reveal'] as $name) {
        $server->tool(mcpToolClass($name), mcpSweepArguments()[$name]($world))->assertDontSee($world['game']->guest_token);
    }
});
