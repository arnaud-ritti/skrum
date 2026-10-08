<?php

use App\Enums\IntegrationProvider;
use App\Support\Integrations\Trackers\JiraDataCenterTracker;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('browses Linear across the connection without mandatory filters and carries its cursor', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    fakeLinearGraphql(['workflowStates(' => [
        'workflowStates' => ['nodes' => [['id' => 'todo', 'name' => 'Todo']]],
        'issues' => ['nodes' => [linearTrackerIssue('uuid-1', 'ENG-1')], 'pageInfo' => ['hasNextPage' => true, 'endCursor' => 'next-linear']],
    ]]);

    $url = route('poker.imports.preview.store', [$table['game'], 'linear']);
    $this->actingAs($table['member'])->postJson($url, ['mode' => 'iteration', 'browse' => true])
        ->assertOk()->assertJsonPath('nextCursor', 'next-linear')->assertJsonPath('statuses.0.name', 'Todo');

    $this->postJson($url, ['mode' => 'iteration', 'browse' => true, 'search' => 'login', 'status_id' => 'todo', 'cursor' => 'next-linear'])
        ->assertOk()->assertJsonPath('issues.0.key', 'ENG-1');

    Http::assertSent(fn (Request $request) => data_get($request->data(), 'variables.after') === 'next-linear'
        && data_get($request->data(), 'variables.filter.state.id.eq') === 'todo'
        && data_get($request->data(), 'variables.filter.or.0.title.containsIgnoreCase') === 'login');
});

it('combines a Linear cycle with team search and status before paginating', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    fakeLinearGraphql(['team(id:' => ['team' => [
        'states' => ['nodes' => [['id' => 'todo', 'name' => 'Todo']]],
        'issues' => ['nodes' => [], 'pageInfo' => ['hasNextPage' => false, 'endCursor' => null]],
    ]]]);

    $this->actingAs($table['member'])->postJson(route('poker.imports.preview.store', [$table['game'], 'linear']), [
        'mode' => 'iteration', 'browse' => true, 'container' => 'team-1', 'iteration_id' => 'cycle-1', 'search' => 'ENG-42', 'status_id' => 'todo',
    ])->assertOk()->assertJsonPath('nextCursor', null);

    Http::assertSent(fn (Request $request) => data_get($request->data(), 'variables.filter.cycle.id.eq') === 'cycle-1'
        && data_get($request->data(), 'variables.filter.or.2.number.eq') === 42
        && data_get($request->data(), 'variables.id') === 'team-1');
});

it('browses all Jira issues and applies project search and status on subsequent pages', function () {
    $table = trackerTable();
    Http::fake([
        '*/rest/api/3/search/jql' => Http::response(['issues' => [jiraTrackerIssue('10001', 'PROJ-1')], 'nextPageToken' => 'jira-next']),
        '*/rest/api/3/status' => Http::response([['id' => '100', 'name' => 'Todo']]),
    ]);
    $url = route('poker.imports.preview.store', [$table['game'], 'jira']);

    $this->actingAs($table['member'])->postJson($url, ['mode' => 'iteration', 'browse' => true])
        ->assertOk()->assertJsonPath('nextCursor', 'jira-next')->assertJsonPath('statuses.0.id', '100');
    $this->postJson($url, ['mode' => 'iteration', 'browse' => true, 'project_id' => '1000', 'search' => 'login', 'status_id' => '100', 'cursor' => 'jira-next'])
        ->assertOk();

    Http::assertSent(fn (Request $request) => ($request['nextPageToken'] ?? null) === 'jira-next'
        && str_contains($request['jql'], 'project = "1000"')
        && str_contains($request['jql'], 'text ~ "login"')
        && str_contains($request['jql'], 'status = "100"')
        && $request['maxResults'] === 50);
});

it('keeps the Jira board filter when no sprint is selected', function () {
    $table = trackerTable();
    Http::fake([
        '*/rest/agile/1.0/board/7/configuration' => Http::response(['filter' => ['id' => '123']]),
        '*/rest/api/3/search/jql' => Http::response(['issues' => [], 'isLast' => true]),
        '*/rest/api/3/status' => Http::response([]),
    ]);
    $this->actingAs($table['member'])->postJson(route('poker.imports.preview.store', [$table['game'], 'jira']), ['mode' => 'iteration', 'browse' => true, 'container' => '7'])
        ->assertOk()->assertJsonPath('nextCursor', null);
    Http::assertSent(fn (Request $request) => ($request['jql'] ?? '') === '(filter = 123) ORDER BY Rank ASC');
});

it('paginates Jira Data Center by offset without stopping at the first page', function () {
    $table = trackerTable(IntegrationProvider::JiraDataCenter);
    $integration = $table['integration'];
    Http::fake([
        '*/rest/api/2/search' => Http::response(['issues' => [jiraTrackerIssue('10002', 'PROJ-2')], 'total' => 51]),
        '*/rest/api/2/status' => Http::response([]),
    ]);
    $list = resolve(JiraDataCenterTracker::class)->browse($integration, 'iteration', null, null, null, null, null, '50');

    expect($list->issues[0]->key)->toBe('PROJ-2')->and($list->nextCursor)->toBeNull();
    Http::assertSent(fn (Request $request) => ($request['startAt'] ?? null) === 50 && $request['maxResults'] === 50);
});

it('lists Jira projects independently of boards', function () {
    $table = trackerTable();
    Http::fake(['*/rest/api/3/project/search*' => Http::response(['values' => [['id' => '1000', 'name' => 'Product', 'key' => 'PROD']], 'isLast' => true])]);
    $this->actingAs($table['member'])->getJson(route('poker.imports.containers.index', [$table['game'], 'jira', 'projects' => true, 'q' => 'prod']))
        ->assertOk()->assertExactJson(['containers' => [['id' => '1000', 'name' => 'Product']], 'hasMore' => false]);
});

it('paginates GitHub across all accessible repositories and keeps search and status', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repos/acme/api/issues?*' => Http::response([gitHubIssue(1, ['title' => 'Login issue'])]),
        'api.github.com/repos/acme/web/issues?*' => Http::response([gitHubIssue(2, ['title' => 'Login web', 'html_url' => 'https://github.com/acme/web/issues/2', 'repository_url' => 'https://api.github.com/repos/acme/web'])]),
    ]);
    $url = route('poker.imports.preview.store', [$table['game'], 'github']);
    $first = $this->actingAs($table['member'])->postJson($url, ['mode' => 'iteration', 'browse' => true, 'search' => 'login', 'status_id' => 'open'])
        ->assertOk()->assertJsonPath('issues.0.externalId', '9001/1')->assertJsonPath('statuses.0.id', 'open');
    $cursor = $first->json('nextCursor');
    expect($cursor)->toBeString();
    $this->postJson($url, ['mode' => 'iteration', 'browse' => true, 'search' => 'login', 'status_id' => 'open', 'cursor' => $cursor])
        ->assertOk()->assertJsonPath('issues.0.externalId', '9002/2')->assertJsonPath('nextCursor', null);
    Http::assertSent(fn (Request $request) => str_contains($request->url(), '/repos/acme/web/issues?') && str_contains($request->url(), 'state=open'));
});

it('rejects malformed GitHub pagination cursors', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();
    $this->actingAs($table['member'])->postJson(route('poker.imports.preview.store', [$table['game'], 'github']), ['mode' => 'iteration', 'browse' => true, 'cursor' => 'invalid'])
        ->assertUnprocessable()->assertJsonValidationErrors('cursor');
});
