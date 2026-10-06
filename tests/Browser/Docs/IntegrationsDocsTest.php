<?php

use App\Enums\InstanceSettingKey;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Enums\IntegrationWebhookStatus;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationUserMapping;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Support\InstanceSettings;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Browser\Support\DocsWorld;
use Tests\Browser\Support\InteractsWithIntegrations;

pest()->use(InteractsWithIntegrations::class);

const DocsIntegrationsAddress = 'https://skrum.nordlys.example';

const DocsIntegrationsCheckedAt = '2026-10-05 09:12:00';

beforeEach(function () {
    disableIntegrations();

    config([
        'services.integrations.inbound_webhooks' => 'on',
        'services.integrations.poll_minutes' => 5,
    ]);

    foreach (['slack' => 'slack', 'jira' => 'jira', 'linear' => 'linear', 'jira_dc' => 'jira-dc', 'github_app' => 'github'] as $service => $segment) {
        config(["services.{$service}.redirect" => DocsIntegrationsAddress."/integrations/{$segment}/callback"]);
    }

    RateLimiter::for('passwordConfirmations', fn (): Limit => Limit::none());
});

function docsIntegrationsPath(DocsWorld $world): string
{
    return route('teams.integrations.index', [$world->workspace, $world->team], false);
}

/**
 * @param  array<string, mixed>  $attributes
 */
function docsIntegrationsConnection(DocsWorld $world, TeamIntegrationFactory $factory, array $attributes = []): TeamIntegration
{
    return $factory->create([
        'team_id' => $world->team->id,
        'connected_by_user_id' => $world->person('Camille')->id,
        'last_checked_at' => DocsIntegrationsCheckedAt,
        ...$attributes,
    ]);
}

/**
 * @param  array<string, mixed>  $settings
 */
function docsIntegrationsSynced(TeamIntegration $integration, array $settings = []): TeamIntegration
{
    $integration->forceFill([
        'settings' => [
            ...$integration->settings,
            'statusSync' => true,
            'statusSyncSince' => '2026-09-21T08:00:00+00:00',
            ...$settings,
        ],
        'inbound_mode' => IntegrationInboundMode::Webhook,
        'webhook_status' => IntegrationWebhookStatus::Active,
        'last_polled_at' => '2026-10-05 09:00:00',
        'last_inbound_at' => DocsIntegrationsCheckedAt,
        'poll_cursor' => now(),
    ])->save();

    return $integration;
}

/**
 * @param  array<string, mixed>  $link
 */
function docsIntegrationsTrackedItem(DocsWorld $world, array $link): void
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $world->team->id, 'title' => 'Sprint 42 retrospective']);
    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $world->person('Camille')->id]);
    $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $participant->id,
        'content' => 'Speed up the CI pipeline',
    ]);

    ActionItemExternalLink::factory()->create(['action_item_id' => $item->id, ...$link]);
}

function docsIntegrationsMapping(TeamIntegration $integration, DocsWorld $world, string $firstName, ?string $account, IntegrationUserMatch $matchedBy = IntegrationUserMatch::Email): void
{
    IntegrationUserMapping::factory()->create([
        'team_integration_id' => $integration->id,
        'user_id' => $world->person($firstName)->id,
        'external_account_id' => $account === null ? null : str($account)->slug()->toString(),
        'external_display_name' => $account,
        'matched_by' => $matchedBy,
        'checked_at' => DocsIntegrationsCheckedAt,
    ]);
}

function docsIntegrationsShowPublicAddress(mixed $page, string $selector): void
{
    $selector = json_encode($selector, JSON_THROW_ON_ERROR);
    $address = json_encode(DocsIntegrationsAddress, JSON_THROW_ON_ERROR);

    $page->script("() => { document.querySelectorAll({$selector}).forEach((element) => { const shown = 'value' in element ? 'value' : 'textContent'; element[shown] = element[shown].replace(/^https?:\\/\\/[^\\/]+/, {$address}); }); return true; }");
}

function docsIntegrationsAvatarsLoaded(mixed $page): mixed
{
    return $page->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

function docsIntegrationsWithoutFocus(mixed $page): mixed
{
    $page->script('() => { const focused = document.activeElement; if (focused instanceof HTMLInputElement) { focused.setSelectionRange(0, 0); focused.scrollLeft = 0; } focused?.blur(); window.getSelection()?.removeAllRanges(); return true; }');

    return $page;
}

it('shows the integrations of the administration and the app of each provider that needs one', function () {
    $world = DocsWorld::create();
    $world->person('Camille')->forceFill(['is_instance_admin' => true])->save();

    withEnvironmentConfiguration([
        'services.slack.client_id' => '4821093756.7310924865',
        'services.slack.client_secret' => 'environment-slack-secret',
        'services.jira.client_id' => 'Xq7TnB2kLm9PzR4vWc8YdH3sFa6JgE1u',
        'services.jira.client_secret' => 'environment-jira-secret',
        'services.linear.client_id' => '5f2c9a71d4e8b30c6a1f7d92e4b8c053',
        'services.linear.client_secret' => 'environment-linear-secret',
        'services.linear.webhook_secret' => 'environment-linear-webhook-secret',
        'services.jira_dc.base_url' => 'https://jira.nordlys.example',
        'services.jira_dc.client_id' => 'b3d1f8a29c7e4056a1d2c3b4e5f60718',
        'services.jira_dc.client_secret' => 'environment-jira-dc-secret',
        'services.jira_dc.personal_tokens' => true,
        'services.github_app.app_id' => '482910',
        'services.github_app.slug' => 'skrum-nordlys',
        'services.github_app.client_id' => 'Iv23liNordlysSkrum01',
        'services.github_app.client_secret' => 'environment-github-secret',
        'services.github_app.private_key' => gitHubTestPrivateKey(),
        'services.github_app.webhook_secret' => 'environment-github-webhook-secret',
        'services.msteams.enabled' => true,
        'services.mattermost.url' => 'https://chat.nordlys.example',
    ]);
    resolve(InstanceSettings::class)->set(InstanceSettingKey::DisabledIntegrations->value, ['mattermost']);

    docsIntegrationsConnection($world, TeamIntegration::factory()->slack());
    docsIntegrationsConnection($world, TeamIntegration::factory()->jira());

    $page = passwordConfirmedPage($this->docsVisit($world->person('Camille'), '/admin/integrations')->resize(1440, 1100), '/admin/integrations')
        ->assertCount('[data-slot="integration-row"]', 9);

    $this->docShot($page, 'integrations/admin-integrations', '[data-slot="card"]:has([data-slot="integration-row"])');

    $apps = [
        'Slack' => 'slack-app',
        'Jira' => 'jira-app',
        'Jira Data Center' => 'jira-dc-app',
        'Linear' => 'linear-app',
        'GitHub' => 'github-app',
    ];

    foreach ($apps as $label => $picture) {
        $page->click("[data-slot=\"integration-row\"]:has(span:text-is(\"{$label}\")) button:has-text(\"Configure\")")
            ->assertSeeIn('[role="dialog"]', "{$label} app")
            ->assertPresent('[role="dialog"] [data-slot="configuration-field"]')
            ->assertNotPresent('[role="dialog"] [data-slot="confirmation-line"]');

        docsIntegrationsShowPublicAddress($page, '[role="dialog"] input[readonly]');

        $this->docShot(docsIntegrationsWithoutFocus($page), "integrations/{$picture}", '[role="dialog"]');

        $page->click('[role="dialog"] button:has-text("Cancel")')
            ->assertNotPresent('[role="dialog"]');
    }
});

it('shows the integrations of a team with Slack and Jira connected, then the Slack connection', function () {
    $world = DocsWorld::create();

    enableIntegrations(
        IntegrationProvider::Slack,
        IntegrationProvider::Jira,
        IntegrationProvider::Linear,
        IntegrationProvider::GitHub,
        IntegrationProvider::MicrosoftTeams,
        IntegrationProvider::Webhook,
    );

    docsIntegrationsConnection($world, TeamIntegration::factory()->slack()->state(['settings' => [
        'teamId' => 'T04NORDLYS',
        'teamName' => 'Nordlys',
        'channelId' => 'C04ATLAS',
        'channelName' => '#atlas-retros',
        'configurationUrl' => 'https://nordlys.slack.com/services/B04ATLAS',
    ]]));
    $jira = docsIntegrationsConnection($world, TeamIntegration::factory()->jira());
    $jira->forceFill(['settings' => [...$jira->settings, 'siteName' => 'Nordlys', 'siteUrl' => 'https://nordlys.atlassian.net']])->save();

    $page = $this->docsVisit($world->person('Camille'), docsIntegrationsPath($world))
        ->assertCount('[data-test^="integration-card-"]', 6);

    $this->assertIntegrationStatus($page, 'slack', 'Connected');
    $this->assertIntegrationStatus($page, 'jira', 'Connected');

    $this->docShot($page, 'integrations/team-integrations', '[data-slot="team-integrations"]');

    $this->openIntegration($page->resize(1440, 400), 'slack')
        ->assertSeeIn("{$this->integrationPanel('slack')} [data-slot=\"provider-details\"]", '#atlas-retros')
        ->assertSeeIn($this->integrationPanel('slack'), 'Send a test message');

    $this->docShot($page, 'integrations/slack-card', $this->integrationPanel('slack'));
});

it('shows the dialogs that connect Microsoft Teams and Mattermost with a pasted address', function () {
    $world = DocsWorld::create();

    enableIntegrations(IntegrationProvider::MicrosoftTeams);
    config(['services.mattermost.url' => 'https://chat.nordlys.example']);

    $page = $this->docsVisit($world->person('Camille'), docsIntegrationsPath($world))
        ->assertCount('[data-test^="integration-card-"]', 2);

    $channels = [
        'msteams' => ['teams-dialog', 'https://prod-42.westeurope.logic.azure.com:443/workflows/7c1e5b0f/triggers/manual/paths/invoke', 'Atlas · Retrospectives'],
        'mattermost' => ['mattermost-dialog', 'https://chat.nordlys.example/hooks/k7m2qx9dw4hb8tn3fy6cz5ajre', 'atlas-retros'],
    ];

    foreach ($channels as $provider => [$picture, $address, $label]) {
        $this->openIntegration($page, $provider)
            ->click("{$this->integrationPanel($provider)} [data-test=\"integration-connect\"]")
            ->fill($this->dialogOverPanel('input[type="url"]'), $address)
            ->fill($this->dialogOverPanel('input[maxlength="80"]'), $label)
            ->assertPresent($this->dialogOverPanel('button[type="submit"]'));

        $this->docShot(docsIntegrationsWithoutFocus($page), "integrations/{$picture}", $this->dialogOverPanel());

        $page->click($this->dialogOverPanel('button:has-text("Cancel")'))
            ->assertNotPresent($this->dialogOverPanel());

        $this->closeIntegration($page, $provider);
    }
});

it('shows the command that connects a Telegram chat while its code is valid', function () {
    $world = DocsWorld::create();

    enableIntegrations(IntegrationProvider::Telegram);
    Http::fake([
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'nordlys_skrum_bot']]),
    ]);

    $page = $this->docsVisit($world->person('Camille'), docsIntegrationsPath($world));

    $this->openIntegration($page, 'telegram')
        ->click("{$this->integrationPanel('telegram')} [data-test=\"integration-connect\"]")
        ->assertPresent('[data-slot="telegram-pending-code"] code')
        ->assertSeeIn('[data-slot="telegram-pending-code"]', 'Open @nordlys_skrum_bot in Telegram');

    $page->script(<<<'JS'
        () => {
            const state = document.querySelector('[data-slot="telegram-pending-state"]');
            const still = state.cloneNode(true);

            still.textContent = state.textContent.replace(/\d+:\d+/, '14:52');
            state.replaceWith(still);
            document.querySelector('[data-slot="telegram-pending-code"] code').textContent = '/connect@nordlys_skrum_bot K7M2QX9D';

            return true;
        }
        JS);

    $this->docShot($page, 'integrations/telegram-connect', '[data-slot="telegram-pending-code"]');
});

it('shows Jira connected with write access, its people, its priorities and its status sync', function () {
    $world = DocsWorld::create();

    enableIntegrations(IntegrationProvider::Jira);
    Http::fake([
        jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => [
            ['id' => '1', 'name' => 'Highest'],
            ['id' => '2', 'name' => 'High'],
            ['id' => '3', 'name' => 'Medium'],
            ['id' => '4', 'name' => 'Low'],
        ]]),
        jiraApiUrl('rest/api/3/project/ATLAS/statuses') => Http::response([
            ['id' => '1', 'name' => 'Task', 'statuses' => [
                ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
                ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']],
                ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
            ]],
        ]),
    ]);

    $jira = docsIntegrationsSynced(docsIntegrationsConnection($world, TeamIntegration::factory()->jira()), [
        'siteName' => 'Nordlys',
        'siteUrl' => 'https://nordlys.atlassian.net',
        'webhookIds' => ['7001'],
        'webhookProjects' => ['ATLAS'],
        'numberFields' => [
            ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
            ['id' => 'customfield_10050', 'name' => 'Business value'],
        ],
    ]);
    $jira->forceFill(['webhook_expires_at' => now()->addDays(20)])->save();

    docsIntegrationsMapping($jira, $world, 'Théo', 'Théo Martin');
    docsIntegrationsMapping($jira, $world, 'Inès', 'Inès Benali');
    docsIntegrationsMapping($jira, $world, 'Malik', 'Malik Kone', IntegrationUserMatch::Manual);
    docsIntegrationsMapping($jira, $world, 'Yuki', null, IntegrationUserMatch::Manual);

    docsIntegrationsTrackedItem($world, [
        'source' => IntegrationProvider::Jira,
        'external_site' => 'cloud-1',
        'external_id' => '10012',
        'external_key' => 'ATLAS-12',
        'external_url' => 'https://nordlys.atlassian.net/browse/ATLAS-12',
    ]);

    $page = $this->docsVisit($world->person('Camille'), docsIntegrationsPath($world))->resize(1440, 1500);
    $panel = $this->integrationPanel('jira');

    $this->openIntegration($page, 'jira')
        ->assertCount("{$panel} [data-slot=\"tracker-people\"] li", 8)
        ->assertPresent("{$panel} [data-slot=\"tracker-priorities\"] button[role=\"combobox\"]")
        ->assertPresent("{$panel} [data-slot=\"status-mapping-container\"]")
        ->assertSeeIn("{$panel} [data-slot=\"status-sync-mode\"]", 'Live updates (webhooks)')
        ->assertNotPresent("{$panel} [data-slot=\"panel-loading\"]");

    docsIntegrationsAvatarsLoaded($page);

    $this->docShot($page, 'integrations/jira-card', $panel);
});

it('shows the webhook a Jira administrator registers by hand for Jira Data Center', function () {
    $world = DocsWorld::create();

    enableIntegrations(IntegrationProvider::JiraDataCenter);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/priority') => Http::response([['id' => '2', 'name' => 'High'], ['id' => '3', 'name' => 'Medium'], ['id' => '4', 'name' => 'Low']]),
        jiraDataCenterUrl('rest/api/2/project/OPS/statuses') => Http::response([
            ['id' => '1', 'name' => 'Task', 'statuses' => [
                ['id' => '1', 'name' => 'Open', 'statusCategory' => ['key' => 'new']],
                ['id' => '6', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']],
            ]],
        ]),
    ]);

    $integration = docsIntegrationsConnection($world, TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write), [
        'id' => '0199d0c5-1000-7000-8000-000000000001',
    ]);
    $integration->forceFill([
        'settings' => [
            ...$integration->settings,
            'statusSync' => true,
            'statusSyncSince' => '2026-09-21T08:00:00+00:00',
            'webhookManual' => true,
        ],
        'credentials' => [
            ...(array) $integration->readableCredentials(),
            'webhookToken' => 'p4Xn8LqT2vRb7KdW9sFh3YcM6jZa1GeU5oNi0BtC',
            'webhookSecret' => 'Qw8ErT5yUi2OpA7sDf4GhJ1kLz9XcV6bNm3QaZ0x',
        ],
        'inbound_mode' => IntegrationInboundMode::Polling,
        'webhook_status' => null,
        'last_polled_at' => '2026-10-05 09:00:00',
        'poll_cursor' => now(),
    ])->save();

    docsIntegrationsTrackedItem($world, [
        'source' => IntegrationProvider::JiraDataCenter,
        'external_site' => JiraDataCenterServer::key(TeamIntegrationFactory::JiraDataCenterUrl),
        'external_id' => '10021',
        'external_key' => 'OPS-21',
        'external_url' => 'https://jira.example.com/browse/OPS-21',
    ]);

    $page = $this->docsVisit($world->person('Camille'), docsIntegrationsPath($world));

    $this->openIntegration($page, 'jira_dc')
        ->assertSeeIn('[data-slot="tracker-webhook"]', 'Only a Jira administrator can register the webhook.')
        ->click('[data-slot="tracker-webhook"] button:has-text("Show webhook details")')
        ->assertCount('[data-slot="tracker-webhook"] dd code', 4)
        ->assertSeeIn('[data-slot="tracker-webhook"]', 'project in ("OPS")');

    docsIntegrationsShowPublicAddress($page, '[data-slot="tracker-webhook"] dd code');

    $this->docShot($page, 'integrations/jira-dc-webhook', '[data-slot="tracker-webhook"]');
});

it('shows Linear connected with write access, its people, its priorities and its status sync', function () {
    $world = DocsWorld::create();

    enableIntegrations(IntegrationProvider::Linear);
    config(['services.linear.webhook_secret' => 'linear-webhook-secret']);

    $linear = docsIntegrationsSynced(docsIntegrationsConnection($world, TeamIntegration::factory()->linear()), [
        'organizationName' => 'Nordlys',
        'urlKey' => 'nordlys',
    ]);

    docsIntegrationsMapping($linear, $world, 'Théo', 'Théo Martin');
    docsIntegrationsMapping($linear, $world, 'Sofia', 'Sofia Lindqvist');
    docsIntegrationsMapping($linear, $world, 'Noa', 'Noa Kim', IntegrationUserMatch::Manual);

    $page = $this->docsVisit($world->person('Camille'), docsIntegrationsPath($world))->resize(1440, 1400);
    $panel = $this->integrationPanel('linear');

    $this->openIntegration($page, 'linear')
        ->assertCount("{$panel} [data-slot=\"tracker-people\"] li", 8)
        ->assertPresent("{$panel} [data-slot=\"tracker-priorities\"] button[role=\"combobox\"]")
        ->assertSeeIn("{$panel} [data-slot=\"status-sync-mode\"]", 'Live updates (webhooks)')
        ->assertSeeIn($panel, 'Treat canceled as done')
        ->assertNotPresent("{$panel} [data-slot=\"panel-loading\"]");

    docsIntegrationsAvatarsLoaded($page);

    $this->docShot($page, 'integrations/linear-card', $panel);
});

it('shows GitHub connected on an organisation, its people, its priority labels and its status sync', function () {
    $world = DocsWorld::create();

    enableIntegrations(IntegrationProvider::GitHub);
    config(['services.github_app.webhook_secret' => 'github-webhook-secret']);

    $gitHub = docsIntegrationsSynced(docsIntegrationsConnection($world, TeamIntegration::factory()->gitHub()), [
        'accountLogin' => 'nordlys',
        'exportRepositoryId' => '9001',
        'exportRepositoryName' => 'nordlys/atlas-app',
        'priorityLabels' => ['high' => 'priority: high', 'medium' => 'priority: medium', 'low' => 'priority: low'],
    ]);

    docsIntegrationsMapping($gitHub, $world, 'Théo', 'theo-martin', IntegrationUserMatch::Sso);
    docsIntegrationsMapping($gitHub, $world, 'Inès', 'ines-benali', IntegrationUserMatch::Sso);
    docsIntegrationsMapping($gitHub, $world, 'Lucas', 'lucasdurand', IntegrationUserMatch::Manual);

    $page = $this->docsVisit($world->person('Camille'), docsIntegrationsPath($world))->resize(1440, 1370);
    $panel = $this->integrationPanel('github');

    $this->openIntegration($page, 'github')
        ->assertCount("{$panel} [data-slot=\"tracker-people\"] li", 8)
        ->assertSeeIn($panel, 'Priority labels')
        ->assertSeeIn($panel, 'nordlys/atlas-app')
        ->assertSeeIn("{$panel} [data-slot=\"status-sync-mode\"]", 'Live updates (webhooks)')
        ->assertNotPresent("{$panel} [data-slot=\"panel-loading\"]");

    docsIntegrationsAvatarsLoaded($page);

    $this->docShot(docsIntegrationsWithoutFocus($page), 'integrations/github-card', $panel);
});

it('shows the signing secret of a webhook once, when it is connected', function () {
    $world = DocsWorld::create();

    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();

    $page = $this->docsVisit($world->person('Camille'), docsIntegrationsPath($world));
    $secret = $this->dialogOverPanel('input[readonly]');

    $this->openIntegration($page, 'webhook')
        ->click("{$this->integrationPanel('webhook')} button:has-text(\"Connect\")")
        ->fill($this->dialogOverPanel('input[type="url"]'), 'https://hooks.nordlys.example/skrum')
        ->fill($this->dialogOverPanel('input[maxlength="80"]'), 'Delivery dashboard')
        ->click($this->dialogOverPanel('button[type="submit"]'))
        ->assertSee('Webhook connected.')
        ->assertPresent($secret);

    $secretSelector = json_encode($secret, JSON_THROW_ON_ERROR);

    $page->script("() => { document.querySelector({$secretSelector}).value = '5d0c7e1f9a3b48c2d6e0f4a8b1c35d79e2f6a0b4c8d1e3f5a7b9c0d2e4f6a8b0'; return true; }");

    $this->docShot(docsIntegrationsWithoutFocus($page), 'integrations/webhook-secret', $this->dialogOverPanel());
});

it('shows the events a webhook sends by itself and the log of its deliveries', function () {
    $world = DocsWorld::create();

    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();

    $integration = docsIntegrationsConnection($world, TeamIntegration::factory()->webhook(['retro.completed', 'action_item.completed']), [
        'last_delivery_succeeded_at' => '2026-10-05 09:12:04',
    ]);
    $integration->forceFill(['settings' => [...$integration->settings, 'host' => 'hooks.nordlys.example', 'channelLabel' => 'Delivery dashboard']])->save();

    $retro = Retro::factory()->create(['team_id' => $world->team->id, 'title' => 'Sprint 42 retrospective']);
    $delivery = [
        'team_id' => $world->team->id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'event' => 'action_item.completed',
        'team_integration_id' => $integration->id,
        'subject_type' => $retro->getMorphClass(),
        'subject_id' => $retro->id,
        'requested_by_user_id' => null,
    ];

    $failed = IntegrationDelivery::factory()->failed('Webhook did not respond. Try again later.')->create([
        ...$delivery,
        'id' => '0199d0c5-2000-7000-8000-000000000002',
        'attempts' => 7,
        'response_status' => 503,
        'created_at' => '2026-10-05 06:00:00',
        'last_attempt_at' => '2026-10-05 09:42:30',
    ]);
    $failed->payload()->create(['message' => ['id' => $failed->id, 'event' => 'action_item.completed', 'occurredAt' => '2026-10-05T06:00:00Z', 'data' => []]]);

    $again = IntegrationDelivery::factory()->create([
        ...$delivery,
        'id' => '0199d0c5-2000-7000-8000-000000000001',
        'attempts' => 0,
        'redelivery_of_id' => $failed->id,
        'requested_by_user_id' => $world->person('Camille')->id,
        'created_at' => '2026-10-05 09:45:00',
    ]);
    $again->payload()->create(['message' => ['id' => $failed->id, 'event' => 'action_item.completed', 'occurredAt' => '2026-10-05T06:00:00Z', 'data' => []]]);

    $sent = IntegrationDelivery::factory()->sent()->create([
        ...$delivery,
        'id' => '0199d0c5-2000-7000-8000-000000000003',
        'event' => 'retro.completed',
        'attempts' => 1,
        'response_status' => 200,
        'created_at' => '2026-10-02 15:30:00',
        'last_attempt_at' => '2026-10-02 15:30:02',
    ]);
    $sent->payload()->create(['message' => ['id' => $sent->id, 'event' => 'retro.completed', 'occurredAt' => '2026-10-02T15:30:00Z', 'data' => []]]);

    IntegrationDelivery::factory()->sent()->create([
        ...$delivery,
        'id' => '0199d0c5-2000-7000-8000-000000000004',
        'kind' => IntegrationDeliveryKind::RetroLink,
        'event' => 'retro.link',
        'requested_by_user_id' => $world->person('Camille')->id,
        'attempts' => 1,
        'response_status' => 204,
        'created_at' => '2026-10-02 14:02:00',
        'last_attempt_at' => '2026-10-02 14:02:01',
    ])->payload()->create(['message' => ['id' => '0199d0c5-2000-7000-8000-000000000004', 'event' => 'retro.link', 'occurredAt' => '2026-10-02T14:02:00Z', 'data' => []]]);

    $page = $this->docsVisit($world->person('Camille'), docsIntegrationsPath($world))->resize(1440, 1300);
    $panel = $this->integrationPanel('webhook');

    $this->openIntegration($page, 'webhook')
        ->assertCount("{$panel} [data-slot=\"webhook-events\"] li", 5)
        ->assertAttribute("{$panel} [id=\"webhook-event-retro.completed\"]", 'aria-checked', 'true')
        ->click("{$panel} [data-slot=\"webhook-deliveries\"] button[aria-expanded=\"false\"]")
        ->assertNotPresent("{$panel} [data-slot=\"deliveries-loading\"]")
        ->assertCount("{$panel} table[aria-label] tbody tr", 4);

    $this->docShot(docsIntegrationsWithoutFocus($page), 'integrations/webhook-events', "{$panel} [data-slot=\"webhook-events\"]");
    $this->docShot($page->hover("{$panel} [data-slot=\"sheet-title\"]"), 'integrations/delivery-log', "{$panel} [data-slot=\"webhook-deliveries\"]");
});
