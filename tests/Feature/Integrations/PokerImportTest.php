<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Poker\PokerGameChanged;
use App\Models\PokerTask;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('imports the selected Jira issues in the given order from the source', function () {
    Event::fake([PokerGameChanged::class]);
    $table = trackerTable();
    PokerTask::factory()->create(['poker_game_id' => $table['game']->id, 'title' => 'Existing']);
    fakeJiraTrackerApi([
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => str_repeat('T', 300)]),
        jiraTrackerIssue('10001', 'PROJ-1', ['customfield_10016' => 0.5]),
    ]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001', '10002'], 'title' => 'Client title'])
        ->assertCreated()
        ->assertExactJson(['imported' => 2, 'skipped' => 0]);

    $tasks = $table['game']->tasks()->orderBy('position')->get();

    expect($tasks->pluck('external_key')->all())->toBe([null, 'PROJ-1', 'PROJ-2'])
        ->and($tasks[1]->title)->toBe('Story PROJ-1')
        ->and($tasks[1]->description)->toBe('About PROJ-1')
        ->and($tasks[1]->only(['external_source', 'external_id', 'external_site', 'external_url', 'external_assignee', 'external_estimate']))->toBe([
            'external_source' => 'jira',
            'external_id' => '10001',
            'external_site' => 'cloud-1',
            'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
            'external_assignee' => 'Jane Doe',
            'external_estimate' => '0.5',
        ])
        ->and($tasks[1]->external_refreshed_at)->not->toBeNull()
        ->and($tasks[1]->estimate)->toBeNull()
        ->and(mb_strlen($tasks[2]->title))->toBe(200);

    Http::assertSent(fn (Request $request) => $request['jql'] === 'id in (10001,10002)');
    Event::assertDispatched(fn (PokerGameChanged $event) => $event->gameId === $table['game']->id);
});

it('skips issues already imported and issues the source no longer returns', function () {
    $table = trackerTable();
    importedPokerTask($table['game'], ['external_id' => '10001', 'external_key' => 'PROJ-1']);
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1'), jiraTrackerIssue('10002', 'PROJ-2')]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001', '10002', '10404']])
        ->assertCreated()
        ->assertExactJson(['imported' => 1, 'skipped' => 2]);

    expect($table['game']->tasks()->count())->toBe(2);
});

it('refuses a batch that would exceed 200 tasks without importing any', function () {
    $table = trackerTable();
    PokerTask::factory()->count(199)->create(['poker_game_id' => $table['game']->id]);
    fakeJiraTrackerApi();

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001', '10002']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['external_ids' => 'This game can hold 200 tasks at most.']);

    expect($table['game']->tasks()->count())->toBe(199);
});

it('renders imported descriptions safely and trims long titles and descriptions', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    fakeLinearGraphql(['issues(' => ['issues' => ['nodes' => [
        linearTrackerIssue('uuid-1', 'ENG-1', ['description' => "<script>alert(1)</script>\n\n![pixel](https://tracker.example/pixel.png)"]),
        linearTrackerIssue('uuid-2', 'ENG-2', ['description' => str_repeat('b', 10050), 'title' => str_repeat('L', 250)]),
    ]]]]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'linear']), ['external_ids' => ['uuid-1', 'uuid-2']])
        ->assertCreated()
        ->assertExactJson(['imported' => 2, 'skipped' => 0]);

    $html = $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))->json('tasks.0.descriptionHtml');
    $long = $table['game']->tasks()->where('external_id', 'uuid-2')->sole();

    expect($html)->not->toContain('<script')->not->toContain('<img')
        ->and($html)->toContain('https://tracker.example/pixel.png')
        ->and((string) $long->description)->toHaveLength(10000)
        ->and($long->description)->toEndWith('…')
        ->and($long->title)->toHaveLength(200)
        ->and($long->external_site)->toBe('org-1')
        ->and($long->external_url)->toBe('https://linear.app/acme/issue/ENG-2');
});

it('counts an import against the tracker browse limit of the person', function () {
    $table = trackerTable();
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1')]);

    foreach (range(1, TrackerBrowseLimit::MaxAttempts) as $attempt) {
        TrackerBrowseLimit::hit($table['member']->id);
    }

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001']])
        ->assertTooManyRequests();

    expect($table['game']->tasks()->count())->toBe(0);
    Http::assertNothingSent();
});

it('refuses guests, ended games and malformed selections', function () {
    $table = trackerTable();
    $guest = pokerGuest($table['game']);
    $url = route('poker.imports.store', [$table['game'], 'jira']);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()->postJson($url, ['external_ids' => ['10001']])->assertForbidden();

    $this->actingAs($table['member'])->postJson($url, ['external_ids' => []])->assertJsonValidationErrors('external_ids');
    $this->actingAs($table['member'])->postJson($url, ['external_ids' => array_map(strval(...), range(1, 101))])->assertJsonValidationErrors('external_ids');
    $this->actingAs($table['member'])->postJson($url, ['external_ids' => ['1', '1']])->assertJsonValidationErrors('external_ids.0');

    $table['game']->forceFill(['ended_at' => now()])->save();

    $this->actingAs($table['member'])->postJson($url, ['external_ids' => ['10001']])->assertForbidden();

    Http::assertNothingSent();
});

it('refreshes imported tasks from the source and reports missing issues', function () {
    Event::fake([PokerGameChanged::class]);
    $table = trackerTable();
    $kept = importedPokerTask($table['game'], [
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'title' => 'Old title',
        'estimate' => '8',
        'estimate_numeric' => 8,
        'external_refreshed_at' => now()->subDay(),
    ]);
    $gone = importedPokerTask($table['game'], ['external_id' => '10002', 'external_key' => 'PROJ-2', 'title' => 'Deleted in Jira']);
    $otherSite = importedPokerTask($table['game'], ['external_id' => '10003', 'external_key' => 'PROJ-3', 'external_site' => 'cloud-9', 'title' => 'Other site']);
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'New title', 'assignee' => ['displayName' => 'Ann'], 'customfield_10016' => 13])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.refresh.store', $table['game']))
        ->assertOk()
        ->assertExactJson(['refreshed' => 1, 'missing' => 1]);

    $kept->refresh();

    expect($kept->title)->toBe('New title')
        ->and($kept->description)->toBe('About PROJ-1')
        ->and($kept->external_assignee)->toBe('Ann')
        ->and($kept->external_estimate)->toBe('13')
        ->and($kept->estimate)->toBe('8')
        ->and($kept->external_refreshed_at?->isToday())->toBeTrue()
        ->and($gone->fresh()?->title)->toBe('Deleted in Jira')
        ->and($otherSite->fresh()?->title)->toBe('Other site');

    Http::assertSent(fn (Request $request) => $request['jql'] === 'id in (10001,10002)');
    Event::assertDispatched(PokerGameChanged::class);
});

it('tells the other players when every refreshed issue is missing', function () {
    Event::fake([PokerGameChanged::class]);
    $table = trackerTable();
    $gone = importedPokerTask($table['game'], ['external_id' => '10002', 'external_key' => 'PROJ-2']);
    fakeJiraTrackerApi([]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.refresh.store', $table['game']))
        ->assertOk()
        ->assertExactJson(['refreshed' => 0, 'missing' => 1]);

    expect($gone->fresh()->external_missing_at)->not->toBeNull();
    Event::assertDispatched(PokerGameChanged::class);
});

it('asks to reconnect when no source can be refreshed', function () {
    $table = trackerTable();
    importedPokerTask($table['game']);
    $table['integration']->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.refresh.store', $table['game']))
        ->assertConflict()
        ->assertJsonPath('message', 'Reconnect Jira in the team settings.');

    Http::assertNothingSent();
});

it('limits how often a player refreshes imported tasks', function () {
    $table = trackerTable();
    $url = route('poker.imports.refresh.store', $table['game']);

    foreach (range(1, 10) as $attempt) {
        $this->actingAs($table['member'])->postJson($url)->assertOk();
    }

    $this->actingAs($table['member'])->postJson($url)->assertTooManyRequests();
});

it('refreshes nothing in a game without imported tasks', function () {
    $table = trackerTable();

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.refresh.store', $table['game']))
        ->assertOk()
        ->assertExactJson(['refreshed' => 0, 'missing' => 0]);
});
