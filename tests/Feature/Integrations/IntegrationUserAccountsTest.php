<?php

use App\Models\TeamIntegration;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use App\Support\Integrations\Linear\LinearPriority;
use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('accepts only one active Atlassian account with the same email', function (array $results, ?string $expected) {
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response($results)]);

    $matches = app(IntegrationUserAccounts::class)->matchEmails(TeamIntegration::factory()->jira()->create(), ['Ada@Example.com']);

    expect(($matches['ada@example.com'] ?? null)?->id)->toBe($expected);
})->with([
    'one account' => [[jiraAccount('acc-1', 'Ada')], 'acc-1'],
    'same email shown' => [[jiraAccount('acc-1', 'Ada', 'ada@example.com')], 'acc-1'],
    'no account' => [[], null],
    'two accounts' => [[jiraAccount('acc-1', 'Ada'), jiraAccount('acc-2', 'Ada L.')], null],
    'inactive' => [[jiraAccount('acc-1', 'Ada', active: false)], null],
    'app account' => [[jiraAccount('acc-1', 'Bot', type: 'app')], null],
    'different email' => [[jiraAccount('acc-1', 'Ada', 'ada@other.com')], null],
]);

it('searches Jira by email with two results at most', function () {
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response([])]);

    app(IntegrationUserAccounts::class)->matchEmails(TeamIntegration::factory()->jira()->create(), ['ada@example.com']);

    Http::assertSent(fn (HttpClientRequest $request) => str_contains($request->url(), 'rest/api/3/user/search')
        && $request['query'] === 'ada@example.com'
        && (int) $request['maxResults'] === 2);
});

it('matches Linear users in memory across every page', function () {
    fakeLinearUserDirectoryGraphql(['users(' => function (HttpClientRequest $request) {
        return ((array) $request['variables'])['after'] === null
            ? Http::response(['data' => ['users' => [
                'nodes' => [linearAccount('lin-1', 'Ada Lovelace', 'ADA@example.com'), linearAccount('lin-2', 'Old Ada', 'ada@example.com', active: false)],
                'pageInfo' => ['hasNextPage' => true, 'endCursor' => 'cursor-1'],
            ]]])
            : Http::response(['data' => ['users' => [
                'nodes' => [linearAccount('lin-3', 'Grace Hopper', 'grace@example.com'), linearAccount('lin-4', 'Grace H.', 'grace@example.com')],
                'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
            ]]]);
    }]);

    $matches = app(IntegrationUserAccounts::class)->matchEmails(TeamIntegration::factory()->linear()->create(), ['ada@example.com', 'grace@example.com', 'none@example.com']);

    expect(array_keys($matches))->toBe(['ada@example.com'])
        ->and($matches['ada@example.com']->id)->toBe('lin-1')
        ->and($matches['ada@example.com']->displayName)->toBe('Ada Lovelace');

    Http::assertSentCount(2);
    Http::assertNotSent(fn (HttpClientRequest $request) => str_contains($request->body(), 'example.com'));
});

it('finds accounts by id and reports inactive or unknown ones', function () {
    Http::fake([
        jiraApiUrl('rest/api/3/user?accountId=acc-1') => Http::response(jiraAccount('acc-1', 'Ada')),
        jiraApiUrl('rest/api/3/user?accountId=acc-2') => Http::response(jiraAccount('acc-2', 'Gone', active: false)),
        jiraApiUrl('rest/api/3/user?accountId=acc-3') => Http::response(['errorMessages' => ['Not found']], 404),
    ]);
    $jira = TeamIntegration::factory()->jira()->create();
    $accounts = app(IntegrationUserAccounts::class);

    expect($accounts->find($jira, 'acc-1')?->active)->toBeTrue()
        ->and($accounts->find($jira, 'acc-2')?->active)->toBeFalse()
        ->and($accounts->find($jira, 'acc-3'))->toBeNull();

    fakeLinearUserDirectoryGraphql(['user(' => ['user' => null]]);

    expect($accounts->find(TeamIntegration::factory()->linear()->create(), 'lin-9'))->toBeNull();
});

it('sends a Jira account id as an encoded query value only', function () {
    Http::fake([jiraApiUrl('rest/api/3/user*') => Http::response(['errorMessages' => ['Not found']], 404)]);

    app(IntegrationUserAccounts::class)->find(TeamIntegration::factory()->jira()->create(), '../../myself?x=1&accountId=other');

    Http::assertSent(fn (HttpClientRequest $request) => str_starts_with($request->url(), 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/user?')
        && $request['accountId'] === '../../myself?x=1&accountId=other'
        && ! str_contains($request->url(), '?x=1'));
});

it('searches active accounts without emails', function () {
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response([
        jiraAccount('acc-1', 'Ada', 'ada@example.com'),
        jiraAccount('acc-2', 'Adam', active: false),
        jiraAccount('acc-3', 'Automation', type: 'app'),
    ])]);

    $found = app(IntegrationUserAccounts::class)->search(TeamIntegration::factory()->jira()->create(), 'ada');

    expect(array_map(fn (ExternalAccount $account): array => $account->toArray(), $found))->toBe([
        ['accountId' => 'acc-1', 'displayName' => 'Ada'],
    ]);

    fakeLinearUserDirectoryGraphql(['users(' => ['users' => [
        'nodes' => [
            linearAccount('lin-1', 'Ada Lovelace', 'ada@example.com'),
            linearAccount('lin-2', 'Grace Hopper', 'grace@ada.dev'),
            linearAccount('lin-3', 'Ada Old', 'old@example.com', active: false),
            linearAccount('lin-4', 'Alan Turing', 'alan@example.com'),
        ],
        'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
    ]]]);

    $linear = app(IntegrationUserAccounts::class)->search(TeamIntegration::factory()->linear()->create(), 'ADA');

    expect(array_map(fn (ExternalAccount $account): string => $account->id, $linear))->toBe(['lin-1', 'lin-2']);
});

it('describes the Linear priority scale', function () {
    expect(LinearPriority::options())->toBe([
        ['id' => 0, 'name' => 'No priority'],
        ['id' => 1, 'name' => 'Urgent'],
        ['id' => 2, 'name' => 'High'],
        ['id' => 3, 'name' => 'Medium'],
        ['id' => 4, 'name' => 'Low'],
    ])->and(LinearPriority::Defaults)->toBe(['high' => 2, 'medium' => 3, 'low' => 4]);
});

it('stops reading the Linear directory when the cursor repeats', function () {
    fakeLinearUserDirectoryGraphql(['users(' => ['users' => [
        'nodes' => [linearAccount('lin-1', 'Ada Lovelace', 'ada@example.com')],
        'pageInfo' => ['hasNextPage' => true, 'endCursor' => 'same-cursor'],
    ]]]);

    $users = app(IntegrationUserAccounts::class)->linearUsers(TeamIntegration::factory()->linear()->create());

    expect($users)->toHaveCount(2);
    Http::assertSentCount(2);
});

it('caps the Linear directory at forty pages', function () {
    $page = 0;
    fakeLinearUserDirectoryGraphql(['users(' => function () use (&$page) {
        $page++;

        return Http::response(['data' => ['users' => [
            'nodes' => [linearAccount("lin-{$page}", 'Ada', "ada{$page}@example.com")],
            'pageInfo' => ['hasNextPage' => true, 'endCursor' => "cursor-{$page}"],
        ]]]);
    }]);

    app(IntegrationUserAccounts::class)->linearUsers(TeamIntegration::factory()->linear()->create());

    Http::assertSentCount(40);
});

it('never serializes the account email', function () {
    $account = new ExternalAccount('acc-1', 'Ada', true, 'ada@example.com');

    expect(json_encode($account))->toBe('{"accountId":"acc-1","displayName":"Ada"}')
        ->and(json_encode([$account]))->not->toContain('ada@example.com');
});
