<?php

use App\Actions\Retros\GuestCookie;
use App\Contracts\PokerPresenceRoster;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\McpScope;
use App\Enums\PokerDeck;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Mcp\McpGrant;
use App\Mcp\Servers\SkrumServer;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
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
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Games\GameRules;
use App\Support\Games\GameRulesRegistry;
use App\Support\Integrations\OAuthState;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
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

function integrationAdmin(Team $team): User
{
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin);

    return $admin;
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
 * The 29 tools of the QRetro contract. The four tracker tools are listed
 * only while a visible team has an active tracker (spec 5 §2.4).
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
        'poker.sources.list',
        'poker.iterations.list',
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
        'poker.game.tasks.import',
        'poker.game.task.select',
        'poker.game.task.reveal',
        'poker.game.task.sync',
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
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $imported = PokerTask::factory()->imported()->estimated('5')->create(['poker_game_id' => $game->id, 'title' => 'Sweep imported story']);

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
        'imported' => $imported,
        'secrets' => [
            'jira-access',
            'jira-refresh',
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

/**
 * @return array<string, array<string, int|string>>
 */
function integrationOAuthSession(
    Team $team,
    IntegrationProvider $provider,
    IntegrationAccess $access = IntegrationAccess::Write,
    string $state = 'oauth-state-0123456789abcdefghijklmnopqrstu',
    int $expiresInMinutes = 10,
): array {
    return [OAuthState::SessionKey => [
        'state' => $state,
        'provider' => $provider->value,
        'teamId' => $team->id,
        'access' => $access->value,
        'expiresAt' => now()->addMinutes($expiresInMinutes)->getTimestamp(),
    ]];
}

/**
 * A Jira issue as `/rest/api/3/search/jql` returns it.
 *
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function jiraTrackerIssue(string $id, string $key, array $fields = []): array
{
    return [
        'id' => $id,
        'key' => $key,
        'fields' => [
            'summary' => "Story {$key}",
            'description' => ['type' => 'doc', 'version' => 1, 'content' => [
                ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => "About {$key}"]]],
            ]],
            'assignee' => ['displayName' => 'Jane Doe'],
            'status' => ['name' => 'To Do'],
            'customfield_10016' => 3,
            ...$fields,
        ],
    ];
}

/**
 * A Linear issue node with the fields the trackers request.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function linearTrackerIssue(string $id, string $identifier, array $overrides = []): array
{
    return [
        'id' => $id,
        'identifier' => $identifier,
        'title' => "Issue {$identifier}",
        'description' => "About **{$identifier}**",
        'url' => "https://linear.app/acme/issue/{$identifier}",
        'estimate' => 2,
        'assignee' => ['displayName' => 'Sam Lee'],
        'state' => ['name' => 'Todo'],
        ...$overrides,
    ];
}

/**
 * Answers Linear GraphQL calls by the first key found in the query text.
 *
 * @param  array<string, array<string, mixed>|Closure(array<string, mixed>): array<string, mixed>>  $responses
 */
function fakeLinearGraphql(array $responses): void
{
    Http::fake(['api.linear.app/graphql' => function (HttpRequest $request) use ($responses) {
        $query = (string) $request['query'];
        $variables = (array) ($request['variables'] ?? []);

        foreach ($responses as $needle => $data) {
            if (str_contains($query, $needle)) {
                return Http::response(['data' => $data instanceof Closure ? $data($variables) : $data]);
            }
        }

        return Http::response(['errors' => [['message' => "Unexpected query: {$query}"]]], 400);
    }]);
}

/**
 * A game (guest access on) whose team is connected to a tracker, with a
 * facilitator and a member. Only `$source` is enabled on the instance.
 *
 * @return array{
 *     game: PokerGame,
 *     integration: TeamIntegration,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer
 * }
 */
function trackerTable(IntegrationProvider $source = IntegrationProvider::Jira, IntegrationAccess $access = IntegrationAccess::Write, PokerDeck $deck = PokerDeck::Fibonacci): array
{
    enableIntegrations($source);

    $game = PokerGame::factory()->deck($deck)->withGuestAccess()->create();
    $factory = TeamIntegration::factory();
    $integration = ($source === IntegrationProvider::Jira ? $factory->jira($access) : $factory->linear($access))
        ->create(['team_id' => $game->team_id]);
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    return [
        'game' => $game,
        'integration' => $integration,
        'facilitator' => $facilitator,
        'facilitatorPlayer' => $facilitatorPlayer,
        'member' => $member,
        'memberPlayer' => $memberPlayer,
    ];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function importedPokerTask(PokerGame $game, array $attributes = [], IntegrationProvider $source = IntegrationProvider::Jira): PokerTask
{
    $task = PokerTask::factory()
        ->imported($source, $source === IntegrationProvider::Jira ? 'cloud-1' : 'org-1')
        ->create(['poker_game_id' => $game->id]);

    $task->forceFill($attributes)->save();

    return $task->fresh() ?? $task;
}

/**
 * Fakes every Jira endpoint the poker import and write-back use on the
 * `cloud-1` site. More specific patterns come first: the first match wins.
 *
 * @param  array<int, array<string, mixed>>|null  $issues
 */
function fakeJiraTrackerApi(?array $issues = null): void
{
    $issues ??= [jiraTrackerIssue('10001', 'PROJ-1'), jiraTrackerIssue('10002', 'PROJ-2')];

    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board/*/sprint*' => Http::response(['values' => [
            ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active'],
        ]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board*' => Http::response([
            'values' => [['id' => 7, 'name' => 'Sweep scrum board']],
            'isLast' => true,
        ]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::response(['issues' => $issues, 'isLast' => true]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*/editmeta' => Http::response(['fields' => [
            'customfield_10016' => ['name' => 'Story point estimate'],
        ]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*' => Http::response(null, 204),
    ]);
}

function jiraApiUrl(string $path): string
{
    return 'api.atlassian.com/ex/jira/cloud-1/'.ltrim($path, '/');
}

/**
 * @return array<string, mixed>
 */
function jiraAccount(string $accountId, string $displayName, ?string $email = null, bool $active = true, string $type = 'atlassian'): array
{
    return array_filter([
        'accountId' => $accountId,
        'accountType' => $type,
        'displayName' => $displayName,
        'emailAddress' => $email,
        'active' => $active,
    ], fn (mixed $value): bool => $value !== null);
}

/**
 * @return array<string, mixed>
 */
function linearAccount(string $id, string $name, string $email, bool $active = true): array
{
    return ['id' => $id, 'name' => $name, 'displayName' => strtolower(strtok($name, ' ') ?: $name), 'email' => $email, 'active' => $active];
}

/**
 * @param  array<string, mixed>  $responses  keyed by a fragment of the GraphQL document
 */
function fakeLinearUserDirectoryGraphql(array $responses): void
{
    Http::fake(['api.linear.app/graphql' => function (HttpRequest $request) use ($responses) {
        foreach ($responses as $fragment => $response) {
            if (str_contains((string) $request['query'], $fragment)) {
                return $response instanceof Closure ? $response($request) : Http::response(['data' => $response]);
            }
        }

        return Http::response(['errors' => [['message' => 'Unexpected query', 'extensions' => ['code' => 'INVALID_INPUT']]]], 400);
    }]);
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Retro, 1: ActionItem, 2: User}
 */
function exportBoardItem(array $attributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->withGuestAccess()->create(['title' => 'Sprint 12']);
    [$author, $participant] = retroMember($retro);
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $participant->id,
        'content' => 'Speed up CI',
        ...$attributes,
    ]);

    return [$retro, $item, $author];
}

/**
 * @param  array<int, array{id: string, name: string}>|null  $priorities
 * @return array<string, mixed>
 */
function jiraCreateMeta(bool $assignee = true, bool $priority = true, ?array $priorities = null): array
{
    $fields = [['fieldId' => 'summary', 'name' => 'Summary']];

    if ($assignee) {
        $fields[] = ['fieldId' => 'assignee', 'name' => 'Assignee'];
    }

    if ($priority) {
        $fields[] = ['fieldId' => 'priority', 'name' => 'Priority', 'allowedValues' => $priorities ?? [
            ['id' => '2', 'name' => 'High'],
            ['id' => '3', 'name' => 'Medium'],
            ['id' => '4', 'name' => 'Low'],
        ]];
    }

    return ['startAt' => 0, 'maxResults' => 200, 'total' => count($fields), 'fields' => $fields];
}

/**
 * @return array{0: User, 1: GamePlayer}
 */
function gameRoomMember(GameRoom $room): array
{
    $user = teamMember($room->team);

    return [$user, GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: GamePlayer}
 */
function gameRoomHost(GameRoom $room): array
{
    [$user, $player] = gameRoomMember($room);

    $room->forceFill(['host_player_id' => $player->id])->save();

    return [$user, $player];
}

function gameRoomGuest(GameRoom $room, string $secret = 'secret'): GamePlayer
{
    return GamePlayer::factory()->guest($secret)->create(['game_room_id' => $room->id]);
}

/**
 * @return array<string, string>
 */
function gameGuestCookie(GamePlayer $player, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::GameScope, $player->game_room_id) => "{$player->id}|{$secret}"];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function activeGameRound(GameRoom $room, array $attributes = []): GameRound
{
    $round = GameRound::factory()->create([
        'game_room_id' => $room->id,
        'game' => $room->game,
        ...$attributes,
    ]);

    $room->forceFill(['current_round_id' => $round->id])->save();

    return $round;
}

/**
 * @param  array<array-key, mixed>|string  $payload
 */
function gamePayloadJson(array|string $payload): string
{
    return is_string($payload) ? $payload : (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * The word as a JSON string value, or as a whole word anywhere in the
 * payload, ignoring case and accents: masks carry single letters, never the
 * word itself.
 *
 * @param  array<array-key, mixed>|string  $payload
 */
function gamePayloadExposesWord(array|string $payload, string $word): bool
{
    $json = mb_strtolower(gamePayloadJson($payload));

    if (str_contains($json, '"'.mb_strtolower($word).'"')) {
        return true;
    }

    foreach ([[$json, $word], [Str::ascii($json), Str::ascii($word)]] as [$haystack, $needle]) {
        $pattern = '/(?<![\p{L}\p{N}])'.preg_quote($needle, '/').'(?![\p{L}\p{N}])/iu';

        if (preg_match($pattern, $haystack) === 1) {
            return true;
        }
    }

    return false;
}

function bindGameRules(GameRules ...$rules): void
{
    app()->instance(GameRulesRegistry::class, new GameRulesRegistry(array_values($rules)));
}
