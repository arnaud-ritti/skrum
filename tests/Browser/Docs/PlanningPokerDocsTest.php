<?php

use App\Enums\ExternalStatusCategory;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\SavedPokerDeck;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\DocsWorld;

const DocsPlanningPokerVoters = ['Théo', 'Camille', 'Inès', 'Malik', 'Sofia', 'Lucas'];

function docsPlanningPokerGame(DocsWorld $world, string $title = 'Sprint 44 planning', ?PokerDeck $deck = null): PokerGame
{
    $game = PokerGame::factory()->deck($deck ?? PokerDeck::Fibonacci)->create([
        'team_id' => $world->team->id,
        'title' => $title,
    ]);

    foreach ($world->people->values() as $index => $person) {
        PokerPlayer::factory()->create([
            'poker_game_id' => $game->id,
            'user_id' => $person->id,
            'is_spectator' => $person->is($world->person('Yuki')),
            'created_at' => now()->subHour()->addSeconds($index),
        ]);
    }

    $game->forceFill(['facilitator_player_id' => docsPlanningPokerPlayer($game, $world, 'Théo')->id])->save();

    return $game;
}

function docsPlanningPokerPlayer(PokerGame $game, DocsWorld $world, string $firstName): PokerPlayer
{
    return PokerPlayer::query()
        ->where('poker_game_id', $game->id)
        ->where('user_id', $world->person($firstName)->id)
        ->firstOrFail();
}

function docsPlanningPokerVotes(PokerGame $game, DocsWorld $world, PokerRound $round, array $votes): void
{
    foreach ($votes as $firstName => $value) {
        pokerVote($round, docsPlanningPokerPlayer($game, $world, $firstName), $value);
    }
}

function docsPlanningPokerEstimated(PokerGame $game, DocsWorld $world, string $title, string $estimate, array $rounds, array $attributes = []): PokerTask
{
    $task = PokerTask::factory()->estimated($estimate)->create([
        'poker_game_id' => $game->id,
        'title' => $title,
        ...$attributes,
    ]);

    foreach ($rounds as $votes) {
        $round = PokerRound::factory()->revealed()->create([
            'poker_task_id' => $task->id,
            'anonymous' => (bool) $game->anonymous_votes,
        ]);

        docsPlanningPokerVotes($game, $world, $round, array_combine(array_slice(DocsPlanningPokerVoters, 0, count($votes)), $votes));
    }

    return $task;
}

function docsPlanningPokerBacklog(PokerGame $game, DocsWorld $world): PokerTask
{
    docsPlanningPokerEstimated($game, $world, 'Guest checkout without an account', '5', [['5', '5', '5', '8', '5', '3']]);
    docsPlanningPokerEstimated($game, $world, 'Order history page', '3', [['3', '3', '2', '3', '3', '3']]);

    $current = PokerTask::factory()->create([
        'poker_game_id' => $game->id,
        'title' => 'Refund a cancelled order',
        'description' => 'As a customer, I want my payment refunded when I cancel an order before it ships, so that I do not have to write to support.',
    ]);

    foreach (['Save several delivery addresses', 'Email receipt after payment', 'Export orders as CSV'] as $title) {
        PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => $title]);
    }

    return $current;
}

function docsPlanningPokerJiraIssue(string $id, string $key, string $summary, ?string $assignee, ?int $points): array
{
    return jiraTrackerIssue($id, $key, [
        'summary' => $summary,
        'assignee' => $assignee === null ? null : ['displayName' => $assignee],
        'customfield_10016' => $points,
    ]);
}

function docsPlanningPokerJira(DocsWorld $world): void
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);

    TeamIntegration::factory()->jira()->create([
        'team_id' => $world->team->id,
        'settings' => [
            'cloudId' => 'cloud-1',
            'siteUrl' => 'https://nordlys.atlassian.net',
            'siteName' => 'Nordlys',
            'storyPointFields' => [['id' => 'customfield_10016', 'name' => 'Story point estimate']],
            'numberFields' => [['id' => 'customfield_10016', 'name' => 'Story point estimate']],
        ],
    ]);

    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/status' => Http::response([['id' => '1', 'name' => 'To Do']]),
        'api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board/7/configuration' => Http::response(['filter' => ['id' => 70]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board/*/sprint*' => Http::response(['values' => [
            ['id' => 43, 'name' => 'Sprint 43', 'state' => 'active'],
            ['id' => 44, 'name' => 'Sprint 44', 'state' => 'future'],
        ]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board*' => Http::response([
            'values' => [['id' => 7, 'name' => 'Atlas board']],
            'isLast' => true,
        ]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::response(['isLast' => true, 'issues' => [
            docsPlanningPokerJiraIssue('10231', 'ATLAS-231', 'Refund a cancelled order', 'Inès Benali', null),
            docsPlanningPokerJiraIssue('10232', 'ATLAS-232', 'Save several delivery addresses', 'Malik Kone', null),
            docsPlanningPokerJiraIssue('10233', 'ATLAS-233', 'Email receipt after payment', null, null),
            docsPlanningPokerJiraIssue('10234', 'ATLAS-234', 'Export orders as CSV', 'Sofia Lindqvist', 3),
            docsPlanningPokerJiraIssue('10235', 'ATLAS-235', 'Show the delivery date on the order page', null, null),
        ]]),
    ]);
}

function docsPlanningPokerTicket(PokerGame $game, string $number, string $title, array $attributes = []): PokerTask
{
    return importedPokerTask($game, [
        'title' => $title,
        'external_id' => "10{$number}",
        'external_key' => "ATLAS-{$number}",
        'external_url' => "https://nordlys.atlassian.net/browse/ATLAS-{$number}",
        'external_status_name' => 'To Do',
        'external_status_category' => ExternalStatusCategory::Todo,
        ...$attributes,
    ]);
}

function docsPlanningPokerJiraBacklog(PokerGame $game, DocsWorld $world): PokerTask
{
    $done = docsPlanningPokerTicket($game, '229', 'Guest checkout without an account', [
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now(),
        'synced_at' => now(),
        'external_estimate' => '5',
    ]);

    docsPlanningPokerVotes($game, $world, PokerRound::factory()->revealed()->create(['poker_task_id' => $done->id]), array_combine(DocsPlanningPokerVoters, ['5', '5', '5', '8', '5', '3']));
    docsPlanningPokerEstimated($game, $world, 'Spike: compare two payment providers', '3', [['3', '3', '2', '3', '3', '3']]);

    $current = docsPlanningPokerTicket($game, '231', 'Refund a cancelled order', [
        'description' => 'As a customer, I want my payment refunded when I cancel an order before it ships, so that I do not have to write to support.',
        'external_assignee' => 'Inès Benali',
        'external_type' => 'Story',
        'external_labels' => ['Payments'],
    ]);

    docsPlanningPokerTicket($game, '232', 'Save several delivery addresses');

    return $current;
}

it('shows the planning poker form of the new session dialog with a name and four tasks typed', function () {
    $world = DocsWorld::create();

    $page = $this->docsVisit($world->person('Théo'), route('teams.show', [$world->workspace, $world->team, 'new' => 'poker'], false))
        ->assertPresent('[role="dialog"] [data-slot="poker-session-fields"]')
        ->fill('#new-poker-title', 'Sprint 44 planning')
        ->click('[role="dialog"] [data-slot="poker-tasks"] [role="tab"]:has-text("Type them")')
        ->fill('#new-poker-tasks', "Refund a cancelled order\nSave several delivery addresses\nEmail receipt after payment\nExport orders as CSV")
        ->assertSeeIn('[role="dialog"]', '4 / 50 tasks')
        ->click('[role="dialog"] h2');

    $this->docShot($page, 'planning-poker/new-game', '[role="dialog"]');
});

it('shows the room while the team votes, to the facilitator and to a member who has played a card', function () {
    $world = DocsWorld::create();
    $game = docsPlanningPokerGame($world);
    $round = openPokerRound($game, docsPlanningPokerBacklog($game, $world));
    docsPlanningPokerVotes($game, $world, $round, ['Camille' => '5', 'Inès' => '5', 'Malik' => '8']);
    $path = route('poker.show', $game, false);
    $pages = [];

    foreach (['Camille', 'Inès', 'Malik', 'Sofia', 'Lucas', 'Yuki'] as $firstName) {
        $pages[$firstName] = $this->docsVisit($world->person($firstName), $path)
            ->assertAttribute('[data-realtime]', 'data-realtime', 'connected');
    }

    $facilitator = $this->docsVisit($world->person('Théo'), $path)
        ->resize(1440, 1040)
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertSeeIn('[data-slot="poker-progress"]', '3 of 6 voted')
        ->assertSeeIn('[data-slot="queue-facilitator-settings"]', 'Yuki Tanaka')
        ->assertDontSeeIn('[data-slot="poker-table"]', 'Offline')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($facilitator, 'planning-poker/room', '[data-slot="session-frame"]');

    $member = $pages['Inès']
        ->assertSeeIn('[data-slot="poker-progress"]', '3 of 6 voted')
        ->assertDontSeeIn('[data-slot="poker-table"]', 'Offline')
        ->assertSeeIn('[data-slot="poker-dock-status"]', 'you can change it until the reveal');

    $this->docShot($member, 'planning-poker/voting', '[data-slot="poker-dock"]');
});

it('shows the revealed cards around the table and the result with the final estimate to the facilitator', function () {
    $world = DocsWorld::create();
    $game = docsPlanningPokerGame($world);
    $round = openPokerRound($game, docsPlanningPokerBacklog($game, $world));
    docsPlanningPokerVotes($game, $world, $round, array_combine(DocsPlanningPokerVoters, ['5', '5', '5', '8', '3', '13']));
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();
    $path = route('poker.show', $game, false);
    $pages = [];

    foreach (['Camille', 'Inès', 'Malik', 'Sofia', 'Lucas', 'Yuki'] as $firstName) {
        $pages[$firstName] = $this->docsVisit($world->person($firstName), $path)
            ->assertAttribute('[data-realtime]', 'data-realtime', 'connected');
    }

    $facilitator = $this->docsVisit($world->person('Théo'), $path)
        ->resize(1440, 1100)
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertPresent('[aria-labelledby="poker-result"]')
        ->assertPresent('[data-slot="poker-deckbar"] [data-test="poker-validate"]')
        ->assertCount('[data-slot="poker-seat-card"][data-outlier]', 2)
        ->assertDontSeeIn('[data-slot="poker-table"]', 'Offline')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($facilitator, 'planning-poker/revealed', '[data-slot="poker-table"]');
    $this->docShot($facilitator, 'planning-poker/result', '[data-slot="poker-deckbar"]');
});

it('shows the task queue of a game with tasks typed by hand and tasks imported from Jira', function () {
    $world = DocsWorld::create();
    docsPlanningPokerJira($world);
    $game = docsPlanningPokerGame($world);
    $round = openPokerRound($game, docsPlanningPokerJiraBacklog($game, $world));
    docsPlanningPokerVotes($game, $world, $round, ['Camille' => '5', 'Inès' => '5', 'Malik' => '8']);

    $page = $this->docsVisit($world->person('Théo'), route('poker.show', $game, false))
        ->resize(1440, 760)
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertCount('[data-test="poker-task-row"]', 4)
        ->assertPresent('#poker-tasks button:has-text("Import")');

    $this->docShot($page, 'planning-poker/tasks', '#poker-tasks');
});

it('shows the import dialog with the issues of a Jira sprint, two of them already in the game', function () {
    $world = DocsWorld::create();
    docsPlanningPokerJira($world);
    $game = docsPlanningPokerGame($world);
    openPokerRound($game, docsPlanningPokerJiraBacklog($game, $world));

    $page = $this->docsVisit($world->person('Théo'), route('poker.show', $game, false))
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->click('#poker-tasks button:has-text("Import")')
        ->click('[aria-label="Choose a board"]')
        ->click('[role="option"]:has-text("Atlas board")')
        ->assertEnabled('[aria-label="Choose a sprint"]')
        ->click('[aria-label="Choose a sprint"]')
        ->click('[role="option"]:has-text("Sprint 44")')
        ->assertCount('[data-slot="poker-import"] [data-slot="import-preview"] li', 5)
        ->assertDisabled('[data-slot="poker-import"] [role="checkbox"][aria-label="ATLAS-231"]')
        ->assertSeeIn('[data-slot="import-selection"]', '3 of 3 selected');

    $this->docShot($page, 'planning-poker/import-dialog', '[data-slot="poker-import"]');
});

it('shows the story of an imported task whose estimate was changed in Jira after the game saved it', function () {
    $world = DocsWorld::create();
    docsPlanningPokerJira($world);
    $game = docsPlanningPokerGame($world);
    $task = docsPlanningPokerTicket($game, '231', 'Refund a cancelled order', [
        'description' => 'As a customer, I want my payment refunded when I cancel an order before it ships, so that I do not have to write to support.',
        'external_assignee' => 'Inès Benali',
        'external_type' => 'Story',
        'external_labels' => ['Payments'],
        'external_estimate' => '8',
        'external_updated_at' => now(),
        'external_status_name' => 'In Progress',
        'external_status_category' => ExternalStatusCategory::InProgress,
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
    ]);
    docsPlanningPokerVotes($game, $world, PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]), array_combine(DocsPlanningPokerVoters, ['5', '5', '5', '8', '5', '3']));
    $game->forceFill(['current_task_id' => $task->id])->save();

    $page = $this->docsVisit($world->person('Théo'), route('poker.show', $game, false))
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertPresent('[data-slot="story-card"] [data-slot="estimate-conflict"]')
        ->assertCount('[data-slot="story-card"] [data-slot="estimate-conflict"] button', 2)
        ->assertCount('[data-slot="story-card"] [data-slot="poker-round"]', 1);

    $this->docShot($page, 'planning-poker/estimate-conflict', '[data-slot="story-card"]');
});

function docsPlanningPokerSavedDecks(DocsWorld $world): SavedPokerDeck
{
    $hours = SavedPokerDeck::factory()->create([
        'team_id' => $world->team->id,
        'name' => 'Hours',
        'cards' => ['1 h', '2 h', '4 h', '8 h', '16 h', '?'],
        'created_by_user_id' => $world->person('Malik')->id,
    ]);
    $days = SavedPokerDeck::factory()->forWorkspace($world->workspace)->create([
        'name' => 'Days of work',
        'cards' => ['½', '1', '2', '3', '5', '10', '?', '☕'],
        'created_by_user_id' => $world->person('Camille')->id,
    ]);

    foreach (['Sprint 42 planning', 'Sprint 43 planning', 'Sprint 44 planning'] as $title) {
        PokerGame::factory()->create(['team_id' => $world->team->id, 'title' => $title]);
    }

    PokerGame::factory()->deck(PokerDeck::Tshirt)->create(['team_id' => $world->team->id, 'title' => 'Roadmap sizing']);
    PokerGame::factory()->customCards($hours->cards)->create(['team_id' => $world->team->id, 'title' => 'Support spikes', 'saved_deck_id' => $hours->id, 'deck_name' => $hours->name]);
    PokerGame::factory()->customCards($days->cards)->create(['team_id' => $world->team->id, 'title' => 'Migration plan', 'saved_deck_id' => $days->id, 'deck_name' => $days->name]);

    return $hours;
}

it('shows the saved decks of a team: the four built-in decks, a deck of the team and a deck of the workspace', function () {
    $world = DocsWorld::create();
    docsPlanningPokerSavedDecks($world);

    $page = $this->docsVisit($world->person('Camille'), route('teams.pokerDecks.index', [$world->workspace, $world->team], false))
        ->assertCount('[data-slot="saved-decks-grid"] [data-slot="deck-card"]', 6)
        ->assertCount('[data-slot="deck-card"][data-default]', 1)
        ->assertPresent('[data-slot="saved-decks-grid"] [data-slot="deck-create"]');

    $this->docShot($page, 'planning-poker/decks', '[data-slot="saved-decks-page"]');
});

it('shows the deck editor open on a deck of the team', function () {
    $world = DocsWorld::create();
    $hours = docsPlanningPokerSavedDecks($world);

    $page = $this->docsVisit($world->person('Camille'), route('teams.pokerDecks.index', [$world->workspace, $world->team], false))
        ->click('[aria-label="Edit Hours"]')
        ->assertPresent('[role="dialog"] [data-slot="deck-editor"]')
        ->assertValue("#deck-{$hours->id}-name", 'Hours')
        ->click('[role="dialog"] h2');

    $this->docShot($page, 'planning-poker/deck-editor', '[role="dialog"]');
});

it('shows the estimation history of a team with the two rounds of a task that was voted again', function () {
    $world = DocsWorld::create();
    $week = now()->startOfWeek();
    $sprint43 = docsPlanningPokerGame($world, 'Sprint 43 planning');
    $sprint42 = docsPlanningPokerGame($world, 'Sprint 42 planning');
    $roadmap = docsPlanningPokerGame($world, 'Roadmap sizing', PokerDeck::Tshirt);
    $planned43 = ['estimated_at' => $week->copy()->subDays(7)->setTime(10, 0)];
    $planned42 = ['estimated_at' => $week->copy()->subDays(21)->setTime(10, 0)];

    docsPlanningPokerEstimated($sprint43, $world, 'Two-step verification by text message', '8', [['5', '8', '3', '13', '8', '5'], ['8', '8', '8', '8', '5', '8']], $planned43);
    docsPlanningPokerEstimated($sprint43, $world, 'Password reset by email', '3', [['3', '3', '3', '2', '3', '3']], $planned43);
    docsPlanningPokerEstimated($sprint43, $world, 'Download an invoice as PDF', '5', [['5', '5', '8', '5', '5']], $planned43);
    docsPlanningPokerEstimated($roadmap, $world, 'Offline mode for the mobile app', 'XL', [['L', 'XL', 'XL', 'XL', 'M', 'XL']], ['estimated_at' => $week->copy()->subDays(14)->setTime(10, 0)]);
    docsPlanningPokerEstimated($sprint42, $world, 'Discount codes at checkout', '13', [['8', '13', '13', '21', '13', '13']], $planned42);
    docsPlanningPokerEstimated($sprint42, $world, 'Search orders by customer name', '5', [['5', '5', '5', '5', '3', '5']], $planned42);

    $page = $this->docsVisit($world->person('Inès'), route('teams.estimates.index', [$world->workspace, $world->team], false))
        ->resize(1440, 1400)
        ->assertCount('[data-slot="estimate-row"]', 6)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0)
        ->click('[data-slot="estimate-row"]:has-text("Two-step verification") [aria-label="Show rounds"]')
        ->assertCount('[data-slot="poker-round"]', 2);

    $this->docShot($page, 'planning-poker/estimates', '[data-slot="estimation-history"]');
});

it('shows the import tab of a new session with optional filters and selected issues', function () {
    $world = DocsWorld::create();
    docsPlanningPokerJira($world);
    $page = $this->docsVisit($world->person('Théo'), route('teams.show', [$world->workspace, $world->team, 'new' => 'poker'], false))
        ->resize(1440, 1800)
        ->fill('#new-poker-title', 'Sprint 44 planning')
        ->click('[data-slot="poker-tasks"] [role="tab"]:has-text("Import")')
        ->assertCount('[data-slot="import-preview"] li', 5)
        ->assertSee('No filters selected: all accessible issues are shown.');

    $this->docShot($page, 'planning-poker/new-game-import', '[data-slot="poker-tasks"]');
});
