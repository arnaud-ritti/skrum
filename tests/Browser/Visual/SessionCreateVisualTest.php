<?php

use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\SavedPokerDeck;
use App\Models\Team;
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
            ->assertCount('[data-slot="session-create-whole"][data-state="games"] [role="radiogroup"] [role="radio"]', 4)
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
