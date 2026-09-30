<?php

use App\Actions\Retros\GuestCookie;
use App\Contracts\PokerPresenceRoster;
use App\Enums\IntegrationProvider;
use App\Enums\McpScope;
use App\Enums\PokerDeck;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Mcp\McpGrant;
use App\Mcp\Servers\SkrumServer;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\PersonalAccessToken;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use App\Models\Retro;
use App\Models\SuggestedAction;
use App\Models\Survey;
use App\Models\SurveyResponse;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Laravel\Mcp\Server\Testing\PendingTestResponse;
use Laravel\Mcp\Server\Testing\TestResponse as McpTestResponse;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * @return array{0: User, 1: Participant}
 */
function retroMember(Retro $retro): array
{
    $user = User::factory()->create();
    $retro->team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $retro->team->members()->attach($user);

    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id]);

    return [$user, $participant];
}

/**
 * @return array{0: User, 1: Participant}
 */
function retroFacilitator(Retro $retro): array
{
    [$user, $participant] = retroMember($retro);

    $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

    return [$user, $participant];
}

/**
 * @return array<string, string>
 */
function retroGuestCookie(Participant $participant, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::RetroScope, $participant->retro_id) => "{$participant->id}|{$secret}"];
}

function answerSurvey(Survey $survey, Participant $participant, int ...$optionIndexes): void
{
    $options = $survey->options()->get()->values();

    foreach ($optionIndexes as $index) {
        SurveyResponse::factory()->create([
            'survey_id' => $survey->id,
            'survey_option_id' => $options[$index]->id,
            'participant_id' => $participant->id,
        ]);
    }
}

function configureLlm(string $provider = 'anthropic', ?string $baseUrl = null): void
{
    config(['services.llm' => [
        'provider' => $provider,
        'key' => 'llm-secret-key',
        'model' => 'test-model',
        'base_url' => $baseUrl,
    ]]);
}

/**
 * @param  array<array-key, mixed>|string  $reply
 */
function fakeLlmReply(array|string $reply): void
{
    $text = is_string($reply) ? $reply : (string) json_encode($reply);

    Http::fake([
        'api.anthropic.com/*' => Http::response(['content' => [['type' => 'text', 'text' => $text]]]),
    ]);
}

function fakeLlmFailure(): void
{
    Http::fake([
        'api.anthropic.com/*' => Http::response(['error' => ['message' => 'invalid x-api-key llm-secret-key']], 500),
    ]);
}

function llmRequestBodies(): string
{
    return Http::recorded()
        ->map(fn (array $pair) => $pair[0]->body())
        ->implode("\n");
}

function teamMember(Team $team): User
{
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($user);

    return $user;
}

function workspaceManager(Workspace $workspace, WorkspaceRole $role = WorkspaceRole::Admin): User
{
    $user = User::factory()->create();
    $workspace->members()->attach($user, ['role' => $role->value]);

    return $user;
}

/**
 * @return array{0: User, 1: Participant}
 */
function workspaceAdminParticipant(Retro $retro): array
{
    $user = workspaceManager($retro->team->workspace);

    return [$user, Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: PokerPlayer}
 */
function pokerMember(PokerGame $game): array
{
    $user = teamMember($game->team);

    return [$user, PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: PokerPlayer}
 */
function pokerFacilitator(PokerGame $game): array
{
    [$user, $player] = pokerMember($game);

    $game->forceFill(['facilitator_player_id' => $player->id])->save();

    return [$user, $player];
}

function pokerGuest(PokerGame $game, string $secret = 'secret'): PokerPlayer
{
    return PokerPlayer::factory()->guest($secret)->create(['poker_game_id' => $game->id]);
}

/**
 * @return array<string, string>
 */
function pokerGuestCookie(PokerPlayer $player, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::PokerScope, $player->poker_game_id) => "{$player->id}|{$secret}"];
}

function openPokerRound(PokerGame $game, ?PokerTask $task = null): PokerRound
{
    $task ??= PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $round = PokerRound::factory()->create([
        'poker_task_id' => $task->id,
        'anonymous' => (bool) $game->anonymous_votes,
    ]);

    $game->forceFill(['current_task_id' => $task->id])->save();

    return $round;
}

function pokerVote(PokerRound $round, PokerPlayer $player, string $value): PokerVote
{
    return PokerVote::factory()->create([
        'poker_round_id' => $round->id,
        'poker_player_id' => $player->id,
        'value' => $value,
    ]);
}

/**
 * @return array{
 *     game: PokerGame,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer,
 *     round: PokerRound
 * }
 */
function pokerRevealTable(PokerDeck $deck = PokerDeck::Fibonacci): array
{
    $game = PokerGame::factory()->deck($deck)->withGuestAccess()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    return [
        'game' => $game,
        'facilitator' => $facilitator,
        'facilitatorPlayer' => $facilitatorPlayer,
        'member' => $member,
        'memberPlayer' => $memberPlayer,
        'round' => openPokerRound($game),
    ];
}

/**
 * @param  array<array-key, mixed>|string  $payload
 */
function pokerPayloadJson(array|string $payload): string
{
    return is_string($payload) ? $payload : (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * @param  array<array-key, mixed>|string  $payload
 */
function pokerPayloadExposes(array|string $payload, PokerPlayer $player, string $value): bool
{
    return str_contains(pokerPayloadJson($payload), "\"playerId\":\"{$player->id}\",\"value\":\"{$value}\"");
}

/**
 * @param  array<int, string>|null  $playerIds
 */
function fakePokerRoster(?array $playerIds): void
{
    app()->instance(PokerPresenceRoster::class, new class($playerIds) implements PokerPresenceRoster
    {
        /**
         * @param  array<int, string>|null  $playerIds
         */
        public function __construct(private ?array $playerIds) {}

        public function playerIds(PokerGame $game): ?array
        {
            return $this->playerIds;
        }
    });
}

/**
 * @param  array<int, McpScope>  $scopes
 */
function issueTestMcpToken(User $user, array $scopes = [McpScope::Read], ?Team $team = null, ?CarbonInterface $expiresAt = null): string
{
    $abilities = collect([McpScope::Read, ...$scopes])
        ->map(fn (McpScope $scope): string => $scope->value)
        ->unique()
        ->values()
        ->all();

    $newToken = $user->createToken('Test client', $abilities, $expiresAt);

    $token = $newToken->accessToken;

    assert($token instanceof PersonalAccessToken);

    $token->forceFill([
        'team_id' => $team?->id,
        'token_hint' => substr($newToken->plainTextToken, -4),
    ])->save();

    return $newToken->plainTextToken;
}

/**
 * @param  array<string, mixed>  $payload
 * @param  array<string, string>  $headers
 */
function postMcp(?string $token, array $payload = ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'], array $headers = []): TestResponse
{
    app('auth')->forgetGuards();
    app()->forgetScopedInstances();

    if ($token !== null) {
        $headers['Authorization'] = "Bearer {$token}";
    }

    return test()->postJson('/mcp', $payload, [
        'Accept' => 'application/json, text/event-stream',
        ...$headers,
    ]);
}

/**
 * @param  array<int, McpScope>  $scopes
 */
function bindMcpGrant(User $user, array $scopes = [McpScope::Read], ?Team $team = null): McpGrant
{
    app()->forgetScopedInstances();

    $token = PersonalAccessToken::factory()
        ->forUser($user)
        ->withScopes(...$scopes)
        ->create(['team_id' => $team?->id]);

    $grant = new McpGrant($user, $token->id, $token->scopes(), $team?->id);
    $grant->bind();

    return $grant;
}

/**
 * @param  array<int, McpScope>  $scopes
 */
function actingAsMcp(User $user, array $scopes = [McpScope::Read], ?Team $team = null): PendingTestResponse
{
    bindMcpGrant($user, $scopes, $team);

    return SkrumServer::actingAs($user, 'sanctum');
}

/**
 * @return array<string, mixed>
 */
function mcpStructured(McpTestResponse $response): array
{
    return (fn (): ?array => $this->structuredContent())->call($response) ?? [];
}

/**
 * Tool names from tools/list. TestListResponse's registration assertions build each
 * class with `new`, which fails for tools with constructor dependencies, so
 * tests compare names instead.
 *
 * @return array<int, string>
 */
function mcpToolNames(PendingTestResponse $pending): array
{
    $items = (fn (): array => $this->items)->call($pending->tools());

    return collect($items)->pluck('name')->sort()->values()->all();
}

/**
 * A read + write grant, the common case of the write tool tests.
 */
function mcpWriter(User $user, ?Team $team = null): PendingTestResponse
{
    return actingAsMcp($user, [McpScope::Read, McpScope::Write], $team);
}

function mcpPromptText(McpTestResponse $response): string
{
    $payload = (fn (): array => $this->response->toArray())->call($response);

    return (string) ($payload['result']['messages'][0]['content']['text'] ?? '');
}

/**
 * @return array<string, mixed>
 */
function mcpPromptData(McpTestResponse $response): array
{
    $text = mcpPromptText($response);

    preg_match('/```json\n(.*)\n```/s', $text, $matches);

    return json_decode($matches[1] ?? 'null', true) ?? [];
}

/**
 * The 25 tools of the QRetro contract that exist before spec 6 adds the
 * four tracker tools.
 *
 * @return array<int, string>
 */
function mcpContractToolNames(): array
{
    $names = [
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
        'retro.actions.create',
        'retro.actions.update',
        'retro.actions.complete',
        'retro.board.suggested_actions.promote',
        'retro.board.suggested_actions.reject',
        'retro.board.messages.update',
        'poker.games.create',
        'poker.game.tasks.add',
        'poker.game.task.select',
        'poker.game.task.reveal',
        'retro.board.messages.delete_own',
    ];

    sort($names);

    return $names;
}

/**
 * @return class-string
 */
function mcpToolClass(string $name): string
{
    $tools = (new ReflectionClass(SkrumServer::class))->getProperty('tools')->getDefaultValue();

    foreach ($tools as $class) {
        if (app($class)->name() === $name) {
            return $class;
        }
    }

    throw new RuntimeException("No MCP tool is named [{$name}].");
}

/**
 * @return array<int, string>
 */
function mcpPromptNames(PendingTestResponse $pending): array
{
    return collect((fn (): array => $this->items)->call($pending->prompts()))->pluck('name')->sort()->values()->all();
}

/**
 * @param  array<string, mixed>  $arguments
 * @return array<string, mixed>
 */
function mcpToolCallPayload(string $tool, array $arguments = []): array
{
    return ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/call', 'params' => ['name' => $tool, 'arguments' => (object) $arguments]];
}

/**
 * One team with a Discussing board (guest access on, a guest, another
 * member's card, the user's action item, two pending suggestions), a
 * Writing board holding two of the user's cards, and a poker game the
 * user facilitates with a voted current task and a second task.
 *
 * @return array<string, mixed>
 */
function mcpSweepWorld(): array
{
    $workspace = Workspace::factory()->create();
    $team = Team::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sweep team']);

    $user = User::factory()->create(['email' => 'sweep-user@example.test', 'name' => 'Sweep User']);
    $other = User::factory()->create(['email' => 'sweep-other@example.test', 'name' => 'Sweep Other']);

    foreach ([$user, $other] as $member) {
        $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member);
    }

    $discussing = Retro::factory()->withGuestAccess()->inPhase(RetroPhase::Discussing)->create([
        'team_id' => $team->id,
        'title' => 'Sweep board',
    ]);
    $mine = Participant::factory()->create(['retro_id' => $discussing->id, 'user_id' => $user->id]);
    $theirs = Participant::factory()->create(['retro_id' => $discussing->id, 'user_id' => $other->id]);
    Participant::factory()->guest('guest-secret-value')->create(['retro_id' => $discussing->id]);
    Card::factory()->create(['retro_id' => $discussing->id, 'participant_id' => $theirs->id, 'content' => 'Sweep message']);

    $actionItem = ActionItem::factory()->create([
        'retro_id' => $discussing->id,
        'content' => 'Sweep agreement',
        'created_by_participant_id' => $mine->id,
        'created_by_user_id' => $user->id,
        'assignee_user_id' => $other->id,
    ]);

    $promote = SuggestedAction::factory()->create(['retro_id' => $discussing->id, 'content' => 'Promote me']);
    $reject = SuggestedAction::factory()->create(['retro_id' => $discussing->id, 'content' => 'Reject me', 'position' => 1]);

    $writing = Retro::factory()->inPhase(RetroPhase::Writing)->create(['team_id' => $team->id]);
    $writer = Participant::factory()->create(['retro_id' => $writing->id, 'user_id' => $user->id]);
    $editable = Card::factory()->create(['retro_id' => $writing->id, 'participant_id' => $writer->id]);
    $deletable = Card::factory()->create(['retro_id' => $writing->id, 'participant_id' => $writer->id, 'position' => 1]);

    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $player = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);
    $game->update(['facilitator_player_id' => $player->id]);
    $current = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $next = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    pokerVote(openPokerRound($game, $current), $player, '5');

    return [
        'user' => $user,
        'team' => $team,
        'discussing' => $discussing,
        'writing' => $writing,
        'actionItem' => $actionItem,
        'promote' => $promote,
        'reject' => $reject,
        'editable' => $editable,
        'deletable' => $deletable,
        'game' => $game,
        'current' => $current,
        'next' => $next,
        'secrets' => [
            'sweep-user@example.test',
            'sweep-other@example.test',
            $discussing->guest_token,
            $writing->guest_token,
            $game->guest_token,
            'guest-secret-value',
            hash('sha256', 'guest-secret-value'),
        ],
    ];
}

function disableIntegrations(): void
{
    config([
        'services.slack.client_id' => null,
        'services.slack.client_secret' => null,
        'services.telegram.bot_token' => null,
        'services.jira.client_id' => null,
        'services.jira.client_secret' => null,
        'services.linear.client_id' => null,
        'services.linear.client_secret' => null,
    ]);
}

function enableIntegrations(IntegrationProvider ...$providers): void
{
    foreach ($providers as $provider) {
        config(match ($provider) {
            IntegrationProvider::Slack => ['services.slack.client_id' => 'slack-client', 'services.slack.client_secret' => 'slack-secret'],
            IntegrationProvider::Telegram => ['services.telegram.bot_token' => '123456:telegram-token'],
            IntegrationProvider::Jira => ['services.jira.client_id' => 'jira-client', 'services.jira.client_secret' => 'jira-secret'],
            IntegrationProvider::Linear => ['services.linear.client_id' => 'linear-client', 'services.linear.client_secret' => 'linear-secret'],
        });
    }
}
