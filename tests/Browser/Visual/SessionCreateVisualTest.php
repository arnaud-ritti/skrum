<?php

use App\Enums\IntegrationProvider;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

it('[P18e-01-08] renders the new session dialog and its retro form without overflow', function () {
    $this->captureVisuals(
        'session-create',
        '/dev/design-system/session-create',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-bench-section="session-create"]')
            ->assertPresent('[data-slot="session-create-whole"] [data-slot="retro-column-draft"]')
            ->assertPresent('[role="dialog"] [data-slot="retro-column-draft"]')
            ->assertCount('[role="dialog"] button[type="submit"]', 1),
    );
});

it('[P18e-01-08b] renders the poker form of the new session dialog without overflow', function () {
    $this->captureVisuals(
        'session-create-poker',
        '/dev/design-system/session-create-poker',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-bench-section="session-create-poker"]')
            ->assertPresent('[data-slot="session-create-whole"] [data-slot="deck-picker"]')
            ->assertPresent('[role="dialog"] [data-slot="deck-picker"]')
            ->assertCount('[role="dialog"] button[type="submit"]', 1),
    );
});

it('[P18e-01-08c] renders the whiteboard form of the new session dialog and the templates manager without overflow', function () {
    $this->captureVisuals(
        'session-create-whiteboard',
        '/dev/design-system/session-create-whiteboard',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-bench-section="session-create-whiteboard"]')
            ->assertCount('[data-slot="session-create-whole"] [role="radiogroup"] [role="radio"]', 10)
            ->assertPresent('[data-slot="whiteboard-templates-panel"][data-state="rows"] form')
            ->assertPresent('[data-slot="whiteboard-templates-panel"][data-state="empty"] [data-slot="empty-state"]')
            ->assertPresent('[role="dialog"] [data-slot="whiteboard-template-gallery"]')
            ->assertCount('[role="dialog"] button[type="submit"]', 1),
    );
});

it('[P18e-01-08d] renders the icebreaker form of the new session dialog without overflow', function () {
    $this->captureVisuals(
        'session-create-icebreaker',
        '/dev/design-system/session-create-icebreaker',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-bench-section="session-create-icebreaker"]')
            ->assertCount('[data-slot="session-create-whole"][data-state="games"] [role="radiogroup"] [role="radio"]', 8)
            ->assertPresent('[data-slot="session-create-whole"][data-state="unavailable"] [role="radio"][data-game="gif"][aria-disabled="true"]')
            ->assertPresent('[role="dialog"] [data-slot="icebreaker-session-fields"]')
            ->assertCount('[role="dialog"] button[type="submit"]', 1),
    );
});

it('[P19-31-09] renders the poll form of the new session dialog on the health check without overflow', function () {
    config(['app.name' => 'Skrum']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000011',
        'name' => 'Camille Roux',
        'email' => 'camille@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $team->members()->attach($admin);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        'session-create-poll',
        route('teams.show', [$workspace, $team, 'new' => 'survey', 'template' => 'health_check'], false),
        function (string $path, array $options) use ($admin) {
            User::query()->whereKey($admin->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $admin->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            return $page->navigate($path)
                ->assertPresent('[role="dialog"] [data-slot="survey-session-fields"]')
                ->assertAttribute('[role="dialog"] [data-type="survey"][role="radio"]', 'data-state', 'checked')
                ->assertAttribute('[role="dialog"] [data-slot="survey-start-choice"][data-choice="health_check"]', 'aria-checked', 'true')
                ->assertCount('[role="dialog"] button[type="submit"]', 1);
        },
    );
});

it('[P18e-01-22] renders the saved decks page without overflow', function () {
    config(['app.name' => 'Skrum']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000011',
        'name' => 'Camille Roux',
        'email' => 'camille@example.com',
    ]);
    $malik = User::factory()->create(['name' => 'Malik K']);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $workspace->members()->attach($malik, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach([$admin->id, $malik->id]);

    $hours = SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'name' => 'Hours (spikes)',
        'cards' => ['1 h', '2 h', '4 h', '8 h', '16 h', '?'],
        'created_by_user_id' => $malik->id,
    ]);
    $house = SavedPokerDeck::factory()->forWorkspace($workspace)->create([
        'name' => 'A house scale with a rather long name',
        'cards' => ['🐜', '🐇', '🐕', '🐘', '🐋', '?', '☕'],
        'created_by_user_id' => $admin->id,
    ]);

    PokerGame::factory()->count(31)->create(['team_id' => $team->id]);
    PokerGame::factory()->customCards($hours->cards)->count(4)->create(['team_id' => $team->id, 'saved_deck_id' => $hours->id]);
    PokerGame::factory()->customCards($house->cards)->create(['team_id' => $team->id, 'saved_deck_id' => $house->id]);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $path = route('teams.pokerDecks.index', [$workspace, $team], false);
    $visitPage = function (string $path, array $options) use ($admin) {
        User::query()->whereKey($admin->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

        $page = visit('/login', $options);

        $page->fill('#email', $admin->email)
            ->fill('#password', 'password')
            ->click('@login-button')
            ->assertPathIsNot('/login');

        return $page->navigate($path)
            ->assertCount('[data-slot="saved-decks-grid"] [data-slot="deck-card"]', 6)
            ->assertPresent('[data-slot="saved-decks-grid"] [data-slot="deck-create"]')
            ->assertCount('[data-slot="deck-card"][data-default]', 1)
            ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
    };

    $this->captureVisuals('saved-decks-page', $path, $visitPage);

    $this->captureVisuals(
        'saved-decks-editor',
        $path,
        fn (string $path, array $options) => $visitPage($path, $options)
            ->click('[aria-label="'.(str_starts_with($options['locale'], 'fr') ? 'Modifier' : 'Edit').' Hours (spikes)"]')
            ->assertPresent('[role="dialog"] [data-slot="deck-editor"]')
            ->assertValue("#deck-{$hours->id}-name", 'Hours (spikes)'),
    );
});

/**
 * The Atlas team of the Nordlys workspace, its manager signed in and a way to open a page signed in as that manager.
 *
 * @return array{
 *     0: Team,
 *     1: callable(string, array<string, string>): mixed
 * }
 */
function p22NewSessionDialog(): array
{
    config(['app.name' => 'Skrum']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = User::factory()->create([
        'id' => '0199b022-0000-7000-8000-000000000011',
        'name' => 'Camille Roux',
        'email' => 'camille@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $team->members()->attach($admin);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $open = function (string $path, array $options) use ($admin): mixed {
        User::query()->whereKey($admin->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

        $page = visit('/login', $options);

        $page->fill('#email', $admin->email)
            ->fill('#password', 'password')
            ->click('@login-button')
            ->assertPathIsNot('/login');

        return $page->navigate($path);
    };

    return [$team, $open];
}

it('[P22-20-03] renders the retro form of the new session dialog with a custom timer per phase without overflow', function () {
    [$team, $open] = p22NewSessionDialog();

    $this->captureVisuals(
        'session-create-retro-options',
        route('teams.show', [$team->workspace, $team, 'new' => 'retro'], false),
        function (string $path, array $options) use ($open) {
            $french = str_starts_with($options['locale'], 'fr');

            return $open($path, $options)
                ->assertPresent('[role="dialog"] [data-slot="retro-session-fields"]')
                ->click('[role="dialog"] #new-retro-phase-timers')
                ->click($french ? '[role="option"]:has-text("Personnalisé (5 phases)")' : '[role="option"]:has-text("Custom (5 phases)")')
                ->assertCount('[role="dialog"] [data-slot="phase-timers-field"] [data-slot="stepper"]', 5)
                ->assertSeeIn('[role="dialog"] #new-retro-phase-writing output', '7')
                ->assertPresent('[role="dialog"] #new-retro-max-votes-per-card-auto');
        },
    );
});

/**
 * The dialog's height follows `dvh`: the page is brought to the size of the capture first, then the dialog's
 * body is scrolled at that height to show the three game settings above the tickets.
 */
it('[P22-20-04] renders the poker form of the new session dialog importing twelve Jira tickets without overflow', function () {
    [$team, $open] = p22NewSessionDialog();

    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    $titles = [
        'Export the action items of a retro as CSV',
        'Filter sessions by team',
        'Email reminders for late action items',
        'Slack webhook when a retro closes',
        'Dark theme for anonymous guests',
        'Limit votes per card',
        'Search the estimation history',
        'Show the facilitator in the session list',
        'Copy a retro template between teams',
        'Keyboard shortcuts for the voting phase',
        'Archive a team and its sessions',
        'Weekly digest of open action items',
    ];
    $issues = [];

    foreach ($titles as $index => $title) {
        $number = 1281 + $index;
        $issues[] = jiraTrackerIssue((string) (20000 + $number), "ATLAS-{$number}", [
            'summary' => $title,
            'assignee' => $index % 3 === 0 ? null : ['displayName' => ['Inès Benali', 'Malik Koné'][$index % 2]],
            'customfield_10016' => null,
        ]);
    }

    fakeJiraTrackerApi($issues);

    $this->captureVisuals(
        'session-create-poker-import',
        route('teams.show', [$team->workspace, $team, 'new' => 'poker'], false),
        function (string $path, array $options, int $width) use ($open) {
            $french = str_starts_with($options['locale'], 'fr');

            $page = $open($path, $options)
                ->resize($width, $width === 1440 ? 900 : 844)
                ->assertPresent('[role="dialog"] [data-slot="poker-session-fields"]')
                ->click('[role="dialog"] [data-slot="poker-tasks"] [role="tab"]:has-text("Jira")')
                ->click($french ? '[data-slot="tracker-issue-picker"] [role="tab"]:has-text("Requête")' : '[data-slot="tracker-issue-picker"] [role="tab"]:has-text("Query")')
                ->fill('#new-poker-import-query', 'project = ATLAS AND sprint in openSprints() ORDER BY rank')
                ->click($french ? 'Afficher les tickets' : 'Show issues')
                ->assertCount('[data-slot="import-preview"] li', 12)
                ->click('[data-slot="import-preview"] li [role="checkbox"][aria-label="ATLAS-1290"]')
                ->click('[data-slot="import-preview"] li [role="checkbox"][aria-label="ATLAS-1291"]')
                ->click('[data-slot="import-preview"] li [role="checkbox"][aria-label="ATLAS-1292"]')
                ->assertCount('[data-slot="import-preview"] li [role="checkbox"][aria-checked="true"]', 9)
                ->assertPresent('[role="dialog"] #new-poker-task-timer')
                ->assertPresent('[role="dialog"] #new-poker-revote')
                ->assertPresent('[role="dialog"] #new-poker-write-back');

            $page->script(<<<'JS'
                () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
                    const body = document.querySelector('[data-slot="session-dialog-body"]');
                    const timerRow = document.querySelector('#new-poker-task-timer').closest('[data-slot="setting-row"]') ?? document.querySelector('#new-poker-task-timer');

                    document.querySelector('[data-slot="import-preview"] ul').scrollTop = 0;
                    body.scrollTop += timerRow.getBoundingClientRect().top - body.getBoundingClientRect().top - 8;
                    resolve(true);
                })))
                JS);

            return $page;
        },
    );
});
