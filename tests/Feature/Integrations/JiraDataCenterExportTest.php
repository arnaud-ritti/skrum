<?php

use App\Enums\ActionItemPriority;
use App\Enums\IntegrationProvider;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemExternalLinksChanged;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CarriedActionItemSaved;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationUserMapping;
use App\Models\TeamIntegration;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    Event::fake([ActionItemSaved::class, TeamActionItemSaved::class, CarriedActionItemSaved::class, ActionItemExternalLinksChanged::class]);
    enableIntegrations(IntegrationProvider::JiraDataCenter);
});

it('exports an action item to Jira Data Center with wiki markup and a name assignee', function () {
    Http::fake([
        jiraDataCenterUrl('rest/api/2/issue/createmeta/*') => Http::response(['values' => jiraCreateMeta()['fields']]),
        jiraDataCenterUrl('rest/api/2/issue') => Http::response(['id' => '10042', 'key' => 'PROJ-42'], 201),
    ]);
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High, 'due_on' => '2026-10-20', 'content' => "Speed up CI\nUse *cache* [now]"]);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create(['team_id' => $retro->team_id]);
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => 'jdoe']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'jira_dc', 'project_id' => '10000', 'issue_type_id' => '11'])
        ->assertCreated()
        ->assertJsonPath('actionItem.externalLinks', [['source' => 'jira_dc', 'key' => 'PROJ-42', 'url' => 'https://jira.example.com/browse/PROJ-42']])
        ->assertJsonPath('warnings', []);

    Http::assertSent(function (Request $request) {
        if ($request->url() !== 'https://jira.example.com/rest/api/2/issue') {
            return false;
        }

        $fields = $request['fields'];

        return $fields['project'] === ['id' => '10000']
            && $fields['summary'] === 'Speed up CI'
            && $fields['duedate'] === '2026-10-20'
            && $fields['priority'] === ['id' => '2']
            && $fields['assignee'] === ['name' => 'jdoe']
            && str_starts_with($fields['description'], "Speed up CI\n\nUse \\*cache\\* \\[now\\]\n\nFrom the retrospective \"Sprint 12\"");
    });
    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://jira.example.com/rest/api/2/issue/createmeta/10000/issuetypes/11'));

    expect(ActionItemExternalLink::query()->sole()->external_site)->toBe(JiraDataCenterServer::key())
        ->and($integration->fresh()?->setting('exportProjectId'))->toBe('10000');
});

it('lists Data Center projects, issue types and priorities', function () {
    Http::fake([
        jiraDataCenterUrl('rest/api/2/project') => Http::response([
            ['id' => '10001', 'key' => 'WEB', 'name' => 'Website'],
            ['id' => '10000', 'key' => 'API', 'name' => 'API platform'],
        ]),
        jiraDataCenterUrl('rest/api/2/issue/createmeta/10000/issuetypes') => Http::response(['values' => [
            ['id' => '10', 'name' => 'Story', 'subtask' => false],
            ['id' => '11', 'name' => 'Task', 'subtask' => false],
            ['id' => '12', 'name' => 'Sub-task', 'subtask' => true],
        ]]),
        jiraDataCenterUrl('rest/api/2/priority') => Http::response([['id' => '1', 'name' => 'Blocker'], ['id' => '2', 'name' => 'High']]),
    ]);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $team = $integration->team;
    $admin = integrationAdmin($team);

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.targets.index', [$team->workspace, $team, $integration, 'q' => 'api']))
        ->assertOk()
        ->assertExactJson([
            'projects' => [['id' => '10000', 'key' => 'API', 'name' => 'API platform']],
            'issueTypes' => [['id' => '10', 'name' => 'Story'], ['id' => '11', 'name' => 'Task']],
            'defaults' => ['projectId' => '10000', 'issueTypeId' => '11'],
        ]);

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.priorities.index', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertExactJson([['id' => '1', 'name' => 'Blocker'], ['id' => '2', 'name' => 'High']]);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['priority_map' => ['high' => '1'], 'story_point_field_id' => 'customfield_10002'])
        ->assertOk()
        ->assertJsonPath('settings.priorityMap.high', ['id' => '1', 'name' => 'Blocker']);
});

it('matches people by username search with exactly one equal email', function () {
    Http::fake([
        jiraDataCenterUrl('rest/api/2/user/search*') => fn (Request $request) => Http::response(str_starts_with(strtolower((string) $request['username']), 'ann') ? [
            ['name' => 'ann', 'displayName' => 'Ann Lee', 'emailAddress' => 'ann@example.com', 'active' => true],
            ['name' => 'anna', 'displayName' => 'Anna Bell', 'emailAddress' => 'anna@example.com', 'active' => true],
        ] : [
            ['name' => 'bob', 'displayName' => 'Bob', 'emailAddress' => 'bob@example.com', 'active' => false],
        ]),
        jiraDataCenterUrl('rest/api/2/user?*') => Http::response(['name' => 'ann', 'displayName' => 'Ann Lee', 'active' => true]),
    ]);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $accounts = app(IntegrationUserAccounts::class);

    $matches = $accounts->matchEmails($integration, ['Ann@example.com', 'bob@example.com']);

    expect(array_keys($matches))->toBe(['ann@example.com'])
        ->and($matches['ann@example.com']->id)->toBe('ann')
        ->and($accounts->find($integration, 'ann'))->toBeInstanceOf(ExternalAccount::class)
        ->and(array_map(fn (ExternalAccount $account): array => $account->toArray(), $accounts->search($integration, 'ann')))
        ->toBe([['accountId' => 'ann', 'displayName' => 'Ann Lee'], ['accountId' => 'anna', 'displayName' => 'Anna Bell']]);

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://jira.example.com/rest/api/2/user/search')
        && $request['username'] === 'Ann@example.com'
        && (int) $request['maxResults'] === 2);
});
