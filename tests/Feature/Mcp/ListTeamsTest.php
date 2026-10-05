<?php

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Mcp\Tools\Retro\ListTeams;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Testing\Fluent\AssertableJson;

it('lists the teams the user can see alphabetically with board counts', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user)->create(['name' => 'Acme']);
    $beta = Team::factory()->withMember($user)->create(['workspace_id' => $workspace->id, 'name' => 'Beta']);
    $alpha = Team::factory()->withMember($user)->create(['workspace_id' => $workspace->id, 'name' => 'Alpha']);
    Team::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Not mine']);
    Team::factory()->create(['name' => 'Elsewhere']);
    Retro::factory()->inPhase(RetroPhase::Completed)->count(2)->create(['team_id' => $alpha->id]);
    Retro::factory()->inPhase(RetroPhase::Writing)->create(['team_id' => $alpha->id]);

    actingAsMcp($user)
        ->tool(ListTeams::class)
        ->assertOk()
        ->assertStructuredContent([
            'items' => [
                [
                    'id' => $alpha->id,
                    'name' => 'Alpha',
                    'workspaceId' => $workspace->id,
                    'workspaceName' => 'Acme',
                    'isMember' => true,
                    'finishedBoards' => 2,
                    'unfinishedBoards' => 1,
                ],
                [
                    'id' => $beta->id,
                    'name' => 'Beta',
                    'workspaceId' => $workspace->id,
                    'workspaceName' => 'Acme',
                    'isMember' => true,
                    'finishedBoards' => 0,
                    'unfinishedBoards' => 0,
                ],
            ],
            'page' => 1,
            'hasMore' => false,
        ]);
});

it('lets workspace admins see every team of their workspaces', function () {
    $workspace = Workspace::factory()->create();
    $team = Team::factory()->create(['workspace_id' => $workspace->id]);
    $admin = workspaceManager($workspace, WorkspaceRole::Admin);

    actingAsMcp($admin)
        ->tool(ListTeams::class)
        ->assertStructuredContent(fn (AssertableJson $json) => $json
            ->has('items', 1)
            ->where('items.0.id', $team->id)
            ->where('items.0.isMember', false)
            ->etc());
});

it('lists teams of every workspace', function () {
    $user = User::factory()->create();
    $first = Workspace::factory()->withMember($user)->create(['name' => 'First']);
    $second = Workspace::factory()->withMember($user)->create(['name' => 'Second']);
    $a = Team::factory()->withMember($user)->create(['workspace_id' => $first->id, 'name' => 'Platform']);
    $b = Team::factory()->withMember($user)->create(['workspace_id' => $second->id, 'name' => 'Platform']);

    $items = mcpStructured(actingAsMcp($user)->tool(ListTeams::class))['items'];

    expect(collect($items)->map(fn (array $item): array => [$item['id'], $item['workspaceName']])->all())
        ->toBe([[$a->id, 'First'], [$b->id, 'Second']]);
});

it('filters by workspace', function () {
    $user = User::factory()->create();
    $first = Workspace::factory()->withMember($user)->create();
    $second = Workspace::factory()->withMember($user)->create();
    $kept = Team::factory()->withMember($user)->create(['workspace_id' => $first->id]);
    Team::factory()->withMember($user)->create(['workspace_id' => $second->id]);

    actingAsMcp($user)
        ->tool(ListTeams::class, ['workspace_id' => $first->id])
        ->assertStructuredContent(fn (AssertableJson $json) => $json
            ->has('items', 1)
            ->where('items.0.id', $kept->id)
            ->etc());
});

it('paginates', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user)->create();
    foreach (['A', 'B', 'C'] as $name) {
        Team::factory()->withMember($user)->create(['workspace_id' => $workspace->id, 'name' => $name]);
    }

    actingAsMcp($user)
        ->tool(ListTeams::class, ['limit' => 2, 'page' => 1])
        ->assertStructuredContent(fn (AssertableJson $json) => $json
            ->has('items', 2)->where('page', 1)->where('hasMore', true)->etc());

    actingAsMcp($user)
        ->tool(ListTeams::class, ['limit' => 2, 'page' => 2])
        ->assertStructuredContent(fn (AssertableJson $json) => $json
            ->has('items', 1)->where('items.0.name', 'C')->where('hasMore', false)->etc());
});

it('limits a bound token to its team', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user)->create();
    $bound = Team::factory()->withMember($user)->create(['workspace_id' => $workspace->id]);
    Team::factory()->withMember($user)->create(['workspace_id' => $workspace->id]);

    actingAsMcp($user, [McpScope::Read], $bound)
        ->tool(ListTeams::class)
        ->assertStructuredContent(fn (AssertableJson $json) => $json
            ->has('items', 1)->where('items.0.id', $bound->id)->etc());
});

it('validates its arguments', function (array $arguments, string $message) {
    actingAsMcp(User::factory()->create())
        ->tool(ListTeams::class, $arguments)
        ->assertHasErrors([$message]);
})->with([
    'malformed workspace' => [['workspace_id' => 'not-a-uuid'], 'The workspace id field must be a valid UUID.'],
    'limit too high' => [['limit' => 51], 'The limit field must not be greater than 50.'],
    'page zero' => [['page' => 0], 'The page field must be at least 1.'],
]);
