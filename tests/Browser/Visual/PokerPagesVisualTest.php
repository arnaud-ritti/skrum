<?php

use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\SavedPokerDeck;
use App\Models\Team;
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
