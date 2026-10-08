<?php

use App\Enums\IntegrationProvider;
use App\Enums\PokerRevealReason;
use App\Jobs\SyncTaskEstimate;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

const PokerRoomDescription = <<<'MD'
As a facilitator, I want the action items of a retro as CSV.

## Acceptance criteria

- One row per action item
- The owner and the due date are columns

## Notes

Keep the export under one second.
MD;

const PokerRoomStoryCard = 'section[data-slot="story-card"]';

/**
 * Ada facilitates, Bob plays; the team has a Jira connection and the game is open to guests.
 *
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     game: PokerGame,
 *     ada: User,
 *     adaPlayer: PokerPlayer,
 *     bob: User,
 *     bobPlayer: PokerPlayer
 * }
 */
function pokerRoomTable(array $attributes = []): array
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);

    $game = PokerGame::factory()->withGuestAccess()->create(['title' => 'Sprint 44 refinement', ...$attributes]);
    TeamIntegration::factory()->jira()->create(['team_id' => $game->team_id]);
    [$ada, $adaPlayer] = pokerFacilitator($game);
    [$bob, $bobPlayer] = pokerMember($game);

    return [
        'game' => $game,
        'ada' => renamedUser($ada, 'Ada'),
        'adaPlayer' => $adaPlayer,
        'bob' => renamedUser($bob, 'Bob'),
        'bobPlayer' => $bobPlayer,
    ];
}

function pokerRoomImportedTask(PokerGame $game, string $title = 'CSV export of retro action items'): PokerTask
{
    $task = importedPokerTask($game, [
        'title' => $title,
        'description' => PokerRoomDescription,
        'external_id' => '10001',
        'external_key' => 'PROJ-7',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-7',
    ]);

    $task->forceFill(['external_type' => 'Story', 'external_labels' => ['csv', 'export'], 'external_assignee' => 'Jane Doe'])->save();

    return $task;
}

/**
 * @param  array<int, array<string, mixed>>  $issues
 */
function pokerRoomFakeJira(array $issues): void
{
    Http::fake([
        jiraApiUrl('rest/api/3/status') => Http::response([['id' => '1', 'name' => 'To Do']]),
        jiraApiUrl('rest/agile/1.0/board/7/configuration') => Http::response(['filter' => ['id' => 70]]),
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
        'api.atlassian.com/*' => Http::response(['errorMessages' => ['Unexpected request in a browser test.']], 404),
    ]);
}

function pokerRoomStoryCardScript(): string
{
    return <<<'JAVASCRIPT'
    (() => {
        const card = document.querySelector('section[data-slot="story-card"]');

        return JSON.stringify({
            type: [...card.querySelectorAll('[data-slot="ticket-type"]')].map((badge) => badge.textContent),
            labels: [...card.querySelectorAll('[data-slot="ticket-label"]')].map((badge) => badge.textContent),
            description: card.querySelector('[data-slot="story-description"]')?.innerText ?? '',
            criteria: [...card.querySelectorAll('[data-slot="ticket-criteria"] li')].map((item) => item.textContent),
        });
    })()
    JAVASCRIPT;
}

it('shows the type, the labels and the acceptance criteria of a ticket to a member and to a guest, and the whole description in the edit dialog of a typed task', function () {
    $table = pokerRoomTable();
    $task = pokerRoomImportedTask($table['game']);
    PokerTask::factory()->create([
        'poker_game_id' => $table['game']->id,
        'title' => 'Typed by hand',
        'description' => "Short intro.\n\nAcceptance criteria:\n- Works offline",
    ]);
    openPokerRound($table['game'], $task);
    $expected = json_encode([
        'type' => ['Story'],
        'labels' => ['csv', 'export'],
        'description' => "As a facilitator, I want the action items of a retro as CSV.\n\nNotes\n\nKeep the export under one second.",
        'criteria' => ['One row per action item', 'The owner and the due date are columns'],
    ]);

    $member = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$table['game']->guest_token}", 'Visitor'));

    foreach ([$member, $guest] as $page) {
        $page->click(PokerRoomStoryCard.' summary')
            ->assertSeeIn(PokerRoomStoryCard, 'PROJ-7')
            ->assertSeeIn(PokerRoomStoryCard.' [data-slot="ticket-criteria"] h3', 'Acceptance criteria')
            ->assertScript(pokerRoomStoryCardScript(), $expected)
            ->assertDontSeeIn(PokerRoomStoryCard.' [data-slot="story-description"]', 'One row per action item');
    }

    $member->assertSeeIn(PokerRoomStoryCard, 'Assignee: Jane Doe');
    $guest->assertDontSeeIn(PokerRoomStoryCard, 'Jane Doe');

    $facilitator = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));

    $facilitator->click('Typed by hand')
        ->assertSeeIn(PokerRoomStoryCard.' h2', 'Typed by hand')
        ->assertNotPresent(PokerRoomStoryCard.' [data-slot="ticket-type"]')
        ->assertNotPresent(PokerRoomStoryCard.' [data-slot="ticket-label"]')
        ->click(PokerRoomStoryCard.' summary')
        ->assertSeeIn(PokerRoomStoryCard.' [data-slot="story-description"]', 'Short intro.')
        ->assertDontSeeIn(PokerRoomStoryCard.' [data-slot="story-description"]', 'Works offline')
        ->assertSeeIn(PokerRoomStoryCard.' [data-slot="ticket-criteria"]', 'Works offline')
        ->click(PokerRoomStoryCard.' button[aria-label="Edit task"]')
        ->assertValue('[role="dialog"] textarea', "Short intro.\n\nAcceptance criteria:\n- Works offline");
});

it('lets a player change their card after reveal, moves the result for everyone, and closes the deck once the estimate is saved', function () {
    $table = pokerRoomTable(['revote_after_reveal' => true]);
    $task = PokerTask::factory()->create(['poker_game_id' => $table['game']->id, 'title' => 'Login page']);
    $round = openPokerRound($table['game'], $task);
    pokerVote($round, $table['adaPlayer'], '5');
    pokerVote($round, $table['bobPlayer'], '3');
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();

    $facilitator = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));
    $member = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}"));

    foreach ([$facilitator, $member] as $page) {
        $page->assertVisible('[aria-label="Bob: 3"]')
            ->assertDontSee('Consensus');
    }

    $member->assertSee('you can still change it until the estimate is saved.')
        ->assertVisible('[role="group"][aria-label="Your cards"]')
        ->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]')
        ->assertAttribute('[aria-label="Play 5"]', 'aria-pressed', 'true');

    foreach ([$facilitator, $member] as $page) {
        $page->assertVisible('[aria-label="Bob: 5"]')
            ->assertSee('Consensus');
    }

    $facilitator->assertSee('Validate 5')
        ->click('@poker-validate');

    $member->assertSee('Estimate: 5')
        ->assertNotPresent('[role="group"][aria-label="Your cards"]')
        ->assertDontSee('you can still change it until the estimate is saved.');

    expect($round->votes()->where('poker_player_id', $table['bobPlayer']->id)->value('value'))->toBe('5')
        ->and($task->fresh()->estimate)->toBe('5');
});

it('keeps the deck closed after reveal when the game does not allow a change', function () {
    $table = pokerRoomTable();
    $task = PokerTask::factory()->create(['poker_game_id' => $table['game']->id, 'title' => 'Login page']);
    $round = openPokerRound($table['game'], $task);
    pokerVote($round, $table['bobPlayer'], '3');
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();

    $member = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}"));

    $member->assertVisible('[aria-label="Bob: 3"]')
        ->assertNotPresent('[role="group"][aria-label="Your cards"]')
        ->assertDontSee('you can still change it until the estimate is saved.');
});

it('starts the round of a picked task with the task timer, counting down for everyone', function () {
    $table = pokerRoomTable(['task_timer_seconds' => 180]);
    PokerTask::factory()->create(['poker_game_id' => $table['game']->id, 'title' => 'Login page']);

    $facilitator = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));
    $member = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}"));

    foreach ([$facilitator, $member] as $page) {
        $page->assertNotPresent('[role="timer"]');
    }

    $facilitator->click('Login page');

    foreach ([$facilitator, $member] as $page) {
        $page->assertSeeIn('[role="timer"]', '2:');
    }

    $round = PokerRound::query()->sole();

    expect((int) round($round->created_at->diffInSeconds($round->timer_ends_at)))->toBe(180);
});

it('changes the timer per task and the change of vote in the room settings, shown as text to a player', function () {
    $table = pokerRoomTable();
    PokerTask::factory()->create(['poker_game_id' => $table['game']->id, 'title' => 'Login page']);

    $facilitator = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"))->resize(1440, 900);

    $facilitator->click('header button[aria-label="Game settings"]')
        ->assertSeeIn('[role="dialog"]', 'Timer per task')
        ->assertSeeIn('[role="dialog"]', 'Nudges after the delay')
        ->assertSeeIn('[role="dialog"]', 'Change vote after reveal')
        ->assertSeeIn('[role="dialog"]', 'Write estimates to Jira')
        ->assertSeeIn('[role="dialog"] #poker-task-timer', 'Off')
        ->assertAttribute('#poker-revote', 'aria-checked', 'false')
        ->click('#poker-task-timer')
        ->click('[role="option"]:has-text("3 minutes")')
        ->click('#poker-revote')
        ->click('#poker-write-back')
        ->click('[role="option"]:has-text("Don\'t write")')
        ->assertSee('3 unapplied changes')
        ->click('[role="dialog"] button:has-text("Apply")')
        ->assertDontSee('unapplied change');

    expect($table['game']->fresh()->only(['task_timer_seconds', 'revote_after_reveal', 'writes_estimates']))
        ->toBe(['task_timer_seconds' => 180, 'revote_after_reveal' => true, 'writes_estimates' => false]);

    $member = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}"))->resize(1440, 900);

    $member->click('header button[aria-label="Game settings"]')
        ->assertSeeIn('[role="dialog"]', 'Only the facilitator, Ada, can change these settings.')
        ->assertNotPresent('#poker-task-timer')
        ->assertNotPresent('#poker-revote');
});

it('tells the facilitator that a saved estimate is not written back when the game does not write estimates', function () {
    config(['queue.default' => 'database']);
    Queue::fake([SyncTaskEstimate::class]);
    $table = pokerRoomTable(['writes_estimates' => false]);
    pokerRoomFakeJira([]);
    $task = pokerRoomImportedTask($table['game']);
    $round = openPokerRound($table['game'], $task);
    pokerVote($round, $table['adaPlayer'], '5');
    pokerVote($round, $table['bobPlayer'], '5');
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();

    $facilitator = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));

    $facilitator->assertSee('Validate 5')
        ->click('@poker-validate')
        ->assertSee('Estimate: 5')
        ->assertSee('Not synced: Estimates are not written back in this game.')
        ->assertDontSee('Sync pending')
        ->assertNotPresent(PokerRoomStoryCard.' button:has-text("Retry")');

    Queue::assertNotPushed(SyncTaskEstimate::class);

    expect($task->fresh()->needs_sync)->toBeFalse();
});

it('creates a game with a three-minute task timer and the change of vote from the "New session" dialog', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice');

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false).'?new=poker');

    $page->assertVisible('#new-poker-title')
        ->fill('#new-poker-title', 'Timed refinement')
        ->assertSeeIn('#new-poker-task-timer', 'Off')
        ->click('#new-poker-task-timer')
        ->assertScript('[...document.querySelectorAll(\'[role="option"]\')].map((option) => option.textContent).join(" / ")', 'Off / 1 minute / 3 minutes / 5 minutes / 10 minutes')
        ->click('[role="option"]:has-text("3 minutes")')
        ->assertAttribute('#new-poker-revote', 'aria-checked', 'false')
        ->click('#new-poker-revote')
        ->assertAttribute('#new-poker-revote', 'aria-checked', 'true')
        ->assertNotPresent('#new-poker-write-back')
        ->click('[role="dialog"] [role="tab"]:has-text("Type them")')
        ->fill('#new-poker-tasks', 'Checkout flow')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/')
        ->click('Checkout flow')
        ->assertSeeIn('[role="timer"]', '2:');

    expect(PokerGame::query()->where('title', 'Timed refinement')->sole()->only(['task_timer_seconds', 'revote_after_reveal']))
        ->toBe(['task_timer_seconds' => 180, 'revote_after_reveal' => true]);
});

it('imports chosen Jira tickets while creating a game and opens it with them in sprint order', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $alice = renamedUser(teamMember($team), 'Alice');
    pokerRoomFakeJira([
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page', 'issuetype' => ['name' => 'Story'], 'labels' => ['web']]),
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => 'Payment retries']),
        jiraTrackerIssue('10003', 'PROJ-3', ['summary' => 'Refund mail']),
    ]);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false).'?new=poker');

    $page->assertVisible('#new-poker-title')
        ->fill('#new-poker-title', 'Imported refinement')
        ->assertSeeIn('[role="dialog"]', 'Write estimates to Jira')
        ->assertSeeIn('[role="dialog"]', 'Estimates are written to Jira when the facilitator clicks “Save estimate”.')
        ->click('[role="dialog"] [role="tab"]:has-text("Import")')
        ->click('[aria-label="Choose a board"]')
        ->click('[role="option"]:has-text("Web team board")')
        ->click('[aria-label="Choose a sprint"]')
        ->click('[role="option"]:has-text("Sprint 31")')
        ->assertSeeIn('[role="dialog"] li:has-text("PROJ-1")', 'Checkout page')
        ->assertNotPresent('[role="dialog"] :text("Already imported")')
        ->click('[role="dialog"] [role="checkbox"][aria-label="PROJ-2"]')
        ->assertAttribute('[role="dialog"] [role="checkbox"][aria-label="PROJ-2"]', 'aria-checked', 'false')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/')
        ->assertCount('@poker-task-row', 2)
        ->assertPresent('[data-test="poker-task-row"]:has-text("Checkout page") [data-slot="badge"]:text-is("PROJ-1")')
        ->assertPresent('[data-test="poker-task-row"]:has-text("Refund mail") [data-slot="badge"]:text-is("PROJ-3")')
        ->click('Checkout page')
        ->assertSeeIn(PokerRoomStoryCard.' [data-slot="ticket-type"]', 'Story')
        ->assertSeeIn(PokerRoomStoryCard.' [data-slot="ticket-label"]', 'web');

    $game = PokerGame::query()->where('title', 'Imported refinement')->sole();

    expect($game->tasks()->orderBy('position')->pluck('external_key')->all())->toBe(['PROJ-1', 'PROJ-3']);
});

it('fits the room with a ticket and its criteria on a phone, without horizontal scroll', function () {
    $table = pokerRoomTable(['revote_after_reveal' => true, 'task_timer_seconds' => 60]);
    $task = pokerRoomImportedTask($table['game']);
    openPokerRound($table['game'], $task);

    $page = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}"));

    $page->resize(390, 844)
        ->assertVisible(PokerRoomStoryCard)
        ->assertVisible(PokerRoomStoryCard.' [data-slot="ticket-type"]')
        ->assertVisible(PokerRoomStoryCard.' [data-slot="ticket-criteria"]')
        ->assertVisible('[role="group"][aria-label="Your cards"]');

    expect($this->overflowingElements($page))->toBe([]);
});

it('draws the room and the story card in the dark theme', function () {
    $table = pokerRoomTable();
    $task = pokerRoomImportedTask($table['game']);
    openPokerRound($table['game'], $task);
    $cardLuminance = <<<'JAVASCRIPT'
    (() => {
        const context = document.createElement('canvas').getContext('2d');
        context.fillStyle = getComputedStyle(document.querySelector('section[data-slot="story-card"]')).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;

        return 0.2126 * r + 0.7152 * g + 0.0722 * b < 80;
    })()
    JAVASCRIPT;

    $page = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}", ['colorScheme' => 'dark']));

    $page->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertVisible(PokerRoomStoryCard.' [data-slot="ticket-criteria"]')
        ->assertScript($cardLuminance, true);

    expect($this->overflowingElements($page))->toBe([]);
});

it('speaks the viewer\'s language in the room: English, then French with tu', function (string $locale, string $browserLocale, string $criteria, string $revoteHint) {
    $table = pokerRoomTable(['revote_after_reveal' => true]);
    $task = pokerRoomImportedTask($table['game']);
    $round = openPokerRound($table['game'], $task);
    pokerVote($round, $table['bobPlayer'], '3');
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();
    renamedUser($table['bob'], 'Bob', $locale);

    $page = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}", ['locale' => $browserLocale]));

    $page->assertScript("document.documentElement.lang.startsWith('{$locale}')", true)
        ->assertSeeIn(PokerRoomStoryCard.' [data-slot="ticket-criteria"] h3', $criteria)
        ->assertSee($revoteHint);
})->with([
    'English' => ['en', 'en-US', 'Acceptance criteria', 'you can still change it until the estimate is saved.'],
    'French' => ['fr', 'fr-FR', "Critères d'acceptation", "tu peux encore la changer tant que l'estimation n'est pas enregistrée."],
]);
