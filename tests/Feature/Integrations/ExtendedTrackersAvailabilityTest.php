<?php

use App\Enums\IntegrationProvider;
use App\Models\ActionItemExternalLink;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('enables Jira Data Center and GitHub from their env alone', function () {
    disableIntegrations();

    expect(IntegrationProvider::enabled())->toBe([]);

    enableIntegrations(IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub);

    expect(IntegrationProvider::enabled())->toBe([IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub])
        ->and(IntegrationProvider::JiraDataCenter->isTracker())->toBeTrue()
        ->and(IntegrationProvider::GitHub->isTracker())->toBeTrue();
});

it('identifies the Jira server and the GitHub installation of a connection', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    $jira = TeamIntegration::factory()->jiraDataCenter()->create();
    $gitHub = TeamIntegration::factory()->gitHub()->create();

    expect($jira->site())->toBe(JiraDataCenterServer::key())
        ->and(JiraDataCenterServer::key())->toHaveLength(40)
        ->and(JiraDataCenterServer::key(TeamIntegrationFactory::JiraDataCenterUrl.'/'))->toBe(JiraDataCenterServer::key())
        ->and(JiraDataCenterServer::key('https://other.example.com'))->not->toBe(JiraDataCenterServer::key())
        ->and(JiraDataCenterServer::url('/rest/api/2/myself'))->toBe('https://jira.example.com/rest/api/2/myself')
        ->and($gitHub->site())->toBe(TeamIntegrationFactory::GitHubInstallationId);
});

it('stores GitHub issue keys longer than Jira keys', function () {
    $key = str_repeat('o', 39).'/'.str_repeat('r', 100).'#1234567';
    $task = PokerTask::factory()->imported(IntegrationProvider::GitHub, TeamIntegrationFactory::GitHubInstallationId)->create();
    $task->forceFill(['external_key' => $key])->save();
    $link = ActionItemExternalLink::factory()->create([
        'source' => IntegrationProvider::GitHub,
        'external_site' => TeamIntegrationFactory::GitHubInstallationId,
        'external_key' => $key,
    ]);

    expect($task->fresh()?->external_key)->toBe($key)
        ->and($link->fresh()?->external_key)->toBe($key)
        ->and($task->external_url)->toStartWith('https://github.com/acme/api/issues/');
});
