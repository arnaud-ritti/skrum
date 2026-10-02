<?php

use App\Enums\ExternalStatusCategory;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

/**
 * The game of the ScreenPoker mockups: eight people of the Atlas team, six tasks, the third one being estimated.
 *
 * @return array{
 *     game: PokerGame,
 *     task: PokerTask,
 *     facilitator: User,
 *     players: array<string, PokerPlayer>
 * }
 */
function pokerVisualGame(): array
{
    config(['app.name' => 'Skrum']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $game = PokerGame::factory()->deck(PokerDeck::Fibonacci)->create([
        'team_id' => $team->id,
        'title' => 'Sprint 43 refinement',
        'auto_reveal' => true,
    ]);
    $players = [];

    foreach (['Arnaud Ritti', 'Camille Roux', 'Théo Martin', 'Inès Benali', 'Malik Koné', 'Sofia Lindqvist', 'Lucas Durand', 'Nadia Kowalski'] as $index => $name) {
        $user = User::factory()->create([
            'id' => sprintf('0199a000-0000-7000-8000-0000000003%02d', $index + 1),
            'name' => $name,
            'email' => 'poker-visual-'.($index + 1).'@example.com',
        ]);
        $workspace->members()->attach($user, ['role' => ($index === 0 ? WorkspaceRole::Admin : WorkspaceRole::Member)->value]);
        $team->members()->attach($user);
        $players[$name] = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);
    }

    $game->forceFill(['facilitator_player_id' => $players['Arnaud Ritti']->id])->save();

    $titles = [
        'Filter sessions by team' => '3',
        'Email reminders for late action items' => '8',
        'CSV export of retro action items' => null,
        'Slack webhook when a retro closes' => null,
        'Dark theme for anonymous guests' => null,
        'Limit votes per card' => null,
    ];
    $current = null;

    foreach ($titles as $title => $estimate) {
        $factory = $estimate === null ? PokerTask::factory() : PokerTask::factory()->estimated($estimate);
        $task = $factory->create([
            'poker_game_id' => $game->id,
            'title' => $title,
            'description' => $title === 'CSV export of retro action items'
                ? 'As a facilitator, I want to export the action items of one or several retros as CSV (title, owner, due date, status, linked ticket) to share them with management.'
                : null,
        ]);

        if ($title === 'CSV export of retro action items') {
            $current = $task;
        }
    }

    RateLimiter::for('login', fn (): Limit => Limit::none());

    return [
        'game' => $game,
        'task' => $current,
        'facilitator' => User::query()->findOrFail($players['Arnaud Ritti']->user_id),
        'players' => $players,
    ];
}

/**
 * @param  array<string, string>  $options
 */
function pokerVisualRoom(User $user, string $path, array $options): mixed
{
    User::query()->whereKey($user->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

    $page = visit('/login', $options);

    $page->fill('#email', $user->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    return $page->navigate($path)
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertCount('[data-realtime]', 1)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

it('[P18e-03-08] renders the poker room while the team votes without overflow', function () {
    ['game' => $game, 'task' => $task, 'facilitator' => $facilitator, 'players' => $players] = pokerVisualGame();
    $round = openPokerRound($game, $task);

    foreach (['Arnaud Ritti' => '5', 'Camille Roux' => '5', 'Théo Martin' => '5', 'Inès Benali' => '8', 'Malik Koné' => '3', 'Sofia Lindqvist' => '5', 'Lucas Durand' => '13'] as $name => $value) {
        pokerVote($round, $players[$name], $value);
    }

    $this->captureVisuals(
        'poker-room-voting',
        "/poker/{$game->id}",
        fn (string $path, array $options) => pokerVisualRoom($facilitator, $path, $options)
            ->assertCount('[data-slot="poker-table"] [data-slot="poker-seat"]', 7)
            ->assertCount('[data-slot="poker-deck"] button[aria-pressed="true"]', 1)
            ->assertPresent('[data-slot="poker-dock"] [role="toolbar"]')
            ->assertPresent('[data-slot="story-card"]'),
    );
});

it('[P18e-03-09] renders the revealed poker room of a facilitator who watches without overflow', function () {
    ['game' => $game, 'task' => $task, 'facilitator' => $facilitator, 'players' => $players] = pokerVisualGame();
    $first = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);

    foreach (['Camille Roux' => '2', 'Théo Martin' => '3', 'Inès Benali' => '5', 'Malik Koné' => '8', 'Sofia Lindqvist' => '13', 'Lucas Durand' => '13', 'Nadia Kowalski' => '☕'] as $name => $value) {
        pokerVote($first, $players[$name], $value);
    }

    $players['Arnaud Ritti']->forceFill(['is_spectator' => true])->save();
    $round = openPokerRound($game, $task);

    foreach (['Camille Roux' => '5', 'Théo Martin' => '5', 'Inès Benali' => '8', 'Malik Koné' => '13', 'Sofia Lindqvist' => '5', 'Lucas Durand' => '3', 'Nadia Kowalski' => '?'] as $name => $value) {
        pokerVote($round, $players[$name], $value);
    }

    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();

    $this->captureVisuals(
        'poker-room-revealed',
        "/poker/{$game->id}",
        fn (string $path, array $options) => pokerVisualRoom($facilitator, $path, $options)
            ->assertPresent('[aria-labelledby="poker-result"]')
            ->assertPresent('[data-slot="poker-watching-banner"]')
            ->assertPresent('[data-slot="poker-watching"]')
            ->assertPresent('[data-slot="poker-deckbar"] [data-slot="facilitator-bar"]')
            ->assertCount('[data-slot="poker-seat-card"][data-outlier]', 2),
    );
});

it('[P18e-03-10] renders the game settings with the deck picker without overflow', function () {
    ['game' => $game, 'task' => $task, 'facilitator' => $facilitator] = pokerVisualGame();
    openPokerRound($game, $task);
    SavedPokerDeck::factory()->create([
        'team_id' => $game->team_id,
        'name' => 'Atlas scale',
        'cards' => ['1', '2', '4', '8', '16', '?'],
        'created_by_user_id' => $facilitator->id,
    ]);

    $this->captureVisuals(
        'poker-room-settings',
        "/poker/{$game->id}",
        function (string $path, array $options) use ($facilitator) {
            $french = str_starts_with($options['locale'], 'fr');

            return pokerVisualRoom($facilitator, $path, $options)
                ->click($french ? '[aria-label="Menu de l\'animateur"]' : '[aria-label="Facilitator menu"]')
                ->click($french ? 'Paramètres…' : 'Settings…')
                ->assertPresent('[data-slot="poker-settings"] #poker-auto-reveal')
                ->assertPresent('[data-slot="poker-settings"] [role="radio"]:has-text("Atlas scale")')
                ->assertAttribute('[data-slot="poker-settings"] [role="radio"][value="fibonacci"]', 'aria-checked', 'true');
        },
    );
});

/**
 * Guest access is off: the link and its QR code hold the port of the test server, which changes at every run.
 */
it('[P18e-03-11] renders the share dialog of the facilitator without overflow', function () {
    ['game' => $game, 'task' => $task, 'facilitator' => $facilitator] = pokerVisualGame();
    openPokerRound($game, $task);

    $this->captureVisuals(
        'poker-room-share',
        "/poker/{$game->id}",
        fn (string $path, array $options) => pokerVisualRoom($facilitator, $path, $options)
            ->click('[data-slot="poker-share"]')
            ->assertPresent('[data-slot="share-dialog"] #poker-guest-link-access')
            ->assertNotPresent('[data-slot="share-dialog"] input[aria-label]'),
    );
});

/**
 * The Jira board of the Atlas team: two issues, the second one already in the game.
 */
function pokerVisualJira(PokerGame $game): void
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    TeamIntegration::factory()->jira()->create(['team_id' => $game->team_id]);
    fakeJiraTrackerApi([
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page']),
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => 'Order history', 'assignee' => ['displayName' => 'Camille Roux'], 'customfield_10016' => 8]),
        jiraTrackerIssue('10003', 'PROJ-3', ['summary' => 'Refund of a cancelled order after the invoice was sent', 'assignee' => null, 'customfield_10016' => null]),
    ]);
}

/**
 * Below 1024 px the queue is a drawer: the dialog is opened at the width of the capture, from the drawer.
 */
it('[P18e-03-12] renders the import dialog with the issues of a sprint without overflow', function () {
    ['game' => $game, 'task' => $task, 'facilitator' => $facilitator] = pokerVisualGame();
    pokerVisualJira($game);
    openPokerRound($game, $task);
    importedPokerTask($game, [
        'title' => 'Order history',
        'external_id' => '10002',
        'external_key' => 'PROJ-2',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-2',
    ]);

    $this->captureVisuals(
        'poker-room-import',
        "/poker/{$game->id}",
        function (string $path, array $options, int $width) use ($facilitator) {
            $french = str_starts_with($options['locale'], 'fr');
            $page = pokerVisualRoom($facilitator, $path, $options);

            if ($width < 1024) {
                $page->resize($width, 844)->click('button:has(svg.lucide-list-todo)');
            }

            return $page
                ->click($french ? '#poker-tasks button:has-text("Importer")' : '#poker-tasks button:has-text("Import")')
                ->click($french ? '[aria-label="Choisir un tableau"]' : '[aria-label="Choose a board"]')
                ->click('[role="option"]:has-text("Sweep scrum board")')
                ->assertEnabled($french ? '[aria-label="Choisir un sprint"]' : '[aria-label="Choose a sprint"]')
                ->click($french ? '[aria-label="Choisir un sprint"]' : '[aria-label="Choose a sprint"]')
                ->click('[role="option"]:has-text("Sprint 31")')
                ->click($french ? 'Afficher les tickets' : 'Show issues')
                ->assertCount('[data-slot="poker-import"] [data-slot="import-preview"] li', 3)
                ->assertAttribute('[data-slot="poker-import"] [role="checkbox"][aria-label="PROJ-1"]', 'aria-checked', 'true')
                ->assertDisabled('[data-slot="poker-import"] [role="checkbox"][aria-label="PROJ-2"]')
                ->assertNotPresent('[data-slot="poker-import"] [aria-label="Source"]');
        },
    );
});

it('[P18e-03-13] renders the story of an imported task whose estimate changed in Jira without overflow', function () {
    ['game' => $game, 'facilitator' => $facilitator, 'players' => $players] = pokerVisualGame();
    pokerVisualJira($game);
    importedPokerTask($game, [
        'title' => 'Order history',
        'external_id' => '10002',
        'external_key' => 'PROJ-2',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-2',
        'external_status_name' => 'Done',
        'external_status_category' => ExternalStatusCategory::Done,
    ]);
    $task = importedPokerTask($game, [
        'title' => 'Checkout page',
        'description' => 'As a customer, I want to pay my basket by card or by transfer.',
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
        'external_assignee' => 'Camille Roux',
        'external_estimate' => '8',
        'external_updated_at' => now(),
        'external_status_name' => 'In Progress',
        'external_status_category' => ExternalStatusCategory::InProgress,
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
    ]);
    $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);

    foreach (['Arnaud Ritti' => '5', 'Camille Roux' => '5', 'Théo Martin' => '5', 'Inès Benali' => '8'] as $name => $value) {
        pokerVote($round, $players[$name], $value);
    }

    $game->forceFill(['current_task_id' => $task->id])->save();

    $this->captureVisuals(
        'poker-room-source',
        "/poker/{$game->id}",
        fn (string $path, array $options) => pokerVisualRoom($facilitator, $path, $options)
            ->assertPresent('[data-slot="story-card"] a[data-slot="ticket"][href="https://acme.atlassian.net/browse/PROJ-1"]')
            ->assertPresent('[data-slot="story-card"] [data-slot="estimate-conflict"]')
            ->assertCount('[data-slot="story-card"] [data-slot="estimate-conflict"] button', 2)
            ->assertPresent('[data-test="poker-task-row"] [data-slot="badge"] [role="img"]'),
    );
});

it('[P18e-03-14] renders the guest join page of a game without overflow', function () {
    ['game' => $game] = pokerVisualGame();
    $game->forceFill(['guest_access_enabled' => true])->save();

    $this->captureVisuals(
        'poker-join',
        "/poker/join/{$game->guest_token}",
        fn (string $path, array $options) => visit($path, $options)
            ->assertAttribute('[data-slot="guest-join-session"]', 'data-kind', 'poker')
            ->assertPresent('[data-slot="guest-join-facilitator"]')
            ->assertPresent('[data-slot="guest-join-participants"]')
            ->assertAttribute('#spectator', 'role', 'switch')
            ->fill('#name', 'Nadia'),
    );
});

it('[P18e-03-15] renders the notice of a guest link that is no longer valid without overflow', function () {
    ['game' => $game] = pokerVisualGame();

    $this->captureVisuals(
        'poker-join-invalid',
        "/poker/join/{$game->guest_token}",
        fn (string $path, array $options) => visit($path, $options)
            ->assertNotPresent('#name')
            ->assertPresent('[data-slot="access-notice"]'),
    );
});

/**
 * The history of the Atlas team: tasks of three games on three decks, one of them voted without names.
 *
 * @return array{facilitator: User, path: string}
 */
function pokerVisualHistory(): array
{
    ['game' => $game, 'facilitator' => $facilitator, 'players' => $players] = pokerVisualGame();
    $team = Team::query()->findOrFail($game->team_id);
    $everyone = array_keys($players);
    $tshirt = PokerGame::factory()->deck(PokerDeck::Tshirt)->create(['team_id' => $team->id, 'title' => 'Billing sizing']);
    $hours = PokerGame::factory()->customCards(['1 h', '2 h', '4 h', '8 h', '16 h', '?'])->create([
        'team_id' => $team->id,
        'title' => 'Spikes of the quarter',
        'deck_name' => 'Hours (spikes)',
    ]);
    PokerTask::query()->where('poker_game_id', $game->id)->whereNotNull('estimated_at')->delete();

    $rows = [
        [$game, 'Email reminders for late action items', '8', '2026-09-30', false, [['3', '5', '8', '8', '13', '8', '5'], ['8', '8', '8', '5', '8', '8', '13']]],
        [$game, 'Filter sessions by team', '3', '2026-09-30', false, [['3', '3', '3', '2', '3', '3', '5']]],
        [$tshirt, 'Billing: proration on seat change', 'L', '2026-09-29', true, [['L', 'L', 'M', 'XL', 'L', 'L']]],
        [$game, 'SSO login with Azure AD', '13', '2026-09-23', false, [['5', '21', '13', '8', '13', '?', '8', '13'], ['8', '13', '13', '13', '21', '13', '8', '13'], ['13', '13', '13', '13', '13', '13', '13', '13']]],
        [$hours, 'Spike: offline mode for mobile', '16 h', '2026-09-22', false, [['16 h', '8 h', '16 h', '16 h', '?']]],
        [$game, 'Reorder columns by drag and drop', '5', '2025-12-16', false, [['3', '5', '8', '5', '5', '2', '5', '8'], ['5', '5', '5', '5', '5', '5', '5', '5']]],
    ];

    foreach ($rows as [$of, $title, $estimate, $day, $anonymous, $rounds]) {
        $task = PokerTask::factory()->estimated($estimate)->create([
            'poker_game_id' => $of->id,
            'title' => $title,
            'estimated_at' => "{$day} 10:00:00",
        ]);

        foreach ($rounds as $values) {
            $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id, 'anonymous' => $anonymous]);

            foreach ($values as $index => $value) {
                $voter = $players[$everyone[$index + 1] ?? $everyone[0]];

                if ($of->isNot($game)) {
                    $voter = PokerPlayer::query()->firstOrCreate(['poker_game_id' => $of->id, 'user_id' => $voter->user_id]);
                }

                pokerVote($round, $voter, $value);
            }
        }
    }

    return [
        'facilitator' => $facilitator,
        'path' => route('teams.estimates.index', [$team->workspace, $team], false),
    ];
}

/**
 * @param  array<string, string>  $options
 */
function pokerVisualPage(User $user, string $path, array $options): mixed
{
    User::query()->whereKey($user->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

    $page = visit('/login', $options);

    $page->fill('#email', $user->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    return $page->navigate($path)
        ->assertPresent('[data-slot="estimation-history"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

it('[P18e-03-16] renders the estimation history of the team without overflow', function () {
    ['facilitator' => $facilitator, 'path' => $path] = pokerVisualHistory();

    $this->captureVisuals(
        'poker-estimates',
        $path,
        fn (string $path, array $options) => pokerVisualPage($facilitator, $path, $options)
            ->assertCount('[data-slot="estimate-row"]', 6)
            ->assertCount('[data-slot="estimate-rounds"][data-revoted]', 3)
            ->assertCount('[data-slot="estimate-row"]:has-text("Billing: proration") [data-slot="person-avatar"]', 0),
    );
});

it('[P18e-03-17] renders the rounds of a task of the estimation history without overflow', function () {
    ['facilitator' => $facilitator, 'path' => $path] = pokerVisualHistory();

    $this->captureVisuals(
        'poker-estimates-rounds',
        $path,
        function (string $path, array $options, int $width) use ($facilitator) {
            $french = str_starts_with($options['locale'], 'fr');
            $page = pokerVisualPage($facilitator, $path, $options);

            if ($width < 768) {
                $page->resize($width, 844);
            }

            return $page
                ->click('[data-slot="estimate-row"]:has-text("SSO login") [aria-label="'.($french ? 'Afficher les tours' : 'Show rounds').'"]')
                ->assertCount('[data-slot="poker-round"]', 3)
                ->assertCount('[data-slot="poker-round-figures"]', 3);
        },
    );
});

it('[P18e-03-18] renders the estimation history of a team that estimated nothing without overflow', function () {
    ['game' => $game, 'facilitator' => $facilitator] = pokerVisualGame();
    PokerTask::query()->where('poker_game_id', $game->id)->delete();
    $team = Team::query()->findOrFail($game->team_id);

    $this->captureVisuals(
        'poker-estimates-empty',
        route('teams.estimates.index', [$team->workspace, $team], false),
        fn (string $path, array $options) => pokerVisualPage($facilitator, $path, $options)
            ->assertPresent('[data-slot="estimation-history"] [data-slot="empty-state"]')
            ->assertNotPresent('[data-slot="estimate-row"]'),
    );
});
