<?php

use App\Enums\McpScope;
use App\Models\Team;

$readTools = [
    'poker.game.get',
    'poker.game.tasks.list',
    'poker.games.list',
    'retro.actions.list',
    'retro.board.actions.list',
    'retro.board.health.get',
    'retro.board.insights.list',
    'retro.board.messages.list',
    'retro.board.roti.get',
    'retro.board.summary.get',
    'retro.boards.list',
    'retro.boards.search',
    'retro.team.members.list',
    'retro.teams.list',
];

$writeTools = [
    'poker.game.task.reveal',
    'poker.game.task.select',
    'poker.game.tasks.add',
    'poker.games.create',
    'retro.actions.complete',
    'retro.actions.create',
    'retro.actions.update',
    'retro.board.messages.update',
    'retro.board.suggested_actions.promote',
    'retro.board.suggested_actions.reject',
];

$insightTools = [
    'retro.board.insights.list',
    'retro.board.suggested_actions.promote',
    'retro.board.suggested_actions.reject',
];

it('registers exactly the contract tools and prompts', function () {
    configureLlm();
    $user = teamMember(Team::factory()->create());

    $server = actingAsMcp($user, McpScope::cases());

    expect(mcpToolNames($server))->toBe(mcpContractToolNames())
        ->and(mcpPromptNames($server))->toBe(['analyze-retro', 'team-health']);
});

it('lists exactly the tools of the granted scopes', function (array $scopes, array $expected) {
    configureLlm();
    $user = teamMember(Team::factory()->create());

    sort($expected);

    expect(mcpToolNames(actingAsMcp($user, $scopes)))->toBe($expected);
})->with([
    'read' => [[McpScope::Read], $readTools],
    'read and write' => [[McpScope::Read, McpScope::Write], [...$readTools, ...$writeTools]],
    'read and delete' => [[McpScope::Read, McpScope::Delete], [...$readTools, 'retro.board.messages.delete_own']],
    'every scope' => [McpScope::cases(), [...$readTools, ...$writeTools, 'retro.board.messages.delete_own']],
]);

it('hides the insight tools without an LLM provider', function () use ($readTools, $writeTools, $insightTools) {
    $user = teamMember(Team::factory()->create());

    $listed = mcpToolNames(actingAsMcp($user, McpScope::cases()));

    $expected = array_values(array_diff([...$readTools, ...$writeTools, 'retro.board.messages.delete_own'], $insightTools));
    sort($expected);

    expect($listed)->toBe($expected);
});

it('refuses calls to tools outside the grant', function (string $name) {
    $user = teamMember(Team::factory()->create());

    actingAsMcp($user, [McpScope::Read])->tool(mcpToolClass($name), [])->assertHasErrors(["Tool [{$name}] not found."]);
})->with([...$writeTools, 'retro.board.messages.delete_own']);
