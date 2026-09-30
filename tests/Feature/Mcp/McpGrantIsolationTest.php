<?php

use App\Actions\Mcp\IssueMcpToken;
use App\Models\Team;

it('builds a fresh grant for every request', function () {
    $alpha = Team::factory()->create(['name' => 'Team Alpha']);
    $beta = Team::factory()->create(['name' => 'Team Beta']);
    $ann = teamMember($alpha);
    $bob = teamMember($beta);

    $annToken = app(IssueMcpToken::class)->handle($ann, 'ann', [], null, null)->plainTextToken;
    $bobToken = app(IssueMcpToken::class)->handle($bob, 'bob', [], null, null)->plainTextToken;

    $first = json_encode(postMcp($annToken, mcpToolCallPayload('retro.teams.list'))->assertOk()->json());
    $second = json_encode(postMcp($bobToken, mcpToolCallPayload('retro.teams.list'))->assertOk()->json());

    expect($first)->toContain('Team Alpha')->not->toContain('Team Beta')
        ->and($second)->toContain('Team Beta')->not->toContain('Team Alpha');
});
