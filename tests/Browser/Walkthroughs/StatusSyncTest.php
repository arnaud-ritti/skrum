<?php

use App\Enums\ExternalIssueState;
use App\Enums\ExternalStatusCategory;
use App\Enums\InboundEventStatus;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationInboundEvent;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use Carbon\CarbonInterface;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\Browser\Support\InteractsWithIntegrations;

pest()->use(InteractsWithIntegrations::class);

const StatusSyncWebhookToken = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd';

const StatusSyncWebhookSecret = 'dc-webhook-secret';

function statusSyncEnable(IntegrationProvider ...$providers): void
{
    disableIntegrations();
    enableIntegrations(...$providers);

    config([
        'queue.default' => 'database',
        'services.integrations.inbound_webhooks' => 'on',
        'services.integrations.poll_minutes' => 5,
        'services.linear.webhook_secret' => 'linear-webhook-secret',
        'services.github_app.webhook_secret' => 'github-webhook-secret',
    ]);

    Http::preventStrayRequests();
}

function statusSyncTurnSyncOn(TeamIntegration $integration, IntegrationInboundMode $mode = IntegrationInboundMode::Webhook): TeamIntegration
{
    $listens = $mode === IntegrationInboundMode::Webhook;
    $registration = match ($integration->provider) {
        IntegrationProvider::Jira => ['webhookIds' => ['7001'], 'webhookProjects' => ['PROJ']],
        IntegrationProvider::JiraDataCenter => ['webhookIds' => ['12'], 'webhookProjects' => ['OPS']],
        default => [],
    };

    $integration->forceFill([
        'settings' => [
            ...$integration->settings,
            'statusSync' => true,
            'statusSyncSince' => now()->toIso8601String(),
            ...($listens ? $registration : []),
        ],
        'credentials' => [
            ...(array) $integration->readableCredentials(),
            'webhookToken' => StatusSyncWebhookToken,
            'webhookSecret' => StatusSyncWebhookSecret,
        ],
        'inbound_mode' => $mode,
        'webhook_status' => $listens ? IntegrationWebhookStatus::Active : null,
        'webhook_expires_at' => $listens && $integration->provider === IntegrationProvider::Jira ? now()->addDays(20) : null,
        'last_polled_at' => now(),
        'poll_cursor' => now(),
    ])->save();

    return $integration;
}

/**
 * @return array<string, mixed>
 */
function statusSyncLinkAttributes(IntegrationProvider $provider): array
{
    return match ($provider) {
        IntegrationProvider::Linear => [
            'source' => IntegrationProvider::Linear,
            'external_site' => 'org-1',
            'external_id' => 'lin-1',
            'external_key' => 'ENG-1',
            'external_url' => 'https://linear.app/acme/issue/ENG-1',
        ],
        IntegrationProvider::JiraDataCenter => [
            'source' => IntegrationProvider::JiraDataCenter,
            'external_site' => JiraDataCenterServer::key(TeamIntegrationFactory::JiraDataCenterUrl),
            'external_id' => '10001',
            'external_key' => 'OPS-1',
            'external_url' => 'https://jira.example.com/browse/OPS-1',
        ],
        IntegrationProvider::GitHub => [
            'source' => IntegrationProvider::GitHub,
            'external_site' => TeamIntegrationFactory::GitHubInstallationId,
            'external_id' => '9001/3',
            'external_key' => 'acme/api#3',
            'external_url' => 'https://github.com/acme/api/issues/3',
        ],
        default => [
            'source' => IntegrationProvider::Jira,
            'external_site' => 'cloud-1',
            'external_id' => '10001',
            'external_key' => 'PROJ-1',
            'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
        ],
    };
}

/**
 * @param  array<string, mixed>  $itemAttributes
 * @param  array<string, mixed>  $linkAttributes
 * @return array{
 *     retro: Retro,
 *     ada: User,
 *     integration: TeamIntegration,
 *     item: ActionItem,
 *     link: ActionItemExternalLink
 * }
 */
function statusSyncSyncedItem(
    IntegrationProvider $provider,
    array $itemAttributes = [],
    array $linkAttributes = [],
    ?IntegrationInboundMode $mode = IntegrationInboundMode::Webhook,
): array {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 12']);
    [$ada, $participant] = retroFacilitator($retro);

    $ada->forceFill(['name' => 'Ada Admin', 'locale' => 'en'])->save();
    $retro->team->workspace->members()->updateExistingPivot($ada->id, ['role' => WorkspaceRole::Admin->value]);

    $factory = TeamIntegration::factory();
    $integration = (match ($provider) {
        IntegrationProvider::Linear => $factory->linear(),
        IntegrationProvider::JiraDataCenter => $factory->jiraDataCenter(IntegrationAccess::Write, 'pat'),
        IntegrationProvider::GitHub => $factory->gitHub(),
        default => $factory->jira(),
    })->create(['team_id' => $retro->team_id]);

    if ($mode !== null) {
        statusSyncTurnSyncOn($integration, $mode);
    }

    $item = ActionItem::factory()->started()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $participant->id,
        'content' => 'Speed up CI',
        ...$itemAttributes,
    ]);

    $link = ActionItemExternalLink::factory()->create([
        'action_item_id' => $item->id,
        ...statusSyncLinkAttributes($provider),
    ]);

    $link->forceFill($linkAttributes)->save();

    return [
        'retro' => $retro,
        'ada' => $ada,
        'integration' => $integration,
        'item' => $item,
        'link' => $link,
    ];
}

/**
 * @param  array<string, mixed>  $taskAttributes
 * @return array{
 *     game: PokerGame,
 *     ada: User,
 *     integration: TeamIntegration,
 *     task: PokerTask
 * }
 */
function statusSyncPokerTask(array $taskAttributes = []): array
{
    $table = trackerTable(IntegrationProvider::Jira);

    $table['facilitator']->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();

    statusSyncTurnSyncOn($table['integration']);

    $task = importedPokerTask($table['game'], [
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
        'title' => 'Checkout flow',
        ...$taskAttributes,
    ]);

    openPokerRound($table['game'], $task);

    return [
        'game' => $table['game'],
        'ada' => $table['facilitator'],
        'integration' => $table['integration'],
        'task' => $task,
    ];
}

function statusSyncIntegrationsPath(Retro $retro): string
{
    return route('teams.integrations.index', [$retro->team->workspace, $retro->team], false);
}

function statusSyncCardSays(ActionItem $item, string $text): string
{
    return "document.querySelector('#action-item-{$item->id}').textContent.includes(".json_encode($text).')';
}

function statusSyncSentCount(string $method, string $urlFragment): int
{
    return Http::recorded(fn (Request $request): bool => $request->method() === $method && str_contains($request->url(), $urlFragment))->count();
}

/**
 * @return array<string, mixed>
 */
function statusSyncJiraFields(string $status = 'new', ?CarbonInterface $updatedAt = null): array
{
    return [
        'status' => match ($status) {
            'done' => ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
            'closed' => ['id' => '10005', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']],
            'indeterminate' => ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']],
            default => ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
        },
        'project' => ['key' => 'PROJ'],
        'updated' => ($updatedAt ?? now())->toIso8601String(),
    ];
}

/**
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function statusSyncJiraIssue(string $status = 'new', ?CarbonInterface $updatedAt = null, array $fields = []): array
{
    return jiraTrackerIssue('10001', 'PROJ-1', [...statusSyncJiraFields($status, $updatedAt), ...$fields]);
}

/**
 * @return array<string, mixed>
 */
function statusSyncJiraDataCenterIssue(string $status = 'new'): array
{
    return jiraTrackerIssue('10001', 'OPS-1', [
        ...statusSyncJiraFields($status),
        'description' => null,
        'project' => ['key' => 'OPS'],
    ]);
}

/**
 * @return array<string, mixed>
 */
function statusSyncLinearIssue(string $type): array
{
    $name = match ($type) {
        'completed' => 'Done',
        'canceled' => 'Canceled',
        default => 'Todo',
    };

    return linearTrackerIssue('lin-1', 'ENG-1', [
        'state' => ['id' => "st-{$type}", 'name' => $name, 'type' => $type],
        'team' => ['key' => 'ENG'],
        'updatedAt' => now()->toIso8601String(),
    ]);
}

/**
 * @return array<int, array{id: string, name: string}>
 */
function statusSyncJiraPriorities(): array
{
    return [
        ['id' => '2', 'name' => 'High'],
        ['id' => '3', 'name' => 'Medium'],
    ];
}

/**
 * @param  array<string, string>  $headers
 */
function statusSyncPostWebhook(string $url, string $body, array $headers = []): TestResponse
{
    $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];

    foreach ($headers as $name => $value) {
        $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
    }

    return test()->call('POST', $url, [], [], [], $server, $body);
}

function statusSyncJiraEvent(
    TeamIntegration $integration,
    string $delivery,
    string $source = 'jira',
    string $token = StatusSyncWebhookToken,
    ?string $secret = null,
): TestResponse {
    $body = json_encode(['webhookEvent' => 'jira:issue_updated', 'issue' => ['id' => '10001']], JSON_THROW_ON_ERROR);
    $url = route('integrations.webhooks.tracker.store', ['source' => $source, 'integration' => $integration->id, 'token' => $token], false);
    $headers = ['X-Atlassian-Webhook-Identifier' => $delivery];

    if ($secret !== null) {
        $headers['X-Hub-Signature'] = 'sha256='.hash_hmac('sha256', $body, $secret);
    }

    return statusSyncPostWebhook($url, $body, $headers);
}

function statusSyncLinearEvent(string $delivery): TestResponse
{
    $body = json_encode([
        'action' => 'update',
        'type' => 'Issue',
        'organizationId' => 'org-1',
        'data' => ['id' => 'lin-1'],
        'webhookTimestamp' => now()->getTimestampMs(),
    ], JSON_THROW_ON_ERROR);

    return statusSyncPostWebhook(route('integrations.webhooks.store', ['source' => 'linear'], false), $body, [
        'Linear-Delivery' => $delivery,
        'Linear-Signature' => hash_hmac('sha256', $body, 'linear-webhook-secret'),
    ]);
}

/**
 * @param  array<string, mixed>  $payload
 */
function statusSyncGitHubEvent(string $event, array $payload, string $delivery, string $secret = 'github-webhook-secret'): TestResponse
{
    $body = json_encode(['installation' => ['id' => 4242], ...$payload], JSON_THROW_ON_ERROR);

    return statusSyncPostWebhook(route('integrations.webhooks.store', ['source' => 'github'], false), $body, [
        'X-GitHub-Event' => $event,
        'X-GitHub-Delivery' => $delivery,
        'X-Hub-Signature-256' => 'sha256='.hash_hmac('sha256', $body, $secret),
    ]);
}

it('turns status sync on for Jira after a confirmation and shows the webhook becoming live', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = statusSyncSyncedItem(IntegrationProvider::Jira, mode: null);
    $integration->forceFill(['credentials' => [...(array) $integration->readableCredentials(), 'webhookToken' => StatusSyncWebhookToken]])->save();
    Http::fake([
        jiraApiUrl('rest/api/3/webhook') => Http::response(['webhookRegistrationResult' => [['createdWebhookId' => 7001]]]),
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [statusSyncJiraIssue()], 'isLast' => true]),
        jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => statusSyncJiraPriorities()]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $path = statusSyncIntegrationsPath($retro);
    $switch = 'label:has-text("Sync status") button[role="switch"]';

    $page = $this->signIn($ada, $path);

    $this->openIntegration($page, 'jira')
        ->assertSee('Status sync')
        ->assertAttribute($switch, 'aria-checked', 'false')
        ->click($switch)
        ->assertSee('Turn on status sync with Jira?')
        ->assertSee('The first sync takes the state of every linked Jira issue: existing action items may be completed or reopened to match. After that, the most recent change wins.')
        ->click("{$this->dialogOverPanel()} button:has-text(\"Turn on status sync\")")
        ->assertSee('Status sync is on.')
        ->assertAttribute($switch, 'aria-checked', 'true')
        ->assertSee('Checking every 5 minutes.');

    $this->workDueJobs();

    $page->navigate($path);

    $this->openIntegration($page, 'jira')
        ->assertSee('Setting up live updates…')
        ->assertSee('Last sync:');

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/webhook')
        && str_contains((string) $request['url'], "/integrations/webhooks/jira/{$integration->id}/".StatusSyncWebhookToken)
        && $request['webhooks'] === [['events' => ['jira:issue_updated', 'jira:issue_deleted'], 'jqlFilter' => 'project in ("PROJ")']]);

    statusSyncJiraEvent($integration, 'delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->navigate($path);

    $this->openIntegration($page, 'jira')
        ->assertSee('Live updates (webhooks)');

    expect($integration->fresh()->setting('statusSync'))->toBeTrue()
        ->and($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Active)
        ->and($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Webhook);
});

it('asks to reconnect a Jira connection made without the webhook scope and keeps polling', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = statusSyncSyncedItem(IntegrationProvider::Jira, mode: IntegrationInboundMode::Polling);
    $integration->forceFill(['scopes' => ['offline_access', 'read:jira-work', 'write:jira-work']])->save();
    Http::fake([
        jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => statusSyncJiraPriorities()]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);

    $page = $this->signIn($ada, statusSyncIntegrationsPath($retro));

    $this->openIntegration($page, 'jira')
        ->assertSee('Status sync')
        ->assertAttribute('label:has-text("Sync status") button[role="switch"]', 'aria-checked', 'true')
        ->assertSee('Reconnect Jira to receive live updates.')
        ->assertSee('Checking every 5 minutes.')
        ->assertVisible('a:has-text("Reconnect")')
        ->assertDontSee('Live updates (webhooks)');
});

it('completes the action item on the open board when its issue is closed in Jira', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = statusSyncSyncedItem(IntegrationProvider::Jira);
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [statusSyncJiraIssue('done')], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertSeeIn($card, 'PROJ-1');

    statusSyncJiraEvent($integration, 'delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(statusSyncCardSays($item, 'Done in Jira'), true);

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn($card, 'Completed in Jira');

    expect($item->fresh()->completed_at)->not->toBeNull()
        ->and($item->fresh()->completed_via_source)->toBe('jira')
        ->and(statusSyncSentCount('POST', '/transitions'))->toBe(0);
});

it('moves the Jira issue to Done when the action item is completed on the board', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item, 'link' => $link] = statusSyncSyncedItem(IntegrationProvider::Jira);
    fakeJiraTransitions(statusSyncJiraFields('new'), statusSyncJiraFields('done'), [
        jiraTransition('11', '3', 'In Progress', 'indeterminate'),
        jiraTransition('21', '10005', 'Closed', 'done'),
        jiraTransition('31', '10002', 'Done', 'done'),
    ]);
    Http::fake(['api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(statusSyncCardSays($item, 'Sync pending'), true);

    $this->workDueJobs();

    $page->assertScript(statusSyncCardSays($item, 'Done in Jira'), true);

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001/transitions')
        && $request->data() === ['transition' => ['id' => '31']]);

    expect(statusSyncSentCount('POST', '/transitions'))->toBe(1)
        ->and($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Done)
        ->and($link->fresh()->sync_error)->toBeNull();
});

it('fills the resolution that the Jira transition requires', function (array $allowedValues, string $expected) {
    statusSyncEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item] = statusSyncSyncedItem(IntegrationProvider::Jira);
    fakeJiraTransitions(statusSyncJiraFields('new'), statusSyncJiraFields('done'), [
        jiraTransition('31', '10002', 'Done', 'done', [
            'resolution' => ['required' => true, 'hasDefaultValue' => false, 'allowedValues' => $allowedValues],
        ]),
    ]);
    Http::fake(['api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]");

    $this->workDueJobs();

    $page->assertScript(statusSyncCardSays($item, 'Done in Jira'), true);

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001/transitions')
        && $request->data() === ['transition' => ['id' => '31'], 'fields' => ['resolution' => ['name' => $expected]]]);
})->with([
    'Done when Jira offers it' => [[['name' => "Won't Do"], ['name' => 'Fixed'], ['name' => 'Done']], 'Done'],
    'Fixed otherwise' => [[['name' => "Won't Do"], ['name' => 'Fixed']], 'Fixed'],
]);

it('moves the Jira issue back to an open status when the action item is reopened on the board', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item, 'link' => $link] = statusSyncSyncedItem(
        IntegrationProvider::Jira,
        ['completed_at' => now()->subHour()],
        [
            'external_state' => ExternalIssueState::Done,
            'external_status_name' => 'Done',
            'last_pushed_state' => ExternalIssueState::Done,
            'last_pushed_at' => now()->subHour(),
        ],
    );
    fakeJiraTransitions(statusSyncJiraFields('done'), statusSyncJiraFields('new'), [
        jiraTransition('41', '3', 'In Progress', 'indeterminate'),
        jiraTransition('51', '10000', 'To Do', 'new'),
    ]);
    Http::fake(['api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(statusSyncCardSays($item, 'Done in Jira'), true)
        ->click("{$card} [aria-label=\"Reopen\"]")
        ->assertPresent("{$card} [aria-label=\"Mark as in progress\"]");

    $this->workDueJobs();

    $page->assertScript(statusSyncCardSays($item, 'To Do in Jira'), true);

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001/transitions')
        && $request->data() === ['transition' => ['id' => '51']]);

    expect($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Open);
});

it('reopens the action item on the open board when its issue is reopened in Jira', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = statusSyncSyncedItem(
        IntegrationProvider::Jira,
        ['completed_at' => now()->subHour()],
        ['external_state' => ExternalIssueState::Done, 'external_status_name' => 'Done'],
    );
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [statusSyncJiraIssue('new')], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]");

    statusSyncJiraEvent($integration, 'delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->assertPresent("{$card} [aria-label=\"Mark as in progress\"]")
        ->assertScript(statusSyncCardSays($item, 'To Do in Jira'), true);

    expect($item->fresh()->completed_at)->toBeNull()
        ->and(statusSyncSentCount('POST', '/transitions'))->toBe(0);
});

it('lets the Jira change win when it is the more recent of two opposite changes in the same minute', function () {
    $this->travelTo(now()->startOfMinute()->addSeconds(40));
    statusSyncEnable(IntegrationProvider::Jira);
    $reopenedAt = now()->toImmutable()->startOfMinute()->addSeconds(10);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = statusSyncSyncedItem(
        IntegrationProvider::Jira,
        [],
        [
            'local_state_changed_at' => $reopenedAt,
            'last_pushed_at' => $reopenedAt->subHour(),
            'last_pushed_state' => ExternalIssueState::Done,
            'external_state' => ExternalIssueState::Done,
            'external_status_name' => 'Done',
            'external_updated_at' => $reopenedAt->subHour(),
        ],
    );
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [statusSyncJiraIssue('done', $reopenedAt->addSeconds(20))], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertScript(statusSyncCardSays($item, 'Sync pending'), true);

    statusSyncJiraEvent($integration, 'delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]");

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn($card, 'Completed in Jira');

    expect($item->fresh()->completed_via_source)->toBe('jira')
        ->and(statusSyncSentCount('POST', '/transitions'))->toBe(0);
});

it('gives a tie to skrum, pushes its state once and does not loop on the echo', function () {
    $this->travelTo(now()->startOfMinute()->addSeconds(40));
    statusSyncEnable(IntegrationProvider::Jira);
    $completedAt = now()->toImmutable()->startOfMinute()->addSeconds(10);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncSyncedItem(
        IntegrationProvider::Jira,
        ['completed_at' => $completedAt],
        [
            'local_state_changed_at' => $completedAt,
            'external_state' => ExternalIssueState::Open,
            'external_status_name' => 'To Do',
        ],
    );
    fakeJiraTransitions(statusSyncJiraFields('new', $completedAt), statusSyncJiraFields('done', $completedAt->addSeconds(5)), [
        jiraTransition('31', '10002', 'Done', 'done'),
    ]);
    Http::fake(['api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(statusSyncCardSays($item, 'Sync pending'), true);

    statusSyncJiraEvent($integration, 'delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->assertScript(statusSyncCardSays($item, 'Done in Jira'), true)
        ->assertPresent("{$card} [aria-label=\"Reopen\"]");

    $readsBeforeEcho = statusSyncSentCount('POST', '/rest/api/3/search/jql');

    statusSyncJiraEvent($integration, 'delivery-2')->assertAccepted();

    expect($this->dueJobs())->toBe(1)
        ->and(IntegrationInboundEvent::query()->where('team_integration_id', $integration->id)->count())->toBe(2);

    $this->workQueue();

    expect($this->dueJobs())->toBe(0)
        ->and(DB::table('jobs')->count())->toBe(0)
        ->and(statusSyncSentCount('POST', '/rest/api/3/search/jql'))->toBe($readsBeforeEcho + 1);

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(statusSyncCardSays($item, 'Done in Jira'), true);

    expect(statusSyncSentCount('POST', '/transitions'))->toBe(1)
        ->and($item->fresh()->completed_at)->not->toBeNull()
        ->and($item->fresh()->completed_via_source)->toBeNull()
        ->and($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Done)
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Done);
});

it('maps a custom done status and reopen target for a Jira project and uses them for pushes', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = statusSyncSyncedItem(IntegrationProvider::Jira);
    $status = 'indeterminate';
    Http::fake([
        jiraApiUrl('rest/api/3/project/PROJ/statuses') => Http::response([
            ['id' => '1', 'name' => 'Task', 'statuses' => [
                ['id' => '10006', 'name' => 'Backlog', 'statusCategory' => ['key' => 'new']],
                ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
                ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']],
                ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
                ['id' => '10005', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']],
            ]],
        ]),
        jiraApiUrl('rest/api/3/search/jql') => function () use (&$status) {
            return Http::response(['issues' => [statusSyncJiraIssue($status)], 'isLast' => true]);
        },
        jiraApiUrl('rest/api/3/issue/10001?*') => function () use (&$status) {
            return Http::response(statusSyncJiraIssue($status));
        },
        jiraApiUrl('rest/api/3/issue/10001/transitions*') => function (Request $request) use (&$status) {
            if ($request->method() !== 'POST') {
                return Http::response(['transitions' => [
                    jiraTransition('31', '10002', 'Done', 'done'),
                    jiraTransition('21', '10005', 'Closed', 'done'),
                    jiraTransition('61', '10006', 'Backlog', 'new'),
                    jiraTransition('51', '10000', 'To Do', 'new'),
                    jiraTransition('41', '3', 'In Progress', 'indeterminate'),
                ]]);
            }

            $status = $request['transition']['id'] === '21' ? 'closed' : 'new';

            return Http::response(null, 204);
        },
        jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => statusSyncJiraPriorities()]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->signIn($ada, statusSyncIntegrationsPath($retro));

    $this->openIntegration($page, 'jira')
        ->assertSee('Status mapping')
        ->assertSee('Edit mapping')
        ->click('Edit mapping')
        ->assertSee('Counts as done')
        ->assertVisible('[aria-label="Complete to"]')
        ->click('[aria-label="Complete to"]')
        ->click('[role="option"]:has-text("Closed")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('[aria-label="Complete to"]', 'Closed')
        ->assertEnabled('[aria-label="Reopen to"]')
        ->click('[aria-label="Reopen to"]')
        ->click('[role="option"]:has-text("To Do")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('[aria-label="Reopen to"]', 'To Do');

    $this->workDueJobs();

    expect($integration->fresh()->setting('statusMapping.projects.PROJ'))->toBe([
        'doneStatusIds' => null,
        'startStatusId' => null,
        'completeStatusId' => '10005',
        'reopenStatusId' => '10000',
    ]);

    $page->navigate("/retros/{$retro->id}");
    $this->awaitRealtime($page);

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]");

    $this->workDueJobs();

    $page->assertPresent("{$card}:has-text(\"Closed in Jira\")");

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001/transitions')
        && $request->data() === ['transition' => ['id' => '21']]);

    $page->click("{$card} [aria-label=\"Reopen\"]")
        ->assertPresent("{$card} [aria-label=\"Mark as in progress\"]");

    $this->workDueJobs();

    $page->assertPresent("{$card}:has-text(\"To Do in Jira\")");

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001/transitions')
        && $request->data() === ['transition' => ['id' => '51']]);

    expect(statusSyncSentCount('POST', '/transitions'))->toBe(2)
        ->and($item->externalLinks()->sole()->external_status_name)->toBe('To Do');
});

it('moves the Linear issue to its first completed state when the action item is completed on the board', function () {
    statusSyncEnable(IntegrationProvider::Linear);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item] = statusSyncSyncedItem(IntegrationProvider::Linear);
    $type = 'unstarted';
    fakeLinearGraphql([
        'issueUpdate' => function () use (&$type): array {
            $type = 'completed';

            return ['issueUpdate' => ['success' => true]];
        },
        'states(first' => ['issue' => ['team' => ['states' => ['nodes' => [
            ['id' => 'st-shipped', 'name' => 'Shipped', 'type' => 'completed', 'position' => 5],
            ['id' => 'st-completed', 'name' => 'Done', 'type' => 'completed', 'position' => 2],
            ['id' => 'st-unstarted', 'name' => 'Todo', 'type' => 'unstarted', 'position' => 1],
        ]]]]],
        'issues(' => function () use (&$type): array {
            return ['issues' => ['nodes' => [statusSyncLinearIssue($type)]]];
        },
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertSeeIn($card, 'ENG-1')
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]");

    $this->workDueJobs();

    $page->assertScript(statusSyncCardSays($item, 'Done in Linear'), true);

    Http::assertSent(fn (Request $request) => str_contains((string) $request['query'], 'issueUpdate')
        && (array) $request['variables'] === ['id' => 'lin-1', 'stateId' => 'st-completed']);
});

it('completes the action item when its Linear issue is canceled and canceled counts as done', function () {
    statusSyncEnable(IntegrationProvider::Linear);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item] = statusSyncSyncedItem(IntegrationProvider::Linear);
    fakeLinearGraphql([
        'issues(' => ['issues' => ['nodes' => [statusSyncLinearIssue('canceled')]]],
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]");

    statusSyncLinearEvent('linear-delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(statusSyncCardSays($item, 'Canceled in Linear'), true);

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn($card, 'Completed in Linear');

    expect($item->fresh()->completed_via_source)->toBe('linear');
});

it('leaves the action item open when its Linear issue is canceled and "Treat canceled as done" is off', function () {
    statusSyncEnable(IntegrationProvider::Linear);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = statusSyncSyncedItem(IntegrationProvider::Linear, ['started_at' => null]);
    fakeLinearGraphql([
        'issues(' => ['issues' => ['nodes' => [statusSyncLinearIssue('canceled')]]],
    ]);
    $treatCanceled = 'label:has-text("Treat canceled as done") button[role="switch"]';
    $card = "#action-item-{$item->id}";

    $page = $this->signIn($ada, statusSyncIntegrationsPath($retro));

    $this->openIntegration($page, 'linear')
        ->assertSee('Live updates (webhooks)')
        ->assertAttribute($treatCanceled, 'aria-checked', 'true')
        ->click($treatCanceled)
        ->assertSee('Status sync setting saved.')
        ->assertAttribute($treatCanceled, 'aria-checked', 'false');

    $this->workDueJobs();

    statusSyncLinearEvent('linear-delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->navigate("/retros/{$retro->id}")
        ->assertPresent("{$card} [aria-label=\"Mark as in progress\"]")
        ->assertScript(statusSyncCardSays($item, 'Canceled in Linear'), true)
        ->assertDontSee('Completed in Linear');

    expect($item->fresh()->completed_at)->toBeNull()
        ->and($integration->fresh()->setting('treatCanceledAsDone'))->toBeFalse();
});

it('closes the GitHub issue as completed and reopens it from the board', function () {
    statusSyncEnable(IntegrationProvider::GitHub);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item, 'link' => $link] = statusSyncSyncedItem(IntegrationProvider::GitHub);
    $state = ['state' => 'open', 'state_reason' => null];
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/3' => function () use (&$state) {
            return Http::response(gitHubIssue(3, $state));
        },
        'api.github.com/repos/acme/api/issues/3' => function (Request $request) use (&$state) {
            $state = ['state' => $request['state'], 'state_reason' => $request['state_reason'] ?? null];

            return Http::response(gitHubIssue(3, $state));
        },
    ]);
    Http::fake(['api.github.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertSeeIn($card, 'acme/api#3')
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(statusSyncCardSays($item, 'Sync pending'), true);

    $this->workDueJobs();

    $page->assertScript(statusSyncCardSays($item, 'in GitHub'), true);

    Http::assertSent(fn (Request $request) => $request->method() === 'PATCH'
        && $request->url() === 'https://api.github.com/repos/acme/api/issues/3'
        && $request->data() === ['state' => 'closed', 'state_reason' => 'completed']);

    expect($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Done);

    $page->click("{$card} [aria-label=\"Reopen\"]")
        ->assertPresent("{$card} [aria-label=\"Mark as in progress\"]");

    $this->workDueJobs();

    Http::assertSent(fn (Request $request) => $request->method() === 'PATCH'
        && $request->url() === 'https://api.github.com/repos/acme/api/issues/3'
        && $request->data() === ['state' => 'open']);

    expect($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Open)
        ->and(statusSyncSentCount('PATCH', '/repos/acme/api/issues/3'))->toBe(2);
});

it('completes the action item when its GitHub issue is closed as not planned', function () {
    statusSyncEnable(IntegrationProvider::GitHub);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item] = statusSyncSyncedItem(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues([3 => gitHubIssue(3, [
            'state' => 'closed',
            'state_reason' => 'not_planned',
            'updated_at' => now()->toIso8601String(),
        ])]),
    ]);
    Http::fake(['api.github.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]");

    statusSyncGitHubEvent('issues', [
        'action' => 'closed',
        'issue' => ['number' => 3],
        'repository' => ['id' => 9001, 'full_name' => 'acme/api'],
    ], 'github-delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]");

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn($card, 'Completed in GitHub');

    expect($item->fresh()->completed_via_source)->toBe('github')
        ->and(statusSyncSentCount('PATCH', '/repos/acme/api/issues/3'))->toBe(0);
});

it('registers the Jira Data Center webhook itself when the token belongs to a Jira administrator', function () {
    statusSyncEnable(IntegrationProvider::JiraDataCenter);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = statusSyncSyncedItem(IntegrationProvider::JiraDataCenter, mode: null);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/mypermissions*') => Http::response(['permissions' => ['ADMINISTER' => ['havePermission' => true]]]),
        jiraDataCenterUrl('rest/webhooks/1.0/webhook') => Http::response(['self' => 'https://jira.example.com/rest/webhooks/1.0/webhook/12'], 201),
        jiraDataCenterUrl('rest/api/2/search') => Http::response(['issues' => [statusSyncJiraDataCenterIssue()], 'total' => 1]),
        jiraDataCenterUrl('rest/api/2/priority') => Http::response(statusSyncJiraPriorities()),
        'jira.example.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $path = statusSyncIntegrationsPath($retro);
    $switch = 'label:has-text("Sync status") button[role="switch"]';

    $page = $this->signIn($ada, $path);

    $this->openIntegration($page, 'jira_dc')
        ->assertSee('Acting as Jane Doe in Jira')
        ->assertAttribute($switch, 'aria-checked', 'false')
        ->click($switch)
        ->assertSee('Turn on status sync with Jira Data Center?')
        ->click("{$this->dialogOverPanel()} button:has-text(\"Turn on status sync\")")
        ->assertSee('Status sync is on.')
        ->assertAttribute($switch, 'aria-checked', 'true');

    $this->workDueJobs();

    $page->navigate($path);

    $this->openIntegration($page, 'jira_dc')
        ->assertSee('Setting up live updates…')
        ->assertDontSee('Only a Jira administrator can register the webhook.')
        ->assertDontSee('Show webhook details');

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && $request->url() === 'https://jira.example.com/rest/webhooks/1.0/webhook'
        && $request['events'] === ['jira:issue_updated', 'jira:issue_deleted']
        && $request['filters'] === ['issue-related-events-section' => 'project in ("OPS")']
        && str_contains((string) $request['url'], "/integrations/webhooks/jira-dc/{$integration->id}/")
        && $request->hasHeader('Authorization', 'Bearer '.TeamIntegrationFactory::JiraDataCenterToken));

    expect($integration->fresh()->setting('webhookIds'))->toBe(['12'])
        ->and($integration->fresh()->setting('webhookManual'))->toBeFalse()
        ->and($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Pending);
});

it('shows the manual webhook panel to a non-administrator and goes live after "I\'ve registered it" and the first event', function () {
    statusSyncEnable(IntegrationProvider::JiraDataCenter);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = statusSyncSyncedItem(IntegrationProvider::JiraDataCenter, mode: null);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/mypermissions*') => Http::response(['permissions' => ['ADMINISTER' => ['havePermission' => false]]]),
        jiraDataCenterUrl('rest/api/2/search') => Http::response(['issues' => [statusSyncJiraDataCenterIssue()], 'total' => 1]),
        jiraDataCenterUrl('rest/api/2/priority') => Http::response(statusSyncJiraPriorities()),
        'jira.example.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $path = statusSyncIntegrationsPath($retro);
    $switch = 'label:has-text("Sync status") button[role="switch"]';

    $page = $this->signIn($ada, $path);

    $this->openIntegration($page, 'jira_dc')
        ->assertAttribute($switch, 'aria-checked', 'false')
        ->click($switch)
        ->click("{$this->dialogOverPanel()} button:has-text(\"Turn on status sync\")")
        ->assertSee('Status sync is on.')
        ->assertAttribute($switch, 'aria-checked', 'true');

    $this->workDueJobs();

    $page->navigate($path);

    $this->openIntegration($page, 'jira_dc')
        ->assertSee('Only a Jira administrator can register the webhook.')
        ->assertSee('Checking every 5 minutes.')
        ->assertSee('Show webhook details')
        ->click('Show webhook details')
        ->assertSee('Webhook URL');

    $integration->refresh();
    $token = (string) $integration->credential('webhookToken');
    $secret = (string) $integration->credential('webhookSecret');

    $page->assertSee("/integrations/webhooks/jira-dc/{$integration->id}/{$token}")
        ->assertSee('jira:issue_updated, jira:issue_deleted')
        ->assertSee('project in ("OPS")')
        ->assertSee($secret)
        ->assertPresent('[aria-label="Copy Webhook URL"]')
        ->click("I've registered it")
        ->assertSee('skrum now waits for the first event.')
        ->assertSee('Setting up live updates…')
        ->assertDontSee("I've registered it");

    statusSyncJiraEvent($integration, 'dc-delivery-1', 'jira-dc', $token, $secret)->assertAccepted();

    $this->workDueJobs();

    $page->navigate($path);

    $this->openIntegration($page, 'jira_dc')
        ->assertSee('Live updates (webhooks)')
        ->assertSee('Only a Jira administrator can register the webhook.');

    expect(statusSyncSentCount('POST', '/rest/webhooks/1.0/webhook'))->toBe(0)
        ->and($integration->fresh()->setting('webhookManual'))->toBeTrue()
        ->and($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Active);
});

it('shows the status of the Jira issue on its imported poker task as it changes in Jira', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['game' => $game, 'ada' => $ada, 'integration' => $integration, 'task' => $task] = statusSyncPokerTask();
    $status = 'indeterminate';
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => function () use (&$status) {
            return Http::response(['issues' => [statusSyncJiraIssue($status)], 'isLast' => true]);
        },
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Checkout flow')
        ->assertDontSee('In Progress in Jira');

    statusSyncJiraEvent($integration, 'delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->assertSee('In Progress in Jira')
        ->assertSee('Story PROJ-1')
        ->assertDontSee('Checkout flow');

    $status = 'done';

    statusSyncJiraEvent($integration, 'delivery-2')->assertAccepted();

    $this->workDueJobs();

    $page->assertSee('Done in Jira')
        ->assertPresent('[data-test="poker-task-row"] [aria-label="Done in Jira"]')
        ->assertDontSee('In Progress in Jira');

    expect($task->fresh()->external_status_category)->toBe(ExternalStatusCategory::Done)
        ->and($task->fresh()->title)->toBe('Story PROJ-1');
});

it('flags a story points change made in Jira and takes the Jira value when the facilitator chooses it', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['game' => $game, 'ada' => $ada, 'integration' => $integration, 'task' => $task] = statusSyncPokerTask([
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
        'external_estimate' => '5',
    ]);
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [statusSyncJiraIssue('new', null, ['customfield_10016' => 8])], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Estimate: 5')
        ->assertDontSee('Changed in Jira to 8');

    statusSyncJiraEvent($integration, 'delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->assertSee('Changed in Jira to 8')
        ->assertSee('Estimate: 5')
        ->assertSee('Keep skrum estimate')
        ->assertButtonEnabled('Use Jira estimate')
        ->click('Use Jira estimate')
        ->assertSee('Estimate: 8')
        ->assertDontSee('Changed in Jira to 8');

    expect($task->fresh()->estimate)->toBe('8')
        ->and(statusSyncSentCount('PUT', '/rest/api/3/issue/10001'))->toBe(0);
});

it('writes the skrum estimate back to Jira when the facilitator keeps it', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['game' => $game, 'ada' => $ada, 'integration' => $integration, 'task' => $task] = statusSyncPokerTask([
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
        'external_estimate' => '5',
    ]);
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [statusSyncJiraIssue('new', null, ['customfield_10016' => 8])], 'isLast' => true]),
        jiraApiUrl('rest/api/3/issue/*/editmeta') => Http::response(['fields' => ['customfield_10016' => ['name' => 'Story point estimate']]]),
        jiraApiUrl('rest/api/3/issue/*') => Http::response(null, 204),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Estimate: 5');

    statusSyncJiraEvent($integration, 'delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->assertSee('Changed in Jira to 8')
        ->click('Keep skrum estimate')
        ->assertSee('Sync pending')
        ->assertDontSee('Changed in Jira to 8');

    $this->workDueJobs();

    $page->assertSee('Synced to Jira')
        ->assertDontSee('Sync pending')
        ->assertSee('Estimate: 5')
        ->assertDontSee('Changed in Jira to 8');

    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001')
        && $request['fields']['customfield_10016'] == 5);

    expect($task->fresh()->estimate)->toBe('5');
});

it('cannot take a Jira value that is not a card of the deck', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['game' => $game, 'ada' => $ada, 'integration' => $integration, 'task' => $task] = statusSyncPokerTask([
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
        'external_estimate' => '5',
    ]);
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [statusSyncJiraIssue('new', null, ['customfield_10016' => 7])], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Estimate: 5');

    statusSyncJiraEvent($integration, 'delivery-1')->assertAccepted();

    $this->workDueJobs();

    $page->assertSee('Changed in Jira to 7')
        ->assertSee('7 is not in this deck.')
        ->assertButtonDisabled('Use Jira estimate')
        ->assertButtonEnabled('Keep skrum estimate');

    expect($task->fresh()->estimate)->toBe('5');
});

it('says it checks every 5 minutes and answers 404 to webhooks when inbound webhooks are off', function () {
    statusSyncEnable(IntegrationProvider::GitHub);
    config(['services.integrations.inbound_webhooks' => 'off']);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = statusSyncSyncedItem(IntegrationProvider::GitHub, mode: null);
    fakeGitHubTrackerApi();
    Http::fake(['api.github.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $switch = 'label:has-text("Sync status") button[role="switch"]';

    $page = $this->signIn($ada, statusSyncIntegrationsPath($retro));

    $this->openIntegration($page, 'github')
        ->assertAttribute($switch, 'aria-checked', 'false')
        ->click($switch)
        ->assertSee('Turn on status sync with GitHub?')
        ->click("{$this->dialogOverPanel()} button:has-text(\"Turn on status sync\")")
        ->assertSee('Status sync is on.')
        ->assertAttribute($switch, 'aria-checked', 'true')
        ->assertSee('Checking every 5 minutes.')
        ->assertSee('Treat canceled as done')
        ->assertDontSee('Live updates (webhooks)')
        ->assertDontSee('Setting up live updates…');

    $this->workDueJobs();

    statusSyncGitHubEvent('issues', [
        'action' => 'closed',
        'issue' => ['number' => 3],
        'repository' => ['id' => 9001, 'full_name' => 'acme/api'],
    ], 'github-delivery-1')->assertNotFound();

    expect($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Polling)
        ->and($integration->fresh()->webhook_status)->toBeNull();
});

it('completes the action item on the open board when the poll finds its Jira issue closed', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    config(['services.integrations.inbound_webhooks' => 'off']);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = statusSyncSyncedItem(IntegrationProvider::Jira, mode: IntegrationInboundMode::Polling);
    $integration->forceFill(['last_polled_at' => now()->subMinutes(6), 'poll_cursor' => now()->subMinutes(6)])->save();
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [statusSyncJiraIssue('done')], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]");

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    $this->workDueJobs();

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(statusSyncCardSays($item, 'Done in Jira'), true);

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn($card, 'Completed in Jira');

    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/rest/api/3/search/jql')
        && str_contains((string) $request['jql'], 'id in (10001) AND updated >= "-'));

    expect($item->fresh()->completed_via_source)->toBe('jira')
        ->and($integration->fresh()->last_polled_at->gt(now()->subMinute()))->toBeTrue();
});

it('asks to reconnect on the card once GitHub reports that the App was uninstalled', function () {
    statusSyncEnable(IntegrationProvider::GitHub);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = statusSyncSyncedItem(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/app/installations/4242' => Http::response(['message' => 'Not Found'], 404),
    ]);
    Http::fake(['api.github.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $path = statusSyncIntegrationsPath($retro);

    $page = $this->signIn($ada, $path);

    $this->openIntegration($page, 'github')
        ->assertSee('GitHub account')
        ->assertSee('Live updates (webhooks)')
        ->assertDontSee('Reconnect required');

    statusSyncGitHubEvent('installation', ['action' => 'deleted'], 'github-delivery-1')->assertAccepted();

    $page->navigate($path);

    $this->openIntegration($page, 'github')
        ->assertSee('Reconnect required')
        ->assertSee('The GitHub App was uninstalled from acme.')
        ->assertDontSee('Sync status');

    expect($integration->fresh()->last_error)->toBe('The GitHub App was uninstalled from acme.');
});

it('refuses a GitHub webhook whose signature is wrong and leaves the action item on the open board as it was', function () {
    statusSyncEnable(IntegrationProvider::GitHub);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = statusSyncSyncedItem(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues([3 => gitHubIssue(3, [
            'state' => 'closed',
            'state_reason' => 'completed',
            'updated_at' => now()->toIso8601String(),
        ])]),
    ]);
    Http::fake(['api.github.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404)]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]");

    statusSyncGitHubEvent('issues', [
        'action' => 'closed',
        'issue' => ['number' => 3],
        'repository' => ['id' => 9001, 'full_name' => 'acme/api'],
    ], 'github-delivery-1', 'not-the-github-secret')
        ->assertUnauthorized()
        ->assertExactJson(['message' => 'Invalid signature.']);

    $event = IntegrationInboundEvent::query()->sole();

    expect($event->status)->toBe(InboundEventStatus::Rejected)
        ->and($event->detail)->toBe('signature_mismatch')
        ->and(DB::table('jobs')->count())->toBe(0)
        ->and(statusSyncSentCount('POST', '/graphql'))->toBe(0)
        ->and($integration->fresh()->last_inbound_at)->toBeNull();

    $snapshotItem = collect($this->snapshotOf($page, "/retros/{$retro->id}/snapshot")['actionItems'])->firstWhere('id', $item->id);

    expect($snapshotItem['completedAt'])->toBeNull();

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertNotPresent("{$card} [aria-label=\"Reopen\"]");

    expect($item->fresh()->completed_at)->toBeNull();
});

it('completes the action item live on the boards of two participants when its issue is closed in Jira', function () {
    statusSyncEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = statusSyncSyncedItem(IntegrationProvider::Jira);
    [$bob] = retroMember($retro);
    $bob->forceFill(['name' => 'Bob Member', 'locale' => 'en'])->save();
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [statusSyncJiraIssue('done')], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $card = "#action-item-{$item->id}";

    $adaPage = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $adaPage->assertSeeIn($card, 'PROJ-1');
    $bobPage->assertSeeIn($card, 'PROJ-1')
        ->assertScript(statusSyncCardSays($item, 'Done in Jira'), false);

    statusSyncJiraEvent($integration, 'delivery-two-boards')->assertAccepted();

    $this->workDueJobs();

    $adaPage->assertPresent("{$card}:has-text(\"Done in Jira\")");
    $bobPage->assertPresent("{$card}:has-text(\"Done in Jira\")")
        ->assertNoJavaScriptErrors();

    expect($item->fresh()->completed_at)->not->toBeNull();
});
