<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\GameRoundOutcome;
use App\Enums\WorkspaceRole;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GameGuess;
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
function gamesVisualGames(bool $filled): array
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
function gamesVisualGamesVisit(User $user, string $path, array $options, string $marker): mixed
{
    $page = visualSignIn($user, $path, $options);

    return $page->assertPresent($marker)
        ->assertNotPresent('[data-slot="leaderboard-skeleton"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

it('renders the team games page without overflow', function (string $name, bool $filled, string $marker) {
    config(['app.name' => 'Skrum']);

    [$user, $path] = gamesVisualGames($filled);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        $path,
        fn (string $path, array $options) => gamesVisualGamesVisit($user, $path, $options, $marker),
    );
})->with([
    'rooms and leaderboard' => ['games-index-page', true, '[data-slot="team-games"] [data-slot="leaderboard-row"]'],
    'empty' => ['games-index-empty-page', false, '[data-slot="team-games"] [data-slot="games-empty"]'],
]);

it('renders the guest join page of a game room without overflow', function (string $name, bool $valid, string $marker) {
    config(['app.name' => 'Skrum']);

    gamesVisualGames(false);

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
            $page = browserVisit($path, $options)->assertPresent($marker);

            return $valid ? $page->fill('#name', 'Happy Otter') : $page;
        },
    );
})->with([
    'join' => ['games-join-page', true, '[data-slot="guest-join"]'],
    'invalid link' => ['games-join-invalid-page', false, '[data-slot="access-notice"]'],
]);

it('renders a hangman room without overflow', function (string $name, bool $playing, string $marker) {
    config(['app.name' => 'Skrum']);

    gamesVisualGames(false);

    $team = Team::query()->sole();
    $users = User::query()->orderBy('email')->get();
    $room = GameRoom::factory()->create([
        'id' => '0199b000-0000-7000-9000-0000000000a1',
        'team_id' => $team->id,
        'name' => 'Monday warm-up of the platform guild',
        'game' => GameKind::Hangman,
        'access' => GameRoomAccess::Link,
        'created_by_user_id' => $users[0]->id,
    ]);
    $players = $users->take(6)
        ->map(fn (User $user): GamePlayer => GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $user->id]));

    $room->update(['host_player_id' => $players[0]->id]);

    foreach ($players as $index => $player) {
        awardGamePoints($room, $player, 60 - 10 * $index, $index === 0, ['created_at' => now()]);
    }

    $attributes = [
        'word' => 'déploiement',
        'picked_letters' => ['a', 'e', 'r', 't', 's', 'o', 'l', 'n'],
        'picked_by' => array_fill(0, 8, $players[1]->id),
        'revealed_positions' => [1, 3, 4, 6, 8, 9, 10],
        'misses' => 3,
    ];

    activeGameRound($room, $playing ? $attributes : [
        ...$attributes,
        'revealed_positions' => range(0, 10),
        'outcome' => GameRoundOutcome::Solved,
        'ended_at' => now()->startOfSecond(),
        'winner_player_id' => $players[2]->id,
    ]);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        "/games/{$room->id}",
        fn (string $path, array $options) => gamesVisualGamesVisit($users[0], $path, $options, $marker)
            ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
            ->assertCount('[data-realtime]', 1),
    );
})->with([
    'a round in play' => ['games-room-hangman', true, '[data-slot="hangman-board"]'],
    'between two rounds' => ['games-room-hangman-end', false, '[data-slot="round-end-card"]'],
]);

it('renders a Draw & Guess room and a Decoded room without overflow', function (string $name, GameKind $game, bool $leads, string $marker, bool $opensGuesses = false) {
    config(['app.name' => 'Skrum']);

    gamesVisualGames(false);

    $team = Team::query()->sole();
    $users = User::query()->orderBy('email')->get();
    $room = GameRoom::factory()->create([
        'id' => '0199b000-0000-7000-9000-0000000000b1',
        'team_id' => $team->id,
        'name' => 'Monday warm-up of the platform guild',
        'game' => $game,
        'access' => GameRoomAccess::Link,
        'created_by_user_id' => $users[0]->id,
    ]);
    $players = $users->take(6)
        ->map(fn (User $user): GamePlayer => GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $user->id]));

    $room->update(['host_player_id' => $players[0]->id]);

    foreach ($players as $index => $player) {
        awardGamePoints($room, $player, 60 - 10 * $index, $index === 0, ['created_at' => now()]);
    }

    $round = activeGameRound($room, [
        'word' => 'pause café',
        'leader_player_id' => $players[$leads ? 0 : 1]->id,
        'revealed_positions' => [2],
        'clue' => $game === GameKind::Decoded ? ['☕', '🥐', '⏸️'] : [],
        'drawing' => $game === GameKind::DrawAndGuess ? [
            ['type' => 'stroke', 'color' => 'black', 'size' => 10, 'points' => [[330, 300], [330, 520], [360, 560], [560, 560], [590, 520], [590, 300], [330, 300]]],
            ['type' => 'stroke', 'color' => 'apricot', 'size' => 10, 'points' => [[590, 350], [670, 360], [680, 430], [590, 470]]],
            ['type' => 'stroke', 'color' => 'coral', 'size' => 4, 'points' => [[400, 250], [380, 200], [410, 160], [390, 110]]],
            ['type' => 'stroke', 'color' => 'coral', 'size' => 4, 'points' => [[500, 250], [480, 200], [510, 160], [490, 110]]],
            ['type' => 'stroke', 'color' => 'sky', 'size' => 24, 'points' => [[240, 640], [700, 640]]],
            ['type' => 'fill', 'color' => 'sun', 'x' => 460, 'y' => 430],
        ] : [],
        'drawing_points' => 24,
    ]);

    $guesses = [[2, 'tasse', false], [3, 'cuisine', false], [4, 'chocolat chaud', false], [$leads ? 2 : 0, 'pause thé', true], [5, 'une réponse longue de cinquante caractères environ', false]];

    foreach ($guesses as $index => [$player, $text, $isNearMiss]) {
        GameGuess::factory()->create([
            'game_round_id' => $round->id,
            'player_id' => $players[$player]->id,
            'text' => $text,
            'is_near_miss' => $isNearMiss,
            'created_at' => now()->subSeconds(60 - $index),
        ]);
    }

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        "/games/{$room->id}",
        function (string $path, array $options, int $width) use ($users, $marker, $opensGuesses, $game) {
            $page = gamesVisualGamesVisit($users[0], $path, $options, $marker)
                ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
                ->assertCount('[data-realtime]', 1)
                ->assertPresent($game === GameKind::Decoded ? '[data-slot="decoded-answer"]' : 'section[aria-labelledby="game-guesses"]');

            if ($opensGuesses && $width === 390) {
                $page->resize(390, 844)
                    ->click('[data-slot="guess-dock"] button[aria-haspopup="dialog"]')
                    ->assertPresent('[role="dialog"] [role="log"]');
            }

            return $page;
        },
    );
})->with([
    'the drawer' => ['games-room-draw', GameKind::DrawAndGuess, true, '[data-slot="drawing-toolbar"]'],
    'a guesser of the drawing' => ['games-room-draw-guesser', GameKind::DrawAndGuess, false, '[data-slot="draw-sheet"] canvas:not(.cursor-crosshair)'],
    'the guesses of the drawing, in their drawer on a phone' => ['games-room-draw-guesses', GameKind::DrawAndGuess, false, '[data-slot="draw-sheet"] canvas:not(.cursor-crosshair)', true],
    'the clue giver' => ['games-room-decoded', GameKind::Decoded, true, '[data-slot="clue-editor"]'],
    'a guesser of the clue' => ['games-room-decoded-guesser', GameKind::Decoded, false, '[data-slot="clue-row"]'],
]);

it('renders a Sprint in one GIF room without overflow', function (string $name, string $step, string $marker) {
    config(['app.name' => 'Skrum']);

    gamesVisualGames(false);
    fakeVisualGifs();

    $team = Team::query()->sole();
    $users = User::query()->orderBy('email')->get();
    $room = GameRoom::factory()->create([
        'id' => '0199b000-0000-7000-9000-0000000000c1',
        'team_id' => $team->id,
        'name' => 'Monday warm-up of the platform guild',
        'game' => GameKind::SprintGif,
        'access' => GameRoomAccess::Link,
        'created_by_user_id' => $users[0]->id,
    ]);
    $players = $users->take(7)
        ->map(fn (User $user): GamePlayer => GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $user->id]));

    $room->update(['host_player_id' => $players[0]->id]);

    $round = activeGameRound($room, [
        'word' => null,
        'question' => 'Which GIF sums up your sprint 42?',
        'revealed_at' => $step === 'picking' ? null : now()->startOfSecond(),
        ...($step === 'results' ? ['outcome' => GameRoundOutcome::Revealed, 'ended_at' => now()->startOfSecond()] : []),
    ]);

    $senders = $step === 'picking' ? [1, 2, 3] : [0, 1, 2, 3, 4, 6];
    $answers = [];

    foreach ($senders as $index) {
        $answers[$index] = GameGifAnswer::factory()->create([
            'game_round_id' => $round->id,
            'player_id' => $players[$index]->id,
            'gif_id' => "sprint{$index}",
        ]);
    }

    if ($step !== 'picking') {
        foreach ([[0, 1], [2, 1], [3, 1], [4, 2], [1, 2], [6, 3]] as [$voter, $answer]) {
            GameGifVote::factory()->create([
                'game_round_id' => $round->id,
                'voter_player_id' => $players[$voter]->id,
                'answer_id' => $answers[$answer]->id,
            ]);
        }
    }

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        "/games/{$room->id}",
        function (string $path, array $options) use ($users, $marker, $step) {
            $page = gamesVisualGamesVisit($users[0], $path, $options, $marker)
                ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
                ->assertCount('[data-realtime]', 1);

            if ($step === 'picking') {
                $page->click('[data-slot="gif-answer-stage"] [role="listbox"] > div:first-child > [role="option"]:first-child')
                    ->assertSeeIn('[data-slot="gif-your-pick"]', str_starts_with($options['locale'], 'fr') ? 'Brouillon' : 'Draft')
                    ->assertPresent('[data-slot="gif-your-pick"] [data-slot="gif-tile"]');
            }

            return $page->assertScript('[...document.querySelectorAll(\'[data-slot="gif-tile"] img\')].every((image) => image.complete && image.naturalWidth > 0)', true);
        },
    );
})->with([
    'picking a GIF' => ['games-room-gif', 'picking', '[data-slot="gif-answer-stage"] [data-slot="gif-picker"] [role="option"]'],
    'voting' => ['games-room-gif-voting', 'voting', '[data-slot="gif-gallery"] [data-slot="gif-tile"]'],
    'the results' => ['games-room-gif-results', 'results', '[data-slot="gif-results"] [data-slot="gif-tile"][data-winner]'],
]);
