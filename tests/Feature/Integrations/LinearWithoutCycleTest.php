<?php

use App\Enums\IntegrationProvider;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

it('previews all team issues when no Linear cycle is selected', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    fakeLinearGraphql([
        'cycles(' => ['team' => ['cycles' => ['nodes' => []]]],
        'team(id:' => ['team' => ['issues' => [
            'nodes' => [linearTrackerIssue('uuid-1', 'ENG-1')],
            'pageInfo' => ['hasNextPage' => true],
        ]]],
    ]);

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.iterations.index', [$table['game'], 'linear', 'container' => 'team-1']))
        ->assertOk()
        ->assertExactJson([]);

    $this->postJson(route('poker.imports.preview.store', [$table['game'], 'linear']), [
        'mode' => 'iteration',
        'browse' => true,
        'container' => 'team-1',
    ])->assertOk()
        ->assertJsonPath('issues.0.key', 'ENG-1')
        ->assertJsonPath('truncated', true);

    Http::assertSent(fn (Request $request) => data_get($request->data(), 'variables.id') === 'team-1'
        && str_contains($request['query'], 'issues(first: 50')
        && data_get($request->data(), 'variables.filter') === null);
});

it('returns an empty preview when the Linear team has no issues', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    fakeLinearGraphql(['team(id:' => ['team' => ['issues' => [
        'nodes' => [],
        'pageInfo' => ['hasNextPage' => false],
    ]]]]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'linear']), [
            'mode' => 'iteration',
            'browse' => true,
            'container' => 'team-1',
        ])->assertOk()
        ->assertJsonCount(0, 'issues')
        ->assertJsonPath('truncated', false);
});

it('rejects an invalid container filter before contacting Linear', function () {
    $table = trackerTable(IntegrationProvider::Linear);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'linear']), ['mode' => 'iteration', 'browse' => true, 'container' => ['invalid']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('container');

    Http::assertNothingSent();
});
