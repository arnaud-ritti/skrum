<?php

use App\Enums\IntegrationProvider;
use App\Enums\McpFeature;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpBoard;
use App\Mcp\Servers\SkrumServer;
use App\Mcp\Tools\Retro\ListTeams;
use App\Mcp\Tools\SkrumTool;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ToolBaseReadTool extends SkrumTool
{
    protected string $name = 'test.read';

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        return Response::structured(['ok' => true]);
    }
}

class ToolBaseWriteTool extends ToolBaseReadTool
{
    protected string $name = 'test.write';

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }
}

class ToolBaseDeleteTool extends ToolBaseReadTool
{
    protected string $name = 'test.delete';

    protected function requiredScope(): McpScope
    {
        return McpScope::Delete;
    }
}

class ToolBaseInsightsTool extends ToolBaseReadTool
{
    protected string $name = 'test.insights';

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Insights;
    }
}

class ToolBaseTrackersTool extends ToolBaseReadTool
{
    protected string $name = 'test.trackers';

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Trackers;
    }
}

class ToolBaseFailingTool extends ToolBaseReadTool
{
    protected string $name = 'test.fail';

    protected function run(Request $request): Response|ResponseFactory
    {
        return match ($request->get('kind')) {
            'missing' => throw new ModelNotFoundException,
            'not-found-http' => abort(404),
            'forbidden' => throw new AuthorizationException('Only the facilitator can do this.'),
            'unauthorized' => throw new AuthorizationException,
            'locked' => throw new HttpException(423),
            'abort-forbidden' => abort(403),
            'page' => $request->validate($this->paginationRules()),
            'invalid' => $request->validate(['title' => ['required', 'string']]),
            default => throw new RuntimeException('secret-argument-value'),
        };
    }
}

class ToolBaseTestServer extends SkrumServer
{
    protected array $tools = [
        ToolBaseReadTool::class,
        ToolBaseWriteTool::class,
        ToolBaseDeleteTool::class,
        ToolBaseInsightsTool::class,
        ToolBaseTrackersTool::class,
        ToolBaseFailingTool::class,
    ];
}

it('offers only the tools of the granted scopes', function (array $scopes, array $registered, array $hidden) {
    $user = User::factory()->create();
    bindMcpGrant($user, $scopes);

    $names = mcpToolNames(ToolBaseTestServer::actingAs($user));

    expect($names)->toContain(...$registered);

    foreach ($hidden as $name) {
        expect($names)->not->toContain($name);
    }
})->with([
    'read' => [[], ['test.read'], ['test.write', 'test.delete']],
    'read and write' => [[McpScope::Write], ['test.read', 'test.write'], ['test.delete']],
    'read and delete' => [[McpScope::Delete], ['test.read', 'test.delete'], ['test.write']],
    'everything' => [[McpScope::Write, McpScope::Delete], ['test.read', 'test.write', 'test.delete'], []],
]);

it('refuses calls to tools outside the scopes', function () {
    $user = User::factory()->create();
    bindMcpGrant($user);

    ToolBaseTestServer::actingAs($user)->tool(ToolBaseWriteTool::class)->assertHasErrors(['Tool [test.write] not found.']);
    ToolBaseTestServer::actingAs($user)->tool(ToolBaseDeleteTool::class)->assertHasErrors(['Tool [test.delete] not found.']);
});

it('offers insight tools only with an llm provider', function () {
    $user = User::factory()->create();
    bindMcpGrant($user);

    expect(mcpToolNames(ToolBaseTestServer::actingAs($user)))->not->toContain('test.insights');

    configureLlm();

    expect(mcpToolNames(ToolBaseTestServer::actingAs($user)))->toContain('test.insights');
});

it('offers tracker tools only when a visible team has an active tracker', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->jira()->create();

    bindMcpGrant($user);

    expect(McpFeature::Trackers->isAvailable())->toBeFalse()
        ->and(mcpToolNames(ToolBaseTestServer::actingAs($user)))->not->toContain('test.trackers');

    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    bindMcpGrant($user);

    expect(McpFeature::Trackers->isAvailable())->toBeTrue()
        ->and(mcpToolNames(ToolBaseTestServer::actingAs($user)))->toContain('test.trackers');
});

it('turns domain exceptions into translated tool errors', function (string $kind, string $message) {
    $user = User::factory()->create();
    bindMcpGrant($user);

    ToolBaseTestServer::actingAs($user)
        ->tool(ToolBaseFailingTool::class, ['kind' => $kind])
        ->assertHasErrors([$message]);
})->with([
    'missing model' => ['missing', 'Not found.'],
    'http 404' => ['not-found-http', 'Not found.'],
    'forbidden' => ['forbidden', 'Only the facilitator can do this.'],
    'locked' => ['locked', 'The board is closed for editing.'],
    'bare 403' => ['abort-forbidden', 'This action is unauthorized.'],
    'invalid' => ['invalid', 'The title field is required.'],
    'crash' => ['crash', 'Something went wrong.'],
]);

it('rejects absurd page numbers as a validation error', function () {
    $user = User::factory()->create();
    bindMcpGrant($user);

    ToolBaseTestServer::actingAs($user)
        ->tool(ToolBaseFailingTool::class, ['kind' => 'page', 'page' => PHP_INT_MAX])
        ->assertHasErrors(['The page field must not be greater than 10000.']);
});

it('translates tool errors into the user locale', function () {
    $user = User::factory()->create(['locale' => 'fr']);
    bindMcpGrant($user);
    app()->setLocale('fr');

    ToolBaseTestServer::actingAs($user)
        ->tool(ToolBaseFailingTool::class, ['kind' => 'missing'])
        ->assertHasErrors(['Introuvable.']);
});

it('translates the default authorization message into the user locale', function () {
    $user = User::factory()->create(['locale' => 'fr']);
    bindMcpGrant($user);
    app()->setLocale('fr');

    ToolBaseTestServer::actingAs($user)
        ->tool(ToolBaseFailingTool::class, ['kind' => 'unauthorized'])
        ->assertHasErrors(["Cette action n'est pas autorisée."]);
});

it('logs unexpected failures without their content', function () {
    $messages = [];
    Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$messages): void {
        $messages[] = $event->message.json_encode($event->context);
    });
    $user = User::factory()->create();
    bindMcpGrant($user);

    ToolBaseTestServer::actingAs($user)
        ->tool(ToolBaseFailingTool::class, ['kind' => 'crash'])
        ->assertHasErrors(['Something went wrong.'])
        ->assertDontSee('secret-argument-value');

    expect(implode("\n", $messages))->toContain('MCP tool failed.')
        ->not->toContain('secret-argument-value');
});

it('limits write and delete calls per token while reads keep working', function () {
    config(['skrum.mcp.write_rate_limit' => 2]);
    $user = User::factory()->create();
    bindMcpGrant($user, [McpScope::Write, McpScope::Delete]);

    ToolBaseTestServer::actingAs($user)->tool(ToolBaseWriteTool::class)->assertOk();
    ToolBaseTestServer::actingAs($user)->tool(ToolBaseDeleteTool::class)->assertOk();
    ToolBaseTestServer::actingAs($user)->tool(ToolBaseWriteTool::class)
        ->assertHasErrors(['Too many changes, wait a moment.']);
    ToolBaseTestServer::actingAs($user)->tool(ToolBaseReadTool::class)->assertOk();
});

it('reports invisible resources exactly like missing ones', function (string $resolver, Closure $foreign) {
    $user = User::factory()->create();
    bindMcpGrant($user);
    $context = resolve(McpContext::class);

    foreach ([$foreign()->id, (string) Str::uuid(), 'not-a-uuid'] as $id) {
        expect(fn () => $context->{$resolver}($id))->toThrow(ModelNotFoundException::class);
    }
})->with([
    'team' => ['team', fn () => Team::factory()->create()],
    'board' => ['retro', fn () => Retro::factory()->create()],
    'poker game' => ['pokerGame', fn () => PokerGame::factory()->create()],
    'action item' => ['actionItem', fn () => ActionItem::factory()->create()],
]);

it('resolves resources of teams the user can see', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $admin = workspaceManager($team->workspace);
    $retro = Retro::factory()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id]);

    foreach ([$member, $admin] as $user) {
        bindMcpGrant($user);
        $context = resolve(McpContext::class);

        expect($context->team($team->id)->id)->toBe($team->id)
            ->and($context->retro($retro->id)->id)->toBe($retro->id)
            ->and($context->pokerGame($game->id)->id)->toBe($game->id)
            ->and($context->actionItem($item->id)->id)->toBe($item->id);
    }
});

it('limits a bound token to its team', function () {
    $user = User::factory()->create();
    $bound = Team::factory()->withMember($user)->create();
    $other = Team::factory()->withMember($user)->create();
    bindMcpGrant($user, team: $bound);
    $context = resolve(McpContext::class);

    expect($context->visibleTeamIds())->toBe([$bound->id])
        ->and(fn () => $context->team($other->id))->toThrow(ModelNotFoundException::class);
});

it('returns nothing for a bound team the user no longer sees', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $grant = bindMcpGrant($user, team: $team);

    SkrumServer::actingAs($user, 'sanctum')
        ->tool(ListTeams::class)
        ->assertStructuredContent(fn ($json) => $json->has('items', 1)->etc());

    $team->members()->detach($user);
    app()->forgetScopedInstances();
    $grant->bind();

    SkrumServer::actingAs($user, 'sanctum')
        ->tool(ListTeams::class)
        ->assertStructuredContent(['items' => [], 'page' => 1, 'hasMore' => false]);

    expect(fn () => resolve(McpContext::class)->team($team->id))->toThrow(ModelNotFoundException::class);
});

it('reads existing participants and players without creating any', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $retro = Retro::factory()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    bindMcpGrant($user);
    $context = resolve(McpContext::class);

    expect($context->participant($retro))->toBeNull()
        ->and($context->pokerPlayer($game))->toBeNull()
        ->and(Participant::query()->count())->toBe(0)
        ->and(PokerPlayer::query()->count())->toBe(0);
});

it('creates participants and players once for writes and keeps spectators', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $retro = Retro::factory()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $watchedGame = PokerGame::factory()->create(['team_id' => $team->id]);
    $spectator = PokerPlayer::factory()->spectator()->create(['poker_game_id' => $watchedGame->id, 'user_id' => $user->id]);
    bindMcpGrant($user);
    $context = resolve(McpContext::class);

    $participant = $context->participantForWrite($retro);
    $player = $context->pokerPlayerForWrite($game);

    expect($context->participantForWrite($retro)->id)->toBe($participant->id)
        ->and($participant->user_id)->toBe($user->id)
        ->and($player->is_spectator)->toBeFalse()
        ->and($context->pokerPlayerForWrite($game)->id)->toBe($player->id)
        ->and($context->pokerPlayerForWrite($watchedGame)->id)->toBe($spectator->id)
        ->and($spectator->fresh()->is_spectator)->toBeTrue()
        ->and(Participant::query()->count())->toBe(1);
});

it('presents boards with their counts and link', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->anonymous()->create([
        'team_id' => $team->id,
        'title' => 'Sprint 12',
        'completed_at' => now(),
    ]);
    $participants = Participant::factory()->count(2)->create(['retro_id' => $retro->id]);
    $author = ['retro_id' => $retro->id, 'participant_id' => $participants->first()->id];
    Card::factory()->count(3)->create($author);
    ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participants->first()->id]);
    ActionItem::factory()->completed()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participants->first()->id]);

    $board = resolve(McpBoard::class)->handle(McpBoard::withCounts(Retro::query())->findOrFail($retro->id));

    expect($board)->toMatchArray([
        'id' => $retro->id,
        'title' => 'Sprint 12',
        'teamId' => $team->id,
        'teamName' => 'Platform',
        'phase' => 'completed',
        'isFinished' => true,
        'isAnonymous' => true,
        'openActionItemCount' => 1,
        'url' => route('retros.show', $retro),
    ])
        ->and($board['participantCount'])->toBe(2)
        ->and($board['messageCount'])->toBe(3)
        ->and($board['completedAt'])->not->toBeNull();
});
