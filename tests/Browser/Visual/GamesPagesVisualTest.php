<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\WorkspaceRole;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

/**
 * @return array{0: User, 1: string}
 */
function p18eVisualGames(bool $filled): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $names = ['Arnaud Ritti', 'Malik Benali', 'Inès Bernard', 'Camille Roux', 'Théo Martin', 'Sofia Lindqvist', 'Maximilian Alexander von Hohenberg-Lichtenstein'];
    $users = [];

    foreach ($names as $index => $name) {
        $user = User::factory()->create([
            'id' => sprintf('0199b000-0000-7000-8000-00000000000%d', $index + 1),
            'name' => $name,
            'email' => "player{$index}@example.com",
        ]);
        $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($user);
        $users[] = $user;
    }

    $path = route('teams.games.index', [$workspace, $team], false);

    if (! $filled) {
        return [$users[0], $path];
    }

    $rooms = [
        ['Daily warm-up', GameKind::Hangman, 7, true, false],
        ['Sprint 43 kick-off with a long name that has to be cut off', GameKind::DrawAndGuess, 2, false, true],
        ['Friday fun', GameKind::Decoded, 4, true, true],
        ['Retro warm-up', GameKind::SprintGif, 0, false, false],
    ];
    $first = null;
    $firstPlayers = [];

    foreach ($rooms as $index => [$name, $game, $playersCount, $playing, $byLink]) {
        $room = GameRoom::factory()->create([
            'id' => sprintf('0199b000-0000-7000-9000-00000000000%d', $index + 1),
            'team_id' => $team->id,
            'name' => $name,
            'game' => $game,
            'access' => $byLink ? GameRoomAccess::Link : GameRoomAccess::Team,
            'updated_at' => now()->subHours($index),
        ]);
        $players = [];

        foreach (array_slice($users, 0, $playersCount) as $user) {
            $players[] = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $user->id]);
        }

        if ($playing) {
            activeGameRound($room, ['started_at' => now()->subMinutes(4 + 8 * $index)]);
        }

        $first ??= $room;
        $firstPlayers = $firstPlayers === [] ? $players : $firstPlayers;
    }

    foreach ($firstPlayers as $index => $player) {
        awardGamePoints($first, $player, 1480 - 190 * $index, $index < 3, ['created_at' => now()->subWeek()]);

        if ($index % 3 === 0) {
            awardGamePoints($first, $player, 12, false, ['created_at' => now()]);
        }
    }

    return [$users[0], $path];
}

/**
 * @param  array<string, string>  $options
 */
function p18eVisualGamesVisit(User $user, string $path, array $options, string $marker): mixed
{
    User::query()->whereKey($user->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

    $page = visit('/login', $options);

    $page->fill('#email', $user->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    $page->navigate($path);

    return $page->assertPresent($marker)
        ->assertNotPresent('[data-slot="leaderboard-skeleton"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

it('renders the team games page without overflow', function (string $name, bool $filled, string $marker) {
    config(['app.name' => 'Skrum']);

    [$user, $path] = p18eVisualGames($filled);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        $path,
        fn (string $path, array $options) => p18eVisualGamesVisit($user, $path, $options, $marker),
    );
})->with([
    'rooms and leaderboard' => ['games-index-page', true, '[data-slot="team-games"] [data-slot="leaderboard-row"]'],
    'empty' => ['games-index-empty-page', false, '[data-slot="team-games"] [data-slot="games-empty"]'],
]);

it('renders the guest join page of a game room without overflow', function (string $name, bool $valid, string $marker) {
    config(['app.name' => 'Skrum']);

    p18eVisualGames(false);

    $room = GameRoom::factory()->create([
        'team_id' => Team::query()->sole()->id,
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'access' => $valid ? GameRoomAccess::Link : GameRoomAccess::Team,
    ]);

    $players = User::query()->orderBy('email')->limit(3)->get()
        ->map(fn (User $user): GamePlayer => GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $user->id]));

    $room->update(['host_player_id' => $players->firstOrFail()->id]);

    $this->captureVisuals(
        $name,
        route('games.join.show', $room->guest_token, false),
        function (string $path, array $options) use ($valid, $marker) {
            $page = visit($path, $options)->assertPresent($marker);

            return $valid ? $page->fill('#name', 'Happy Otter') : $page;
        },
    );
})->with([
    'join' => ['games-join-page', true, '[data-slot="guest-join"]'],
    'invalid link' => ['games-join-invalid-page', false, '[data-slot="access-notice"]'],
]);
