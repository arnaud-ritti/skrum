<?php

use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * @param  array<int, IntegrationProvider>  $sources
 * @return array{
 *     0: PokerGame,
 *     1: User,
 *     2: PokerPlayer,
 *     3: User,
 *     4: PokerPlayer
 * }
 */
function p12cTable(array $sources, PokerDeck $deck = PokerDeck::Fibonacci): array
{
    disableIntegrations();
    enableIntegrations(...$sources);

    $game = PokerGame::factory()
        ->deck($deck)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 31 estimates']);

    foreach ($sources as $source) {
        $factory = TeamIntegration::factory();
        $connected = $source === IntegrationProvider::Linear ? $factory->linear() : $factory->jira();

        $connected->create(['team_id' => $game->team_id]);
    }

    [$ada, $adaPlayer] = pokerFacilitator($game);
    [$bob, $bobPlayer] = pokerMember($game);

    $ada->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();
    $bob->forceFill(['name' => 'Bob Member', 'locale' => 'en'])->save();

    return [$game, $ada, $adaPlayer, $bob, $bobPlayer];
}

/**
 * @param  array<int, array<string, mixed>>  $issues
 */
function p12cFakeJira(array $issues): void
{
    Http::fake([
        jiraApiUrl('rest/agile/1.0/board/*/sprint*') => Http::response(['values' => [
            ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active'],
        ]]),
        jiraApiUrl('rest/agile/1.0/board*') => Http::response([
            'values' => [['id' => 7, 'name' => 'Web team board']],
            'isLast' => true,
        ]),
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => $issues, 'isLast' => true]),
        jiraApiUrl('rest/api/3/issue/*/editmeta') => Http::response(['fields' => [
            'customfield_10016' => ['name' => 'Story point estimate'],
        ]]),
        jiraApiUrl('rest/api/3/issue/*') => Http::response(null, 204),
        'api.atlassian.com/*' => Http::response(['errorMessages' => ['Unexpected request in a browser test.']], 404),
    ]);
}

/**
 * @param  array<int, array<string, mixed>>  $issues
 */
function p12cFakeLinear(array $issues): void
{
    fakeLinearGraphql([
        'teams(first' => ['teams' => ['nodes' => [['id' => 'team-1', 'name' => 'Engineering']]]],
        'cycles(first' => ['team' => ['cycles' => ['nodes' => [[
            'id' => 'cycle-1',
            'name' => 'Cycle 12',
            'number' => 12,
            'startsAt' => '2026-10-05T00:00:00.000Z',
            'endsAt' => '2026-10-19T00:00:00.000Z',
            'isActive' => true,
        ]]]]],
        'cycle(id' => ['cycle' => ['issues' => ['nodes' => $issues, 'pageInfo' => ['hasNextPage' => false]]]],
        'searchIssues' => ['searchIssues' => ['nodes' => array_slice($issues, 0, 1), 'pageInfo' => ['hasNextPage' => false]]],
        'issues(first' => fn (array $variables): array => ['issues' => ['nodes' => array_values(array_filter(
            $issues,
            fn (array $issue): bool => in_array($issue['id'], (array) ($variables['ids'] ?? []), true),
        ))]],
        'issueEstimationType' => ['issue' => ['team' => ['issueEstimationType' => 'fibonacci', 'issueEstimationAllowZero' => false]]],
        'issueUpdate(' => ['issueUpdate' => ['success' => true]],
    ]);
}

/**
 * @param  array<string, mixed>  $attributes
 */
function p12cJiraTask(PokerGame $game, string $id, string $key, string $title, array $attributes = []): PokerTask
{
    return importedPokerTask($game, [
        'title' => $title,
        'external_id' => $id,
        'external_key' => $key,
        'external_url' => "https://acme.atlassian.net/browse/{$key}",
        ...$attributes,
    ]);
}

/**
 * @param  array<string, mixed>  $attributes
 */
function p12cLinearTask(PokerGame $game, string $id, string $key, string $title, array $attributes = []): PokerTask
{
    return importedPokerTask($game, [
        'title' => $title,
        'external_id' => $id,
        'external_key' => $key,
        'external_url' => "https://linear.app/acme/issue/{$key}",
        ...$attributes,
    ], IntegrationProvider::Linear);
}

function p12cRevealedRound(PokerGame $game, PokerTask $task, PokerPlayer $first, PokerPlayer $second, string $value): void
{
    $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);

    pokerVote($round, $first, $value);
    pokerVote($round, $second, $value);

    $game->forceFill(['current_task_id' => $task->id])->save();
}

function p12cShowJiraSprintIssues(mixed $page): mixed
{
    $page->assertSee('Import')
        ->click('Import')
        ->assertSee('Import tasks')
        ->assertVisible('[aria-label="Choose a board"]')
        ->click('[aria-label="Choose a board"]')
        ->click('[role="option"]:has-text("Web team board")')
        ->assertEnabled('[aria-label="Choose a sprint"]')
        ->click('[aria-label="Choose a sprint"]')
        ->click('[role="option"]:has-text("Sprint 31")')
        ->assertButtonEnabled('Show issues')
        ->click('Show issues');

    return $page;
}

it('[P12c-01] offers the import from Jira and from Linear in a game of a connected team', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Jira, IntegrationProvider::Linear]);
    p12cFakeJira([]);
    p12cFakeLinear([]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Fibonacci')
        ->assertSee('Import')
        ->click('Import')
        ->assertSee('Import tasks')
        ->assertVisible('[aria-label="Source"] button:has-text("Jira")')
        ->assertVisible('[aria-label="Source"] button:has-text("Linear")')
        ->assertVisible('[role="group"][aria-label="Import from Jira"]')
        ->assertVisible('[aria-label="Choose a board"]')
        ->click('[aria-label="Source"] button:has-text("Linear")')
        ->assertVisible('[role="group"][aria-label="Import from Linear"]')
        ->assertVisible('[aria-label="Choose a team"]')
        ->click('Cancel')
        ->assertNotPresent('[role="dialog"]');

    expect(PokerTask::query()->where('poker_game_id', $game->id)->count())->toBe(0);
});

it('[P12c-02a] imports an active Jira sprint in sprint order with the issue keys', function () {
    [$game, $ada, , $bob] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page']),
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => 'Payment retries']),
    ]);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    p12cShowJiraSprintIssues($facilitator)
        ->assertNotPresent('[aria-label="Source"]')
        ->assertAttribute('[role="dialog"] [role="checkbox"][aria-label="PROJ-1"]', 'aria-checked', 'true')
        ->assertAttribute('[role="dialog"] [role="checkbox"][aria-label="PROJ-2"]', 'aria-checked', 'true')
        ->assertSeeIn('[role="dialog"] li:has-text("PROJ-1")', 'Checkout page')
        ->assertSeeIn('[role="dialog"] li:has-text("PROJ-1")', 'Jane Doe')
        ->click('Import 2 tasks')
        ->assertSee('2 imported, 0 skipped.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 2)
        ->assertScript(pokerTaskTitlesScript(), 'Checkout page / Payment retries')
        ->assertPresent('[data-test="poker-task-row"]:has-text("Checkout page") [data-slot="badge"]:text-is("PROJ-1")')
        ->assertPresent('[data-test="poker-task-row"]:has-text("Payment retries") [data-slot="badge"]:text-is("PROJ-2")');

    $member->assertCount('@poker-task-row', 2)
        ->assertScript(pokerTaskTitlesScript(), 'Checkout page / Payment retries')
        ->assertPresent('[data-test="poker-task-row"]:has-text("Checkout page") [data-slot="badge"]:text-is("PROJ-1")');

    $facilitator->click('Checkout page')
        ->assertPresent('section[aria-labelledby^="poker-task-"] a[href="https://acme.atlassian.net/browse/PROJ-1"]')
        ->assertSee('Assignee: Jane Doe')
        ->assertSee('Jira estimate: 3');

    Http::assertSent(fn (Request $request): bool => str_ends_with($request->url(), '/rest/api/3/search/jql')
        && $request['jql'] === 'sprint = 31 ORDER BY Rank ASC');

    expect(PokerTask::query()->where('poker_game_id', $game->id)->orderBy('position')->pluck('external_key')->all())
        ->toBe(['PROJ-1', 'PROJ-2'])
        ->and(PokerTask::query()->where('poker_game_id', $game->id)->pluck('external_source')->unique()->all())
        ->toBe(['jira']);
});

it('[P12c-02b] shows the issues of a sprint imported before as already imported', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page']),
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => 'Payment retries']),
    ]);
    p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page');
    p12cJiraTask($game, '10002', 'PROJ-2', 'Payment retries');

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    p12cShowJiraSprintIssues($page)
        ->assertCount('[role="dialog"] li:has-text("Already imported")', 2)
        ->assertDisabled('[role="dialog"] [role="checkbox"][aria-label="PROJ-1"]')
        ->assertDisabled('[role="dialog"] [role="checkbox"][aria-label="PROJ-2"]')
        ->assertButtonDisabled('Import 0 tasks')
        ->click('Cancel')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 2);

    expect(PokerTask::query()->where('poker_game_id', $game->id)->count())->toBe(2);
});

it('[P12c-03a] imports a Linear cycle after switching the source', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Jira, IntegrationProvider::Linear]);
    p12cFakeJira([]);
    p12cFakeLinear([
        linearTrackerIssue('lin-1', 'ENG-1', ['title' => 'Login form']),
        linearTrackerIssue('lin-2', 'ENG-2', ['title' => 'Signup form']),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Import')
        ->click('Import')
        ->assertVisible('[aria-label="Source"] button:has-text("Linear")')
        ->click('[aria-label="Source"] button:has-text("Linear")')
        ->assertVisible('[aria-label="Choose a team"]')
        ->click('[aria-label="Choose a team"]')
        ->click('[role="option"]:has-text("Engineering")')
        ->assertEnabled('[aria-label="Choose a cycle"]')
        ->click('[aria-label="Choose a cycle"]')
        ->click('[role="option"]:has-text("Cycle 12")')
        ->assertButtonEnabled('Show issues')
        ->click('Show issues')
        ->assertAttribute('[role="dialog"] [role="checkbox"][aria-label="ENG-1"]', 'aria-checked', 'true')
        ->assertSeeIn('[role="dialog"] li:has-text("ENG-2")', 'Signup form')
        ->click('Import 2 tasks')
        ->assertSee('2 imported, 0 skipped.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 2)
        ->assertScript(pokerTaskTitlesScript(), 'Login form / Signup form')
        ->assertPresent('[data-test="poker-task-row"]:has-text("Login form") [data-slot="badge"]:text-is("ENG-1")')
        ->assertPresent('[data-test="poker-task-row"]:has-text("Signup form") [data-slot="badge"]:text-is("ENG-2")');

    Http::assertSent(fn (Request $request): bool => str_contains((string) data_get($request->data(), 'query'), 'cycle(id')
        && data_get($request->data(), 'variables.id') === 'cycle-1');

    expect(PokerTask::query()->where('poker_game_id', $game->id)->orderBy('position')->pluck('external_key')->all())
        ->toBe(['ENG-1', 'ENG-2'])
        ->and(PokerTask::query()->where('poker_game_id', $game->id)->pluck('external_source')->unique()->all())
        ->toBe(['linear']);
});

it('[P12c-03b] imports the result of a Linear search', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Linear]);
    p12cFakeLinear([
        linearTrackerIssue('lin-1', 'ENG-1', ['title' => 'Login form']),
        linearTrackerIssue('lin-2', 'ENG-2', ['title' => 'Signup form']),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Import')
        ->click('Import')
        ->assertSee('Import tasks')
        ->assertNotPresent('[aria-label="Source"]')
        ->click('[role="dialog"] button:has-text("Query")')
        ->assertVisible('#import-query')
        ->fill('#import-query', 'login')
        ->assertButtonEnabled('Show issues')
        ->click('Show issues')
        ->assertCount('[role="dialog"] [role="checkbox"][aria-label^="ENG-"]', 1)
        ->assertSeeIn('[role="dialog"] li:has-text("ENG-1")', 'Login form')
        ->click('Import 1 task')
        ->assertSee('1 imported, 0 skipped.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 1)
        ->assertPresent('[data-test="poker-task-row"]:has-text("Login form") [data-slot="badge"]:text-is("ENG-1")');

    Http::assertSent(fn (Request $request): bool => str_contains((string) $request['query'], 'searchIssues')
        && data_get($request->data(), 'variables.term') === 'login');

    expect(PokerTask::query()->where('poker_game_id', $game->id)->pluck('external_key')->all())->toBe(['ENG-1']);
});

it('[P12c-03c] shows the source link, the assignee and the source estimate of an imported task, which cannot be edited', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Linear]);
    p12cLinearTask($game, 'lin-1', 'ENG-1', 'Login form', [
        'description' => 'About **ENG-1**',
        'external_assignee' => 'Sam Lee',
        'external_estimate' => '2',
    ]);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Manual task']);
    $link = 'section[aria-labelledby^="poker-task-"] a[href="https://linear.app/acme/issue/ENG-1"]';

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertCount('@poker-task-row', 2)
        ->click('Login form')
        ->assertPresent($link)
        ->assertSeeIn($link, 'ENG-1')
        ->assertAttribute($link, 'target', '_blank')
        ->assertSee('Assignee: Sam Lee')
        ->assertSee('Linear estimate: 2')
        ->assertSee('The title and description are managed in Linear. Refresh the tasks to update them.')
        ->assertNotPresent('[aria-label="Edit task"]')
        ->assertVisible('[aria-label="Delete task"]');

    $page->click('Manual task')
        ->assertVisible('[aria-label="Edit task"]')
        ->assertNotPresent($link)
        ->assertDontSee('managed in Linear');
});

it('[P12c-08] shows a guest the key chips only, without import, assignee or sync state', function () {
    [$game, , , $bob] = p12cTable([IntegrationProvider::Jira]);
    $task = p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page', [
        'external_assignee' => 'Jane Doe',
        'external_estimate' => '3',
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now(),
        'synced_at' => now(),
    ]);
    openPokerRound($game, $task);
    $link = 'section[aria-labelledby^="poker-task-"] a[href="https://acme.atlassian.net/browse/PROJ-1"]';

    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $member->assertPresent('[data-test="poker-task-row"]:has-text("Checkout page") [data-slot="badge"]:text-is("PROJ-1")')
        ->assertPresent($link)
        ->assertSee('Assignee: Jane Doe')
        ->assertSee('Jira estimate: 3')
        ->assertSee('Synced to Jira')
        ->assertVisible('button:has-text("Import")');

    $guest->assertPresent('[data-test="poker-task-row"]:has-text("Checkout page") [data-slot="badge"]:text-is("PROJ-1")')
        ->assertPresent($link)
        ->assertNotPresent('button:has-text("Import")')
        ->assertNotPresent('[aria-label="More task actions"]')
        ->assertDontSee('Jane Doe')
        ->assertDontSee('Jira estimate')
        ->assertDontSee('Synced to Jira')
        ->assertDontSee('Sync pending');

    expect(data_get($this->snapshotOf($guest, "/poker/{$game->id}/snapshot"), 'tasks.0.external'))->toBe([
        'source' => 'jira',
        'key' => 'PROJ-1',
        'url' => 'https://acme.atlassian.net/browse/PROJ-1',
        'type' => null,
        'labels' => [],
        'isManaged' => true,
    ]);
});

it('[P12c-04] writes a saved estimate back to Jira and shows it pending, then synced', function () {
    config(['queue.default' => 'database']);
    [$game, $ada, $adaPlayer, $bob, $bobPlayer] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([]);
    $task = p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page');
    p12cRevealedRound($game, $task, $adaPlayer, $bobPlayer, '5');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '5')
        ->assertSee('Validate 5')
        ->click('@poker-validate')
        ->assertSee('Estimate: 5')
        ->assertSee('Sync pending');

    $member->assertSee('Estimate: 5')
        ->assertSee('Sync pending');

    Http::assertNothingSent();

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($task->refresh()->needs_sync)->toBeTrue();

    $this->workQueue();

    $facilitator->assertSee('Synced to Jira')
        ->assertDontSee('Sync pending')
        ->assertSee('Sync again');

    $member->assertSee('Synced to Jira')
        ->assertDontSee('Sync pending');

    Http::assertSent(fn (Request $request): bool => $request->method() === 'PUT'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001')
        && $request->data() == ['fields' => ['customfield_10016' => 5.0]]);

    expect($task->refresh()->needs_sync)->toBeFalse()
        ->and($task->synced_at)->not->toBeNull()
        ->and($task->sync_error)->toBeNull();
});

it('[P12c-05a] shows a failed sync for a half point on a Linear task and syncs a whole number', function () {
    config(['queue.default' => 'database']);
    [$game, $ada, $adaPlayer, , $bobPlayer] = p12cTable([IntegrationProvider::Linear], PokerDeck::ModifiedFibonacci);
    p12cFakeLinear([]);
    $task = p12cLinearTask($game, 'lin-1', 'ENG-1', 'Login form');
    p12cRevealedRound($game, $task, $adaPlayer, $bobPlayer, '½');

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '½')
        ->assertSee('Validate ½')
        ->click('@poker-validate')
        ->assertSee('Estimate: ½')
        ->assertSee('Sync pending');

    $this->workQueue();

    $page->assertSee('Sync failed')
        ->assertSee('Linear only accepts whole-number estimates.')
        ->assertVisible('section[aria-labelledby^="poker-task-"] button:has-text("Retry")');

    Http::assertNotSent(fn (Request $request): bool => str_contains((string) $request['query'], 'issueUpdate('));

    expect($task->refresh()->sync_error)->toBe('Linear only accepts whole-number estimates.')
        ->and($task->needs_sync)->toBeTrue();

    $page->click('[aria-label="Final estimate"] [aria-label="8"]')
        ->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '8')
        ->assertSee('Validate 8')
        ->click('@poker-validate')
        ->assertSee('Estimate: 8')
        ->assertSee('Sync pending');

    $this->workQueue();

    $page->assertSee('Synced to Linear')
        ->assertDontSee('Sync failed')
        ->assertDontSee('Linear only accepts whole-number estimates.');

    Http::assertSent(fn (Request $request): bool => str_contains((string) $request['query'], 'issueUpdate(')
        && data_get($request->data(), 'variables.id') === 'lin-1'
        && data_get($request->data(), 'variables.estimate') === 8);

    expect($task->refresh()->needs_sync)->toBeFalse()
        ->and($task->sync_error)->toBeNull();
});

it('[P12c-05b] retries a failed write-back and can force a synced estimate again', function () {
    config(['queue.default' => 'database']);
    [$game, $ada] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([]);
    $task = p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page', [
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now(),
        'needs_sync' => true,
        'sync_error' => 'Jira is not responding. Try again later.',
    ]);
    openPokerRound($game, $task);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Sync failed')
        ->assertSee('Jira is not responding. Try again later.')
        ->click('Retry')
        ->assertSee('Sync requested.')
        ->assertSee('Sync pending')
        ->assertDontSee('Jira is not responding. Try again later.');

    $this->workQueue();

    $page->assertSee('Synced to Jira')
        ->assertSee('Sync again')
        ->click('Sync again')
        ->assertSee('Sync pending');

    $this->workQueue();

    $page->assertSee('Synced to Jira')
        ->assertDontSee('Sync pending');

    expect(Http::recorded(fn (Request $request): bool => $request->method() === 'PUT'
        && $request->data() == ['fields' => ['customfield_10016' => 5.0]]))->toHaveCount(2)
        ->and($task->refresh()->needs_sync)->toBeFalse();
});

it('[P12c-06] does not write a T-shirt estimate to Jira and says why', function () {
    config(['queue.default' => 'database']);
    [$game, $ada, $adaPlayer, , $bobPlayer] = p12cTable([IntegrationProvider::Jira], PokerDeck::Tshirt);
    p12cFakeJira([]);
    $task = p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page');
    p12cRevealedRound($game, $task, $adaPlayer, $bobPlayer, 'M');

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', 'M')
        ->assertSee('Validate M')
        ->click('@poker-validate')
        ->assertSee('Estimate: M')
        ->assertSee("Not synced: T-shirt estimates can't be written to Jira.")
        ->assertDontSee('Sync pending')
        ->assertNotPresent('section[aria-labelledby^="poker-task-"] button:has-text("Retry")');

    Http::assertNothingSent();

    expect(DB::table('jobs')->count())->toBe(0)
        ->and($task->refresh()->estimate)->toBe('M')
        ->and($task->needs_sync)->toBeFalse();
});

it('[P12c-07a] takes a title changed in Jira when the tasks are refreshed', function () {
    [$game, $ada, , $bob] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page, second version']),
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => 'Payment retries']),
    ]);
    $renamed = p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page');
    p12cJiraTask($game, '10002', 'PROJ-2', 'Payment retries');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertScript(pokerTaskTitlesScript(), 'Checkout page / Payment retries')
        ->assertVisible('[aria-label="More task actions"]')
        ->click('[aria-label="More task actions"]')
        ->assertSee('Refresh from Jira')
        ->click('Refresh from Jira')
        ->assertSee('2 tasks refreshed.')
        ->assertScript(pokerTaskTitlesScript(), 'Checkout page, second version / Payment retries')
        ->assertDontSee('were not found in Jira');

    $member->assertScript(pokerTaskTitlesScript(), 'Checkout page, second version / Payment retries');

    Http::assertSent(fn (Request $request): bool => str_ends_with($request->url(), '/rest/api/3/search/jql')
        && str_starts_with((string) $request['jql'], 'id in (')
        && str_contains((string) $request['jql'], '10001')
        && str_contains((string) $request['jql'], '10002'));

    expect($renamed->refresh()->title)->toBe('Checkout page, second version');
});

it('[P12c-07b] says that a task was not found when its issue was deleted in Jira', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page']),
    ]);
    p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page');
    $deleted = p12cJiraTask($game, '10002', 'PROJ-2', 'Payment retries');
    openPokerRound($game, $deleted);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertDontSee('Not found in Jira')
        ->assertVisible('[aria-label="More task actions"]')
        ->click('[aria-label="More task actions"]')
        ->assertSee('Refresh from Jira')
        ->click('Refresh from Jira')
        ->assertSee('1 task refreshed.')
        ->assertSee('1 task was not found in Jira.')
        ->assertSeeIn('section[aria-labelledby^="poker-task-"]', 'Not found in Jira')
        ->assertCount('@poker-task-row', 2)
        ->assertScript(pokerTaskTitlesScript(), 'Checkout page / Payment retries');

    expect($deleted->refresh()->external_missing_at)->not->toBeNull()
        ->and($deleted->title)->toBe('Payment retries');
});
