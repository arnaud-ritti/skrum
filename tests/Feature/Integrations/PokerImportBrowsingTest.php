<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\TeamRole;
use App\Models\PokerPlayer;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('lists boards, sprints and sprint issues for players who can add tasks', function () {
    $table = trackerTable();
    fakeJiraTrackerApi();
    importedPokerTask($table['game'], ['external_id' => '10001', 'external_key' => 'PROJ-1']);

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.containers.index', [$table['game'], 'jira', 'q' => 'Sweep']))
        ->assertOk()
        ->assertExactJson(['containers' => [['id' => '7', 'name' => 'Sweep scrum board']], 'hasMore' => false]);

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.iterations.index', [$table['game'], 'jira', 'container' => '7']))
        ->assertOk()
        ->assertJsonPath('0.id', '31')
        ->assertJsonPath('0.name', 'Sprint 31')
        ->assertJsonPath('0.state', 'active');

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'jira']), ['mode' => 'iteration', 'iteration_id' => '31'])
        ->assertOk()
        ->assertJsonPath('truncated', false)
        ->assertJsonPath('issues.0.key', 'PROJ-1')
        ->assertJsonPath('issues.0.alreadyImported', true)
        ->assertJsonPath('issues.1.key', 'PROJ-2')
        ->assertJsonPath('issues.1.alreadyImported', false);

    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'name=Sweep'));
    Http::assertSent(fn (Request $request) => ($request['jql'] ?? null) === 'sprint = 31 ORDER BY Rank ASC');
});

it('previews a JQL query and surfaces Jira errors', function () {
    $table = trackerTable();
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::sequence()
        ->push(['issues' => array_map(fn (int $n) => jiraTrackerIssue((string) (10000 + $n), "PROJ-{$n}"), range(1, 100)), 'nextPageToken' => 'more'])
        ->push(['errorMessages' => ["Error in the JQL Query: 'project' is a reserved word."]], 400)]);
    $url = route('poker.imports.preview.store', [$table['game'], 'jira']);

    $this->actingAs($table['member'])->postJson($url, ['mode' => 'iteration'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('iteration_id');

    $this->actingAs($table['member'])->postJson($url, ['mode' => 'query', 'query' => 'project = PROJ'])
        ->assertOk()
        ->assertJsonCount(100, 'issues')
        ->assertJsonPath('truncated', true);

    $this->actingAs($table['member'])->postJson($url, ['mode' => 'query', 'query' => 'project ='])
        ->assertUnprocessable()
        ->assertJsonPath('message', "Error in the JQL Query: 'project' is a reserved word.");

    Http::assertSent(fn (Request $request) => $request['jql'] === 'project = PROJ');
});

it('previews a Linear cycle', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    fakeLinearGraphql(['cycle(' => ['cycle' => ['issues' => [
        'nodes' => [linearTrackerIssue('uuid-1', 'ENG-1')],
        'pageInfo' => ['hasNextPage' => false],
    ]]]]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'linear']), ['mode' => 'iteration', 'iteration_id' => 'cycle-1'])
        ->assertOk()
        ->assertJsonPath('issues.0.key', 'ENG-1')
        ->assertJsonPath('issues.0.estimate', '2')
        ->assertJsonPath('issues.0.assignee', 'Sam Lee');
});

it('refuses guests and ended games', function () {
    $table = trackerTable();
    $guest = pokerGuest($table['game']);
    $url = route('poker.imports.containers.index', [$table['game'], 'jira']);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()->getJson($url)->assertForbidden();

    $table['game']->forceFill(['ended_at' => now()])->save();

    $this->actingAs($table['member'])->getJson($url)->assertForbidden();

    Http::assertNothingSent();
});

it('refuses a team observer who does not facilitate the game', function (string $method, string $routeName, array $query, array $payload) {
    $table = trackerTable();
    $observer = teamMember($table['game']->team, TeamRole::Observer);
    PokerPlayer::factory()->create(['poker_game_id' => $table['game']->id, 'user_id' => $observer->id, 'is_spectator' => true]);

    $this->actingAs($observer)
        ->json($method, route($routeName, [$table['game'], 'jira', ...$query]), $payload)
        ->assertForbidden();

    Http::assertNothingSent();
})->with([
    'containers' => ['GET', 'poker.imports.containers.index', [], []],
    'iterations' => ['GET', 'poker.imports.iterations.index', ['container' => '1'], []],
    'preview' => ['POST', 'poker.imports.preview.store', [], ['mode' => 'query', 'query' => 'project = PROJ']],
    'import' => ['POST', 'poker.imports.store', [], ['external_ids' => ['10001']]],
]);

it('answers 404 for a disabled provider and 409 without an active connection', function () {
    $table = trackerTable();
    $url = fn (string $source) => route('poker.imports.containers.index', [$table['game'], $source]);

    $this->actingAs($table['member'])->getJson($url('linear'))->assertNotFound();

    enableIntegrations(IntegrationProvider::Linear);

    $this->actingAs($table['member'])->getJson($url('linear'))
        ->assertConflict()
        ->assertJsonPath('message', 'Connect Linear in the team settings.');

    $table['integration']->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();

    $this->actingAs($table['member'])->getJson($url('jira'))
        ->assertConflict()
        ->assertJsonPath('message', 'Reconnect Jira in the team settings.');

    $this->actingAs($table['member'])->getJson(route('poker.imports.containers.index', [$table['game'], 'github']))->assertNotFound();

    Http::assertNothingSent();
});

it('throttles browsing at 30 requests a minute per player', function () {
    $table = trackerTable();
    fakeJiraTrackerApi();
    $url = route('poker.imports.containers.index', [$table['game'], 'jira']);

    foreach (range(1, 30) as $attempt) {
        $this->actingAs($table['member'])->getJson($url)->assertOk();
    }

    $this->actingAs($table['member'])->getJson($url)
        ->assertTooManyRequests()
        ->assertJsonPath('message', 'Too many requests, wait a moment.');

    $this->actingAs($table['facilitator'])->getJson($url)->assertOk();
});
