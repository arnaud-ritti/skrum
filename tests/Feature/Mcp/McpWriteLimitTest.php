<?php

use App\Enums\McpScope;

it('limits writes and deletions per token while reads keep working', function () {
    config(['skrum.mcp.write_rate_limit' => 2]);
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());
    $add = fn () => $server->tool(mcpToolClass('poker.game.tasks.add'), ['game_id' => $world['game']->id, 'tasks' => [['title' => 'Limited']]]);

    $add()->assertHasNoErrors();
    $add()->assertHasNoErrors();
    $add()->assertHasErrors(['Too many changes, wait a moment.']);

    $server->tool(mcpToolClass('retro.board.messages.delete_own'), ['message_id' => $world['deletable']->id])
        ->assertHasErrors(['Too many changes, wait a moment.']);

    $server->tool(mcpToolClass('retro.teams.list'))->assertHasNoErrors();

    expect($world['game']->tasks()->count())->toBe(4);
});
