<?php

use App\Enums\IntegrationCapability;
use App\Enums\IntegrationProvider;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('behaves as spec 6 while no new variable is set', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Linear);

    expect(IntegrationProvider::JiraDataCenter->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::GitHub->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::MicrosoftTeams->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::Mattermost->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::Webhook->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::Slack->isEnabled())->toBeTrue()
        ->and(IntegrationProvider::Linear->isEnabled())->toBeTrue();
});

it('enables Microsoft Teams and Mattermost from their env', function () {
    disableIntegrations();

    expect(IntegrationProvider::MicrosoftTeams->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::Mattermost->isEnabled())->toBeFalse();

    config(['services.msteams.enabled' => true, 'services.mattermost.url' => 'https://chat.example.com']);

    expect(IntegrationProvider::enabled())->toBe([IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost]);
});

it('accepts only an http(s) Mattermost server URL', function (string $url, bool $enabled) {
    disableIntegrations();
    config(['services.mattermost.url' => $url]);

    expect(IntegrationProvider::Mattermost->isEnabled())->toBe($enabled);
})->with([
    'https' => ['https://chat.example.com', true],
    'context path' => ['https://example.com/mattermost', true],
    'http with port' => ['http://mattermost.internal:8065', true],
    'ftp' => ['ftp://chat.example.com', false],
    'query' => ['https://chat.example.com?team=a', false],
    'user info' => ['https://user:secret@chat.example.com', false],
    'two path segments' => ['https://example.com/a/b', false],
]);

it('enables every extended provider from its env', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub, IntegrationProvider::Webhook);

    expect(IntegrationProvider::JiraDataCenter->isEnabled())->toBeTrue()
        ->and(IntegrationProvider::GitHub->isEnabled())->toBeTrue()
        ->and(IntegrationProvider::Webhook->isEnabled())->toBeTrue();
});

it('detects a complete Jira Data Center configuration', function (array $config, bool $configured, array $methods) {
    disableIntegrations();
    config($config);

    expect(IntegrationProvider::JiraDataCenter->isConfigured())->toBe($configured)
        ->and(IntegrationProvider::JiraDataCenter->authMethods())->toBe($methods);
})->with([
    'oauth and tokens' => [['services.jira_dc.base_url' => 'https://jira.example.com', 'services.jira_dc.client_id' => 'id', 'services.jira_dc.client_secret' => 'secret', 'services.jira_dc.personal_tokens' => true], true, ['oauth', 'pat']],
    'oauth only' => [['services.jira_dc.base_url' => 'https://jira.example.com/jira', 'services.jira_dc.client_id' => 'id', 'services.jira_dc.client_secret' => 'secret', 'services.jira_dc.personal_tokens' => false], true, ['oauth']],
    'tokens only' => [['services.jira_dc.base_url' => 'http://jira.internal:8080', 'services.jira_dc.personal_tokens' => true], true, ['pat']],
    'no method' => [['services.jira_dc.base_url' => 'https://jira.example.com', 'services.jira_dc.client_id' => 'id', 'services.jira_dc.personal_tokens' => false], false, []],
    'no base URL' => [['services.jira_dc.client_id' => 'id', 'services.jira_dc.client_secret' => 'secret', 'services.jira_dc.personal_tokens' => true], false, ['oauth', 'pat']],
    'deep path' => [['services.jira_dc.base_url' => 'https://example.com/a/jira', 'services.jira_dc.personal_tokens' => true], false, ['pat']],
    'query string' => [['services.jira_dc.base_url' => 'https://jira.example.com?x=1', 'services.jira_dc.personal_tokens' => true], false, ['pat']],
]);

it('detects a complete GitHub App configuration', function () {
    disableIntegrations();
    config([
        'services.github_app.app_id' => '12345',
        'services.github_app.slug' => 'skrum-test',
        'services.github_app.client_id' => 'github-client',
        'services.github_app.client_secret' => 'github-secret',
    ]);

    expect(IntegrationProvider::GitHub->isConfigured())->toBeFalse();

    config(['services.github_app.private_key_path' => '/secrets/github.pem']);

    expect(IntegrationProvider::GitHub->isConfigured())->toBeTrue();

    config(['services.github_app.private_key_path' => null, 'services.github_app.private_key' => "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"]);

    expect(IntegrationProvider::GitHub->isConfigured())->toBeTrue();

    config(['services.github_app.slug' => null]);

    expect(IntegrationProvider::GitHub->isConfigured())->toBeFalse();
});

it('describes the kind and capabilities of every provider', function () {
    $share = [IntegrationCapability::ShareLink, IntegrationCapability::ShareRecap];
    $tracker = [
        IntegrationCapability::PokerImport,
        IntegrationCapability::EstimateWriteBack,
        IntegrationCapability::ActionItemExport,
        IntegrationCapability::AssigneeMapping,
        IntegrationCapability::PriorityMapping,
        IntegrationCapability::StatusSync,
    ];

    foreach ([IntegrationProvider::Slack, IntegrationProvider::Telegram, IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost] as $channel) {
        expect($channel->isChannel())->toBeTrue()
            ->and($channel->isTracker())->toBeFalse()
            ->and($channel->capabilities())->toBe($share);
    }

    foreach ([IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter, IntegrationProvider::Linear, IntegrationProvider::GitHub] as $trackerProvider) {
        expect($trackerProvider->isTracker())->toBeTrue()
            ->and($trackerProvider->capabilities())->toBe($tracker);
    }

    expect(IntegrationProvider::Webhook->isChannel())->toBeTrue()
        ->and(IntegrationProvider::Webhook->capabilities())->toBe([...$share, IntegrationCapability::AutomaticEvents])
        ->and(IntegrationProvider::Webhook->can(IntegrationCapability::AutomaticEvents))->toBeTrue()
        ->and(IntegrationProvider::MicrosoftTeams->can(IntegrationCapability::AutomaticEvents))->toBeFalse();
});

it('names and classifies the new providers', function () {
    expect(IntegrationProvider::JiraDataCenter->label())->toBe('Jira Data Center')
        ->and(IntegrationProvider::GitHub->label())->toBe('GitHub')
        ->and(IntegrationProvider::MicrosoftTeams->label())->toBe('Microsoft Teams')
        ->and(IntegrationProvider::Mattermost->label())->toBe('Mattermost')
        ->and(IntegrationProvider::Webhook->label())->toBe('Webhook')
        ->and(IntegrationProvider::JiraDataCenter->usesOAuth())->toBeTrue()
        ->and(IntegrationProvider::GitHub->usesOAuth())->toBeTrue()
        ->and(IntegrationProvider::MicrosoftTeams->usesOAuth())->toBeFalse()
        ->and(IntegrationProvider::Mattermost->usesOAuth())->toBeFalse()
        ->and(IntegrationProvider::Webhook->usesOAuth())->toBeFalse()
        ->and(IntegrationProvider::MicrosoftTeams->connectsWithUrl())->toBeTrue()
        ->and(IntegrationProvider::Mattermost->connectsWithUrl())->toBeTrue()
        ->and(IntegrationProvider::Webhook->connectsWithUrl())->toBeTrue()
        ->and(IntegrationProvider::Slack->connectsWithUrl())->toBeFalse()
        ->and(IntegrationProvider::JiraDataCenter->authMethods())->toBeArray()
        ->and(IntegrationProvider::Slack->authMethods())->toBeEmpty();
});

it('uses fixed callback URLs for Jira Data Center and GitHub', function () {
    expect(parse_url((string) config('services.jira_dc.redirect'), PHP_URL_PATH))->toBe(route('integrations.jiraDataCenter.callback', absolute: false))
        ->and(parse_url((string) config('services.github_app.redirect'), PHP_URL_PATH))->toBe(route('integrations.callback', 'github', absolute: false))
        ->and(config('services.msteams.allowed_hosts'))->toBe([])
        ->and(config('services.outgoing_webhooks.allow_private_networks'))->toBeFalse()
        ->and(config('services.outgoing_webhooks.allow_http'))->toBeFalse();
});
