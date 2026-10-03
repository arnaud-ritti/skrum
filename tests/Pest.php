<?php

use App\Actions\Games\BuildGameSnapshot;
use App\Actions\HealthCheck\AttachHealthCheck;
use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\Retros\GuestCookie;
use App\Actions\TeamSurveys\RespondentForParticipant;
use App\Contracts\GamePresenceRoster;
use App\Contracts\PokerPresenceRoster;
use App\Enums\GameKind;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\McpScope;
use App\Enums\PokerDeck;
use App\Enums\RetroPhase;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Enums\WorkspaceRole;
use App\Jobs\Integrations\DeliverToChannel;
use App\Jobs\Integrations\PushActionItemState;
use App\Mcp\McpGrant;
use App\Mcp\Servers\SkrumServer;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Card;
use App\Models\Column;
use App\Models\GamePlayer;
use App\Models\GamePoint;
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
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use App\Models\User;
use App\Models\Vote;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\Workspace;
use App\Support\Games\GameRules;
use App\Support\Games\GameRulesRegistry;
use App\Support\InstanceSettings;
use App\Support\Integrations\HostResolver;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use App\Support\Integrations\OAuthState;
use App\Support\Integrations\Trackers\IssueStatus;
use App\Support\Integrations\Trackers\TrackerIssue;
use App\Support\Surveys\HealthScale;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Mcp\Server\Testing\PendingTestResponse;
use Laravel\Mcp\Server\Testing\TestResponse as McpTestResponse;
use Tests\BrowserTestCase;
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

pest()->extend(TestCase::class)
    ->use(DatabaseMigrations::class)
    ->in('Upgrade');

pest()->extend(BrowserTestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Browser');

pest()->browser()->timeout(20_000);

pest()->extend(TestCase::class)
    ->use(DatabaseTruncation::class)
    ->beforeEach(function (): void {
        if (config('database.connections.'.config('database.default').'.database') === ':memory:') {
            $this->markTestSkipped('The concurrency suite needs a database that several processes can open: run it with bin/test-db <driver> --concurrency.');
        }
    })
    ->in('Concurrency');

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

expect()->extend('toBeOne', fn () => $this->toBe(1));

expect()->extend('toBeIgnoringKeyOrder', function (array $expected) {
    expect(withKeysSorted($this->value))->toBe(withKeysSorted($expected));

    return $this;
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
 * MySQL hands a json column back with its keys reordered: what matters is
 * the same keys and values, with lists kept in their order.
 *
 * @param  array<array-key, mixed>  $value
 * @return array<array-key, mixed>
 */
function withKeysSorted(array $value): array
{
    $sorted = array_map(fn (mixed $item): mixed => is_array($item) ? withKeysSorted($item) : $item, $value);

    if (! array_is_list($sorted)) {
        ksort($sorted);
    }

    return $sorted;
}

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
 * The first read of the instance settings is one query, then they come from the cache;
 * tests that compare query counts take that read out of the comparison.
 */
function warmInstanceSettings(): void
{
    resolve(InstanceSettings::class)->all();
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
    resolve('auth')->forgetGuards();
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
        if (resolve($class)->name() === $name) {
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
        'services.jira_dc.base_url' => null,
        'services.jira_dc.client_id' => null,
        'services.jira_dc.client_secret' => null,
        'services.jira_dc.personal_tokens' => true,
        'services.github_app.app_id' => null,
        'services.github_app.slug' => null,
        'services.github_app.client_id' => null,
        'services.github_app.client_secret' => null,
        'services.github_app.private_key' => '',
        'services.github_app.private_key_path' => null,
        'services.msteams.enabled' => false,
        'services.msteams.allowed_hosts' => [],
        'services.mattermost.url' => '',
        'services.outgoing_webhooks.enabled' => false,
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
            IntegrationProvider::JiraDataCenter => [
                'services.jira_dc.base_url' => 'https://jira.example.com',
                'services.jira_dc.client_id' => 'jira-dc-client',
                'services.jira_dc.client_secret' => 'jira-dc-secret',
                'services.jira_dc.personal_tokens' => true,
            ],
            IntegrationProvider::GitHub => [
                'services.github_app.app_id' => '12345',
                'services.github_app.slug' => 'skrum-test',
                'services.github_app.client_id' => 'github-client',
                'services.github_app.client_secret' => 'github-secret',
                'services.github_app.private_key' => gitHubTestPrivateKey(),
            ],
            IntegrationProvider::MicrosoftTeams => ['services.msteams.enabled' => true],
            IntegrationProvider::Mattermost => ['services.mattermost.url' => 'https://chat.example.com'],
            IntegrationProvider::Webhook => ['services.outgoing_webhooks.enabled' => true],
        });
    }
}

/**
 * Fakes DNS for outgoing webhooks: every host resolves to the given addresses.
 *
 * @param  array<int, string>  $addresses
 */
function outgoingWebhookResolves(array $addresses = ['93.184.216.34']): void
{
    app()->instance(HostResolver::class, new class($addresses) extends HostResolver
    {
        /**
         * @param  array<int, string>  $fixed
         */
        public function __construct(private array $fixed) {}

        public function addresses(string $host): array
        {
            return $this->fixed;
        }
    });
}

function outgoingWebhookSignatureIsValid(HttpRequest $request, string $secret = TeamIntegrationFactory::WebhookSecret): bool
{
    $timestamp = $request->header('X-Skrum-Timestamp')[0] ?? '';
    $expected = 'sha256='.hash_hmac('sha256', "{$timestamp}.{$request->body()}", $secret);

    return hash_equals($expected, $request->header('X-Skrum-Signature')[0] ?? '');
}

function runOutgoingWebhookJob(DeliverToChannel $job): DeliverToChannel
{
    $job->withFakeQueueInteractions();
    $job->handle();

    return $job;
}

/**
 * One voted card "Faster reviews" in a "Wins" column, written by $author.
 */
function webhookTopCard(Retro $retro, Participant $author, Participant $voter): void
{
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Wins']);
    $card = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => 'Faster reviews',
    ]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $voter->id]);
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
        'codeVerifier' => str_repeat('v', 64),
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
    $integration = (match ($source) {
        IntegrationProvider::Linear => $factory->linear($access),
        IntegrationProvider::JiraDataCenter => $factory->jiraDataCenter($access),
        IntegrationProvider::GitHub => $factory->gitHub($access),
        default => $factory->jira($access),
    })->create(['team_id' => $game->team_id]);
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
    $site = match ($source) {
        IntegrationProvider::Linear => 'org-1',
        IntegrationProvider::JiraDataCenter => JiraDataCenterServer::key(TeamIntegrationFactory::JiraDataCenterUrl),
        IntegrationProvider::GitHub => TeamIntegrationFactory::GitHubInstallationId,
        default => 'cloud-1',
    };

    $task = PokerTask::factory()
        ->imported($source, $site)
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
 * @return array<string, mixed>
 */
function gameSnapshotFor(GameRoom $room, GamePlayer $viewer): array
{
    return resolve(BuildGameSnapshot::class)->handle($room->fresh(), $viewer->fresh());
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

/**
 * @param  array<int, string>|null  $presenceIds
 */
function fakeGameRoster(?array $presenceIds): void
{
    app()->instance(GamePresenceRoster::class, new class($presenceIds) implements GamePresenceRoster
    {
        /**
         * @param  array<int, string>|null  $presenceIds
         */
        public function __construct(private ?array $presenceIds) {}

        public function presenceIds(GameRoom $room): ?array
        {
            return $this->presenceIds;
        }
    });
}

/**
 * An active Draw & Guess or Decoded round in a link room: the host, the
 * leader and a guesser joined in that order.
 *
 * @param  array<string, mixed>  $roundAttributes
 * @return array{room: GameRoom, hostUser: User, host: GamePlayer, leaderUser: User, leader: GamePlayer, guesserUser: User, guesser: GamePlayer, round: GameRound}
 */
function wordGuessTable(GameKind $game = GameKind::DrawAndGuess, string $word = 'rocket', array $roundAttributes = []): array
{
    $room = GameRoom::factory()->game($game)->linkAccess()->create();
    [$hostUser, $host] = gameRoomHost($room);
    [$leaderUser, $leader] = gameRoomMember($room);
    [$guesserUser, $guesser] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => $word, 'leader_player_id' => $leader->id, ...$roundAttributes]);

    return [
        'room' => $room->fresh(),
        'hostUser' => $hostUser,
        'host' => $host,
        'leaderUser' => $leaderUser,
        'leader' => $leader,
        'guesserUser' => $guesserUser,
        'guesser' => $guesser,
        'round' => $round,
    ];
}

function gameGiphyItem(string $id): array
{
    return [
        'id' => $id,
        'images' => [
            'fixed_width' => ['url' => "https://media.giphy.com/{$id}/200w.gif", 'webp' => "https://media.giphy.com/{$id}/200w.webp", 'width' => '200', 'height' => '150'],
            'original' => ['url' => "https://media.giphy.com/{$id}/giphy.gif", 'webp' => "https://media.giphy.com/{$id}/giphy.webp", 'width' => '480', 'height' => '360'],
        ],
    ];
}

function fakeGameGifs(string ...$ids): void
{
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'game-gif-key', 'rating' => 'pg']]);

    Http::fake(function (HttpRequest $request) use ($ids) {
        $endpoint = basename((string) parse_url($request->url(), PHP_URL_PATH));

        if (in_array($endpoint, ['search', 'trending'], true)) {
            return Http::response(['data' => array_map(gameGiphyItem(...), $ids)]);
        }

        if (in_array($endpoint, $ids, true)) {
            return Http::response(['data' => gameGiphyItem($endpoint)]);
        }

        return Http::response(['message' => 'Not found'], 404);
    });
}

function gameGifPayload(string $id): array
{
    return [
        'id' => $id,
        'previewUrl' => route('gifs.show', ['gif' => $id, 'size' => 'preview'], false),
        'url' => route('gifs.show', ['gif' => $id, 'size' => 'full'], false),
    ];
}

/**
 * @return array{0: GameRoom, 1: User, 2: GamePlayer}
 */
function sprintGifRoom(): array
{
    $room = GameRoom::factory()->game(GameKind::SprintGif)->linkAccess()->create();
    [$user, $host] = gameRoomHost($room);

    return [$room, $user, $host];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function activeGifRound(GameRoom $room, array $attributes = []): GameRound
{
    return activeGameRound($room, [
        'game' => GameKind::SprintGif,
        'word' => null,
        'question' => 'How did the sprint feel?',
        ...$attributes,
    ]);
}

/**
 * @return array{0: GameRoom, 1: User, 2: GamePlayer, 3: User, 4: GamePlayer}
 */
function anonymousGifIcebreaker(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->anonymous()->create(['gifs_enabled' => true]);
    [$facilitatorUser, $facilitator] = retroFacilitator($retro);
    [$memberUser, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->game(GameKind::SprintGif)->create();
    $host = GamePlayer::factory()->forParticipant($facilitator)->create(['game_room_id' => $room->id]);
    $member = GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);

    return [$room, $facilitatorUser, $host, $memberUser, $member];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function awardGamePoints(GameRoom $room, GamePlayer $player, int $points, bool $isWin = false, array $attributes = []): GamePoint
{
    return GamePoint::factory()->create([
        'team_id' => $room->team_id,
        'game_room_id' => $room->id,
        'player_id' => $player->id,
        'user_id' => $player->accountUserId(),
        'game' => $room->game,
        'points' => $points,
        'is_win' => $isWin,
        ...$attributes,
    ]);
}

/**
 * A real RSA key, generated once per process, so GitHub App JWTs can be
 * signed and verified in tests.
 */
function gitHubTestPrivateKey(): string
{
    static $pem = null;

    if (is_string($pem)) {
        return $pem;
    }

    $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);

    throw_if($key === false || ! openssl_pkey_export($key, $exported), RuntimeException::class, 'Could not create the GitHub test key.');

    return $pem = $exported;
}

function fakeGitHubInstallationToken(string $token = 'ghs_installation_token'): void
{
    Http::fake(['api.github.com/app/installations/*/access_tokens' => Http::response(['token' => $token, 'expires_at' => now()->addHour()->toIso8601String()], 201)]);
}

function jiraDataCenterUrl(string $path): string
{
    return 'jira.example.com/'.ltrim($path, '/');
}

function renderedEstimateBlock(string $value): string
{
    return "<!-- skrum:estimate -->\n**Estimate:** {$value}\n<!-- /skrum:estimate -->";
}

/**
 * @return array<string, mixed>
 */
function gitHubRepository(int $id, string $fullName): array
{
    return ['id' => $id, 'full_name' => $fullName, 'name' => explode('/', $fullName)[1]];
}

/**
 * An issue as the GitHub REST API returns it, in `acme/api`.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function gitHubIssue(int $number, array $overrides = []): array
{
    return [
        'number' => $number,
        'title' => "Issue {$number}",
        'body' => "About issue {$number}",
        'html_url' => "https://github.com/acme/api/issues/{$number}",
        'repository_url' => 'https://api.github.com/repos/acme/api',
        'state' => 'open',
        'assignees' => [['login' => 'octocat', 'id' => 583231]],
        ...$overrides,
    ];
}

/**
 * Fakes the GitHub endpoints poker uses for repository 9001 (`acme/api`).
 * Routes given first win, including over a default with the same pattern.
 *
 * @param  array<string, mixed>  $routes
 */
function fakeGitHubTrackerApi(array $routes = []): void
{
    $defaults = [
        'api.github.com/app/installations/*/access_tokens' => Http::response(['token' => 'ghs_installation_token', 'expires_at' => now()->addHour()->toIso8601String()], 201),
        'api.github.com/installation/repositories*' => Http::response([
            'total_count' => 2,
            'repositories' => [gitHubRepository(9001, 'acme/api'), gitHubRepository(9002, 'acme/web')],
        ]),
        'api.github.com/repositories/9001' => Http::response(gitHubRepository(9001, 'acme/api')),
        'api.github.com/repos/acme/api/milestones*' => Http::response([
            ['number' => 3, 'title' => 'Sprint 3', 'due_on' => '2026-10-20T07:00:00Z'],
            ['number' => 2, 'title' => 'Sprint 2', 'due_on' => '2026-10-10T07:00:00Z'],
            ['number' => 4, 'title' => 'Someday', 'due_on' => null],
            ['number' => 1, 'title' => 'Late', 'due_on' => '2026-09-01T07:00:00Z'],
        ]),
        'api.github.com/repos/acme/api/issues?*' => Http::response([
            gitHubIssue(1),
            gitHubIssue(5, ['pull_request' => ['url' => 'https://api.github.com/repos/acme/api/pulls/5']]),
            gitHubIssue(2),
        ]),
        'api.github.com/search/issues*' => Http::response(['total_count' => 1, 'incomplete_results' => false, 'items' => [gitHubIssue(7)]]),
        'api.github.com/repositories/9001/issues/*' => fn (HttpRequest $request) => Http::response(gitHubIssue((int) basename($request->url()))),
        'api.github.com/graphql' => gitHubGraphqlIssues(),
    ];

    Http::fake([...$routes, ...array_diff_key($defaults, $routes)]);
}

/**
 * Answers `GitHubTracker::issues()`'s batched GraphQL read from REST-shaped
 * fixtures (`gitHubIssue()`); a number missing from `$issues` comes back
 * null with a NOT_FOUND error, as GitHub answers for deleted issues and
 * pull requests. Without `$issues`, every requested number exists.
 *
 * @param  array<int, array<string, mixed>>|null  $issues
 */
function gitHubGraphqlIssues(?array $issues = null): Closure
{
    return function (HttpRequest $request) use ($issues) {
        preg_match_all('/\bi(\d+): issue\(number: \d+\)/', (string) $request['query'], $matches);
        $repository = [];
        $errors = [];

        foreach ($matches[1] as $number) {
            $raw = $issues === null ? gitHubIssue((int) $number) : ($issues[(int) $number] ?? null);

            if ($raw === null) {
                $repository["i{$number}"] = null;
                $errors[] = ['type' => 'NOT_FOUND', 'path' => ['repository', "i{$number}"], 'message' => 'Could not resolve to an Issue.'];

                continue;
            }

            $repository["i{$number}"] = [
                'number' => $raw['number'],
                'title' => $raw['title'],
                'body' => $raw['body'],
                'url' => $raw['html_url'],
                'state' => strtoupper($raw['state']),
                'stateReason' => isset($raw['state_reason']) ? strtoupper($raw['state_reason']) : null,
                'updatedAt' => $raw['updated_at'] ?? '2026-10-07T09:00:00Z',
                'assignees' => ['nodes' => array_map(fn (array $assignee): array => ['login' => $assignee['login']], $raw['assignees'])],
            ];
        }

        return Http::response(['data' => ['repository' => $repository], ...($errors === [] ? [] : ['errors' => $errors])]);
    };
}

/**
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function jiraTransition(string $id, string $toId, string $toName, string $category, array $fields = []): array
{
    return ['id' => $id, 'name' => $toName, 'to' => ['id' => $toId, 'name' => $toName, 'statusCategory' => ['key' => $category]], 'fields' => $fields];
}

/**
 * Jira Cloud issue 10001 (PROJ-1) reads as `$before`, then as `$after`
 * once a transition was posted.
 *
 * @param  array<string, mixed>  $before
 * @param  array<string, mixed>  $after
 * @param  array<int, array<string, mixed>>  $transitions
 */
function fakeJiraTransitions(array $before, array $after, array $transitions): void
{
    $posted = false;

    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => function () use (&$posted, $before, $after) {
            return Http::response(['issues' => [jiraTrackerIssue('10001', 'PROJ-1', $posted ? $after : $before)], 'isLast' => true]);
        },
        jiraApiUrl('rest/api/3/issue/10001?*') => function () use (&$posted, $before, $after) {
            return Http::response(jiraTrackerIssue('10001', 'PROJ-1', $posted ? $after : $before));
        },
        jiraApiUrl('rest/api/3/issue/10001/transitions*') => function (HttpRequest $request) use (&$posted, $transitions) {
            if ($request->method() === 'POST') {
                $posted = true;

                return Http::response(null, 204);
            }

            return Http::response(['transitions' => $transitions]);
        },
    ]);
}

/**
 * An item of a completed retro exported to Jira `cloud-1` as PROJ-1
 * (issue 10001), with status sync on. The author created it on the board
 * and owns it on the workspace pages too.
 *
 * @param  array<string, mixed>  $link
 * @param  array<string, mixed>  $item
 * @return array{integration: TeamIntegration, item: ActionItem, link: ActionItemExternalLink, retro: Retro, author: User}
 */
function statusSyncLink(array $link = [], IntegrationAccess $access = IntegrationAccess::Write, array $item = [], bool $syncOn = true): array
{
    enableIntegrations(IntegrationProvider::Jira);
    [$retro, $actionItem, $author] = exportBoardItem($item);
    $actionItem->forceFill(['created_by_user_id' => $author->id])->save();
    $integration = TeamIntegration::factory()->jira($access)->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => $syncOn, 'statusSyncSince' => '2026-10-01T00:00:00+00:00']])->save();
    $externalLink = ActionItemExternalLink::factory()->create([
        'action_item_id' => $actionItem->id,
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
    ]);
    $externalLink->forceFill($link)->save();

    return [
        'integration' => $integration->fresh() ?? $integration,
        'item' => $actionItem->fresh() ?? $actionItem,
        'link' => $externalLink->fresh() ?? $externalLink,
        'retro' => $retro,
        'author' => $author,
    ];
}

/**
 * A tracker read as the trackers return it; `$kind` is the provider's
 * category (Jira `new`/`indeterminate`/`done`, Linear state type, GitHub
 * `open`/`completed`/`not_planned`).
 *
 * @param  array<string, mixed>  $overrides
 */
function statusSyncIssue(string $externalId, string $key, string $kind, ?string $updatedAt = '2026-10-07T10:00:00+00:00', array $overrides = []): TrackerIssue
{
    $name = (string) ($overrides['status'] ?? ($kind === 'done' || $kind === 'completed' ? 'Done' : 'To Do'));

    return new TrackerIssue(
        externalId: $externalId,
        key: $key,
        title: (string) ($overrides['title'] ?? "Issue {$key}"),
        description: $overrides['description'] ?? null,
        url: (string) ($overrides['url'] ?? "https://acme.atlassian.net/browse/{$key}"),
        assignee: $overrides['assignee'] ?? null,
        estimate: $overrides['estimate'] ?? null,
        status: $name,
        issueStatus: new IssueStatus(
            id: (string) ($overrides['statusId'] ?? ($kind === 'done' ? '10002' : '10000')),
            name: $name,
            kind: $kind,
            container: (string) ($overrides['container'] ?? Str::before($key, '-')),
            updatedAt: $updatedAt === null ? null : CarbonImmutable::parse($updatedAt),
        ),
    );
}

function runStatusPush(ActionItemExternalLink $link): PushActionItemState
{
    $job = (new PushActionItemState($link->id))->withFakeQueueInteractions();

    app()->call($job->handle(...));

    return $job;
}

const WhiteboardPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function renamedWhiteboardUser(User $user, string $name, string $locale = 'en'): User
{
    $user->forceFill(['name' => $name, 'locale' => $locale])->save();

    return $user;
}

/**
 * @return array{0: User, 1: WhiteboardMember}
 */
function whiteboardMember(Whiteboard $board): array
{
    $user = teamMember($board->team);

    return [$user, WhiteboardMember::factory()->create(['whiteboard_id' => $board->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: WhiteboardMember}
 */
function whiteboardFacilitator(Whiteboard $board): array
{
    [$user, $member] = whiteboardMember($board);

    $board->update(['facilitator_member_id' => $member->id]);

    return [$user, $member];
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     board: Whiteboard,
 *     fran: User,
 *     franMember: WhiteboardMember
 * }
 */
function whiteboardWithFacilitator(array $attributes = []): array
{
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Sprint board', ...$attributes]);
    [$fran, $franMember] = whiteboardFacilitator($board);

    return [
        'board' => $board,
        'fran' => renamedWhiteboardUser($fran, 'Fran Facilitator'),
        'franMember' => $franMember,
    ];
}

function whiteboardGuest(Whiteboard $board, string $secret = 'secret'): WhiteboardMember
{
    return WhiteboardMember::factory()->guest($secret)->create(['whiteboard_id' => $board->id]);
}

/**
 * @return array<string, string>
 */
function whiteboardGuestCookie(WhiteboardMember $member, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::WhiteboardScope, $member->whiteboard_id) => "{$member->id}|{$secret}"];
}

/**
 * @return array{0: User, 1: TeamSurveyRespondent}
 */
function surveyMember(TeamSurvey $survey): array
{
    $user = teamMember($survey->team);

    return [$user, TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: TeamSurveyRespondent}
 */
function surveyFacilitator(TeamSurvey $survey): array
{
    [$user, $respondent] = surveyMember($survey);

    $survey->update(['facilitator_respondent_id' => $respondent->id, 'created_by_user_id' => $user->id]);

    return [$user, $respondent];
}

function surveyGuest(TeamSurvey $survey, string $secret = 'secret'): TeamSurveyRespondent
{
    return TeamSurveyRespondent::factory()->guest($secret)->create(['team_survey_id' => $survey->id]);
}

/**
 * @return array<string, string>
 */
function surveyGuestCookie(TeamSurveyRespondent $respondent, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::SurveyScope, $respondent->team_survey_id) => "{$respondent->id}|{$secret}"];
}

/**
 * @param  array<string, mixed>  $attributes
 * @param  array<int, string>  $options  labels, for a choice question
 */
function surveyQuestion(
    TeamSurvey $survey,
    TeamSurveyQuestionKind $kind = TeamSurveyQuestionKind::Scale,
    array $attributes = [],
    array $options = [],
): TeamSurveyQuestion {
    $question = TeamSurveyQuestion::factory()->kind($kind)->create([
        'team_survey_id' => $survey->id,
        'position' => (int) TeamSurveyQuestion::query()->where('team_survey_id', $survey->id)->max('position') + 1,
        ...$attributes,
    ]);

    foreach ($options as $position => $label) {
        TeamSurveyOption::factory()->create(['team_survey_question_id' => $question->id, 'label' => $label, 'position' => $position]);
    }

    return $question;
}

/**
 * @param  int|string|array<int, int>  $answer  a value (scale, NPS), a text, or option indexes (choices)
 */
function answerSurveyQuestion(TeamSurveyQuestion $question, TeamSurveyRespondent $respondent, int|string|array $answer, ?string $comment = null): TeamSurveyAnswer
{
    $row = TeamSurveyAnswer::factory()->create([
        'team_survey_question_id' => $question->id,
        'team_survey_respondent_id' => $respondent->id,
        'value' => is_int($answer) ? $answer : null,
        'text' => is_string($answer) ? $answer : null,
        'comment' => $comment,
    ]);

    if (is_array($answer)) {
        $options = $question->options()->get()->values();
        $row->options()->attach(array_map(fn (int $index): string => $options[$index]->id, $answer));
    }

    return $row;
}

/**
 * A rectangle as Excalidraw sends it.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function sceneElement(array $overrides = []): array
{
    return [
        'id' => Str::random(20),
        'type' => 'rectangle',
        'x' => 10,
        'y' => 20,
        'width' => 100,
        'height' => 50,
        'angle' => 0,
        'strokeColor' => '#1e1e1e',
        'backgroundColor' => 'transparent',
        'fillStyle' => 'solid',
        'strokeWidth' => 2,
        'strokeStyle' => 'solid',
        'roughness' => 1,
        'opacity' => 100,
        'groupIds' => [],
        'frameId' => null,
        'index' => 'a0',
        'roundness' => null,
        'seed' => 1,
        'version' => 1,
        'versionNonce' => 100,
        'isDeleted' => false,
        'boundElements' => null,
        'updated' => 1,
        'link' => null,
        'locked' => false,
        ...$overrides,
    ];
}

/**
 * @param  array<int, mixed>  $elements
 */
function putWhiteboardElements(mixed $test, Whiteboard $board, array $elements): TestResponse
{
    return $test->putJson(route('whiteboards.elements.update', $board), ['elements' => $elements]);
}

/*
|--------------------------------------------------------------------------
| Lane H: the health checks of before plan 19
|--------------------------------------------------------------------------
*/

/**
 * Rows of the tables the health check lived in before plan 19, written
 * without the models, which Task 29 deletes.
 *
 * @param  array<int, array{key: string, builtin?: ?string, text?: ?string, label?: ?string}>  $statements
 */
function oldHealthStatements(Retro $retro, array $statements): void
{
    foreach (array_values($statements) as $position => $statement) {
        DB::table('retro_health_statements')->insert([
            'id' => (string) Str::uuid7(),
            'retro_id' => $retro->id,
            'key' => $statement['key'],
            'team_health_statement_id' => null,
            'builtin' => $statement['builtin'] ?? null,
            'text' => $statement['text'] ?? null,
            'label' => $statement['label'] ?? null,
            'position' => $position,
            'created_at' => '2026-08-01 09:00:00',
            'updated_at' => '2026-08-01 09:00:00',
        ]);
    }
}

function oldHealthAnswer(Retro $retro, Participant $participant, string $statement, int $score, string $at = '2026-09-01 10:00:00'): void
{
    DB::table('health_check_answers')->insert([
        'id' => (string) Str::uuid7(),
        'retro_id' => $retro->id,
        'participant_id' => $participant->id,
        'statement' => $statement,
        'score' => $score,
        'created_at' => $at,
        'updated_at' => $at,
    ]);
}

/**
 * Changes only `health_check_enabled` and `phase`, never a source column of
 * the retro's derived search columns (docs/database.md, rule 9).
 */
function oldHealthFlag(Retro $retro, bool $enabled, ?string $phase = null): void
{
    DB::table('retros')->where('id', $retro->id)->update(array_filter([
        'health_check_enabled' => $enabled,
        'phase' => $phase,
    ], fn (mixed $value): bool => $value !== null));
}

/**
 * One team with the situations of spec §14. Scores are chosen so that every
 * expected value of Tasks 14 and 16 can be checked by hand. The retro left in
 * the `health_check` phase is never reloaded through Eloquent.
 *
 * @return array<string, mixed>
 */
function healthHistory(): array
{
    $team = Team::factory()->create();
    $custom = (string) Str::uuid7();
    $builtIns = [
        ['key' => 'interaction', 'builtin' => 'interaction'],
        ['key' => 'vision', 'builtin' => 'vision'],
    ];

    $sprint40 = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 40', 'completed_at' => '2026-08-10 10:00:00']);
    oldHealthFlag($sprint40, true);
    oldHealthStatements($sprint40, $builtIns);
    [$alice, $aliceIn40] = retroFacilitator($sprint40);
    oldHealthAnswer($sprint40, $aliceIn40, 'interaction', 5, '2026-08-10 09:00:00');
    oldHealthAnswer($sprint40, $aliceIn40, 'vision', 5, '2026-08-10 09:01:00');

    $sprint41 = Retro::factory()->for($team)->anonymous()->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 41', 'completed_at' => '2026-09-10 10:00:00']);
    oldHealthFlag($sprint41, true);
    oldHealthStatements($sprint41, [...$builtIns, ['key' => $custom, 'text' => 'We ship without fear', 'label' => 'Shipping']]);
    $aliceIn41 = Participant::factory()->create(['retro_id' => $sprint41->id, 'user_id' => $alice->id]);
    $sprint41->forceFill(['facilitator_participant_id' => $aliceIn41->id])->save();
    $guest = Participant::factory()->guest()->create(['retro_id' => $sprint41->id, 'guest_name' => 'Gus']);
    $former = Participant::factory()->create(['retro_id' => $sprint41->id]);
    DB::table('participants')->where('id', $former->id)->update(['user_id' => null]);
    oldHealthAnswer($sprint41, $aliceIn41, 'interaction', 8, '2026-09-10 09:00:00');
    oldHealthAnswer($sprint41, $aliceIn41, 'vision', 6, '2026-09-10 09:01:00');
    oldHealthAnswer($sprint41, $aliceIn41, $custom, 4, '2026-09-10 09:02:00');
    oldHealthAnswer($sprint41, $aliceIn41, 'motivation', 9, '2026-09-10 09:03:00');
    oldHealthAnswer($sprint41, $guest, 'interaction', 6, '2026-09-10 09:04:00');
    oldHealthAnswer($sprint41, $guest, 'vision', 10, '2026-09-10 09:05:00');
    oldHealthAnswer($sprint41, $former, 'interaction', 7, '2026-09-10 09:06:00');

    $inHealthPhase = Retro::factory()->for($team)->create(['title' => 'Sprint 42']);
    oldHealthStatements($inHealthPhase, $builtIns);
    [, $bobIn42] = retroMember($inHealthPhase);
    oldHealthAnswer($inHealthPhase, $bobIn42, 'interaction', 3, '2026-10-01 09:00:00');
    oldHealthFlag($inHealthPhase, true, 'health_check');

    $completedUnanswered = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Unanswered', 'completed_at' => '2026-07-10 10:00:00']);
    oldHealthFlag($completedUnanswered, true);
    oldHealthStatements($completedUnanswered, $builtIns);

    $turnedOff = Retro::factory()->for($team)->create(['title' => 'Turned off']);
    oldHealthFlag($turnedOff, false);
    oldHealthStatements($turnedOff, $builtIns);
    [, $carolInTurnedOff] = retroMember($turnedOff);
    oldHealthAnswer($turnedOff, $carolInTurnedOff, 'vision', 2);

    $openUnanswered = Retro::factory()->for($team)->create(['title' => 'Open, unanswered']);
    oldHealthFlag($openUnanswered, true);
    oldHealthStatements($openUnanswered, $builtIns);

    $never = Retro::factory()->for($team)->create(['title' => 'Never had one']);

    return compact('team', 'custom', 'sprint40', 'sprint41', 'inHealthPhase', 'completedUnanswered', 'turnedOff', 'openUnanswered', 'never', 'alice', 'aliceIn41', 'guest', 'former', 'bobIn42');
}

function importedSurvey(string $retroId): ?object
{
    return DB::table('team_surveys')->where('retro_id', $retroId)->where('template', 'health_check')->first();
}

/*
|--------------------------------------------------------------------------
| Lane H: the retro's health check as a team survey
|--------------------------------------------------------------------------
*/

function attachHealthCheck(Retro $retro): TeamSurvey
{
    return resolve(AttachHealthCheck::class)->handle($retro);
}

/**
 * Sends the scores of one participant, as "Submit answers" does. A fixture
 * that reproduces an old health check passes the scale of ten: the
 * questions take it while nobody has answered them.
 *
 * @param  array<string, int>  $scores  statement key => score, as given
 */
function answerHealthCheck(Retro $retro, Participant $participant, array $scores, int $scaleMax = HealthScale::Max): void
{
    $survey = resolve(HealthCheckSurvey::class)->forRetro($retro) ?? attachHealthCheck($retro);

    if (! $survey->hasAnswers()) {
        $survey->questions()->update(['scale_max' => $scaleMax]);
    }

    $respondent = resolve(RespondentForParticipant::class)->handle($survey, $participant);
    $questions = $survey->questions()->get()->keyBy('match_key');

    foreach ($scores as $key => $score) {
        answerSurveyQuestion($questions[$key], $respondent, $score);
    }

    $respondent->update(['completed_at' => now()]);
}

/**
 * Closes the health check of a retro at the retro's completion time, as
 * completing the retro does.
 */
function closeHealthCheck(Retro $retro): TeamSurvey
{
    $survey = resolve(HealthCheckSurvey::class)->forRetro($retro);
    $survey->update(['status' => TeamSurveyStatus::Closed, 'closed_at' => $retro->completed_at ?? now()]);

    return $survey;
}
