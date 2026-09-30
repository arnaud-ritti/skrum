<?php

use App\Models\Team;

it('lists exactly the read tools of the contract', function () {
    configureLlm();
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(actingAsMcp($user)))->toBe(collect([
        'retro.teams.list',
        'retro.team.members.list',
        'retro.boards.list',
        'retro.boards.search',
        'retro.actions.list',
        'retro.board.messages.list',
        'retro.board.summary.get',
        'retro.board.actions.list',
        'retro.board.insights.list',
        'retro.board.health.get',
        'retro.board.roti.get',
        'poker.games.list',
        'poker.game.get',
        'poker.game.tasks.list',
    ])->sort()->values()->all());
});

it('lists the read tools for a read-only token, without insights when no provider is set', function () {
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(actingAsMcp($user)))->not->toContain('retro.board.insights.list')
        ->and(mcpToolNames(actingAsMcp($user)))->toHaveCount(13);
});
