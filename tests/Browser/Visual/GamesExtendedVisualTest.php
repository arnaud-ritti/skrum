<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\GameRoundOutcome;
use App\Enums\GameWeather;
use App\Enums\GameWordTheme;
use App\Enums\WorkspaceRole;
use App\Models\GameChoice;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\GameStatementSet;
use App\Models\GameTextAnswer;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Seven members of one team; the first one hosts every room and is the viewer.
 *
 * @return Collection<int, User>
 */
function gamesExtendedVisualTeam(): Collection
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $names = ['Arnaud Ritti', 'Malik Benali', 'Inès Bernard', 'Camille Roux', 'Théo Martin', 'Sofia Lindqvist', 'Maximilian Alexander von Hohenberg-Lichtenstein'];

    foreach ($names as $index => $name) {
        $user = User::factory()->create([
            'id' => sprintf('0199b270-0000-7000-8000-00000000000%d', $index + 1),
            'name' => $name,
            'email' => "player{$index}@example.com",
        ]);
        $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($user);
    }

    return User::query()->orderBy('email')->get();
}

/**
 * @param  Collection<int, User>  $users
 * @param  array<string, mixed>  $attributes
 * @return array{0: GameRoom, 1: array<int, GamePlayer>}
 */
function gamesExtendedVisualRoom(Collection $users, string $id, GameKind $game, array $attributes = [], int $playersCount = 6): array
{
    $room = GameRoom::factory()->create([
        'id' => $id,
        'team_id' => Team::query()->sole()->id,
        'name' => 'Monday warm-up of the platform guild',
        'game' => $game,
        'locale' => 'fr',
        'access' => GameRoomAccess::Link,
        'created_by_user_id' => $users[0]->id,
        ...$attributes,
    ]);
    $players = $users->take($playersCount)
        ->map(fn (User $user): GamePlayer => GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $user->id]))
        ->all();

    $room->update(['host_player_id' => $players[0]->id]);

    return [$room, $players];
}

/**
 * @param  array<int, GamePlayer>  $players
 */
function gamesExtendedVisualScores(GameRoom $room, array $players): void
{
    foreach ($players as $index => $player) {
        awardGamePoints($room, $player, 42 - 6 * $index, $index === 1, ['created_at' => now()]);
    }
}

/**
 * The turn of a round: its order, the player whose turn it is, and the deadline.
 *
 * @param  array<int, GamePlayer>  $order
 * @return array<string, mixed>
 */
function gamesExtendedVisualTurn(array $order, GamePlayer $current, int $seconds, int $remaining): array
{
    return [
        'turn_order' => array_map(fn (GamePlayer $player): string => $player->id, $order),
        'turn_player_id' => $current->id,
        'turn_seconds' => $seconds,
        'turn_ends_at' => now()->startOfSecond()->addSeconds($remaining),
    ];
}

/**
 * @param  array<string, string>  $options
 */
function gamesExtendedVisualVisit(User $user, string $path, array $options, string $marker): mixed
{
    $page = visualSignIn($user, $path, $options);

    return $page->assertPresent($marker)
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertCount('[data-realtime]', 1)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

beforeEach(function () {
    config(['app.name' => 'Skrum']);

    RateLimiter::for('login', fn (): Limit => Limit::none());
});

it('renders hangman in turns without overflow', function (string $name, bool $viewerPlays) {
    $users = gamesExtendedVisualTeam();

    [$room, $players] = gamesExtendedVisualRoom($users, '0199b270-0000-7000-9000-0000000000a1', GameKind::Hangman, [
        'word_themes' => [GameWordTheme::Work->value],
        'turn_seconds' => 30,
        'takes_turns' => true,
        'rounds_per_game' => 5,
    ], 4);

    gamesExtendedVisualScores($room, $players);

    $round = activeGameRound($room, [
        'word' => 'déploiement',
        'picked_letters' => ['e', 'a', 't', 'o', 'r', 'i'],
        'picked_by' => [$players[1]->id, $players[2]->id, $players[3]->id, $players[0]->id, $players[1]->id, $players[2]->id],
        'revealed_positions' => [1, 4, 5, 6, 8, 10],
        'misses' => 3,
        'number' => 2,
        'rounds_total' => 5,
        'started_at' => now()->subMinute()->startOfSecond(),
        ...gamesExtendedVisualTurn($players, $viewerPlays ? $players[0] : $players[2], 30, 24),
    ]);

    GameGuess::factory()->create([
        'game_round_id' => $round->id,
        'player_id' => $players[3]->id,
        'text' => 'déplacement',
        'is_near_miss' => false,
        'is_correct' => false,
        'created_at' => now()->subSeconds(10),
    ]);

    $this->captureVisuals(
        $name,
        "/games/{$room->id}",
        fn (string $path, array $options) => gamesExtendedVisualVisit($users[0], $path, $options, '[data-slot="hangman-turn-banner"]')
            ->assertPresent('[data-slot="turn-order"]')
            ->assertPresent('[data-slot="game-settings-card"]'),
    );
})->with([
    'the viewer\'s turn' => ['game-hangman-turns', true],
    'another player\'s turn' => ['game-hangman-out-of-turn', false],
]);

it('renders Draw & Guess and Decoded with their settings without overflow', function (string $name, GameKind $game, bool $leads, string $marker) {
    $users = gamesExtendedVisualTeam();

    [$room, $players] = gamesExtendedVisualRoom($users, '0199b270-0000-7000-9000-0000000000b1', $game, [
        'word_themes' => $game === GameKind::Decoded
            ? [GameWordTheme::Work->value, GameWordTheme::Food->value]
            : [GameWordTheme::Work->value],
        'turn_seconds' => 80,
        'auto_hints' => true,
        'rounds_per_game' => 6,
    ]);

    gamesExtendedVisualScores($room, $players);

    activeGameRound($room, [
        'word' => 'pause café',
        'leader_player_id' => $players[$leads ? 0 : 1]->id,
        'revealed_positions' => [2],
        'clue' => $game === GameKind::Decoded ? ['☕', '🥐', '⏸️'] : [],
        'drawing' => $game === GameKind::DrawAndGuess ? [
            ['type' => 'stroke', 'color' => 'black', 'size' => 10, 'points' => [[330, 300], [330, 520], [360, 560], [560, 560], [590, 520], [590, 300], [330, 300]]],
            ['type' => 'stroke', 'color' => 'apricot', 'size' => 10, 'points' => [[590, 350], [670, 360], [680, 430], [590, 470]]],
            ['type' => 'stroke', 'color' => 'coral', 'size' => 4, 'points' => [[400, 250], [380, 200], [410, 160], [390, 110]]],
            ['type' => 'fill', 'color' => 'sun', 'x' => 460, 'y' => 430],
        ] : [],
        'drawing_points' => 18,
        'number' => 3,
        'rounds_total' => 6,
        'hint_seconds' => 30,
        'turn_seconds' => 80,
        'started_at' => now()->subSeconds(48)->startOfSecond(),
        'turn_ends_at' => now()->addSeconds(32)->startOfSecond(),
    ]);

    $this->captureVisuals(
        $name,
        "/games/{$room->id}",
        fn (string $path, array $options) => gamesExtendedVisualVisit($users[0], $path, $options, $marker)
            ->assertPresent('[data-slot="round-info"]')
            ->assertPresent('[data-slot="turn-timer"]'),
    );
})->with([
    'the drawer, round 3 of 6' => ['game-draw-settings', GameKind::DrawAndGuess, true, '[data-slot="drawing-toolbar"]'],
    'a guesser and the next letter' => ['game-draw-guesser-hints', GameKind::DrawAndGuess, false, '[data-slot="auto-hint-countdown"]'],
    'Decoded with categories and auto hints' => ['game-decoded-settings', GameKind::Decoded, false, '[data-slot="auto-hint-countdown"]'],
]);

it('renders Sprint in one GIF with a caption and with its podium without overflow', function (string $name, bool $results, string $marker) {
    $users = gamesExtendedVisualTeam();

    fakeVisualGifs();

    [$room, $players] = gamesExtendedVisualRoom($users, '0199b270-0000-7000-9000-0000000000c1', GameKind::SprintGif, [
        'gif_votes' => 2,
        'gif_authors_hidden' => true,
    ], 7);

    $round = activeGameRound($room, [
        'word' => null,
        'question' => 'Quel GIF résume ton sprint 42 ?',
        'votes_allowed' => 2,
        'authors_hidden' => true,
        'revealed_at' => $results ? now()->subMinute()->startOfSecond() : null,
        ...($results ? ['outcome' => GameRoundOutcome::Revealed, 'ended_at' => now()->startOfSecond()] : []),
    ]);

    $captions = ['La démo du vendredi', 'Quand la CI passe enfin', 'Le daily de lundi', 'Ma tête au refinement', 'Après la mise en prod', 'Le backlog en fin de sprint'];
    $senders = $results ? [0, 1, 2, 3, 4, 5] : [1, 2, 3];
    $answers = [];

    foreach ($senders as $index) {
        $answers[$index] = GameGifAnswer::factory()->create([
            'game_round_id' => $round->id,
            'player_id' => $players[$index]->id,
            'gif_id' => "sprint{$index}",
            'caption' => $captions[$index],
        ]);
    }

    if ($results) {
        foreach ([[0, 1], [0, 2], [1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 2], [4, 5], [4, 0], [5, 4], [5, 0]] as [$voter, $answer]) {
            GameGifVote::factory()->create([
                'game_round_id' => $round->id,
                'voter_player_id' => $players[$voter]->id,
                'answer_id' => $answers[$answer]->id,
            ]);
        }
    }

    $this->captureVisuals(
        $name,
        "/games/{$room->id}",
        function (string $path, array $options) use ($users, $marker, $results) {
            $page = gamesExtendedVisualVisit($users[0], $path, $options, $marker);

            if (! $results) {
                $page->click('[data-slot="gif-answer-stage"] [role="listbox"] > div:first-child > [role="option"]:first-child')
                    ->assertPresent('[data-slot="gif-caption-field"]')
                    ->fill('[data-slot="gif-caption-field"] input', 'Moi devant le burndown')
                    ->assertSeeIn('[data-slot="gif-your-pick"]', str_starts_with($options['locale'], 'fr') ? 'Brouillon' : 'Draft');
            }

            return $page->assertScript('[...document.querySelectorAll(\'[data-slot="gif-tile"] img\')].every((image) => image.complete && image.naturalWidth > 0)', true);
        },
    );
})->with([
    'step 1, a caption and the draft' => ['game-gif-pick-caption', false, '[data-slot="gif-answer-stage"] [data-slot="gif-picker"] [role="option"]'],
    'step 3, a tie for first' => ['game-gif-results-podium', true, '[data-slot="gif-podium"] [data-slot="gif-podium-winner"]'],
]);

it('renders the picker of the eight games without overflow', function () {
    $users = gamesExtendedVisualTeam();

    [$room, $players] = gamesExtendedVisualRoom($users, '0199b270-0000-7000-9000-0000000000d1', GameKind::Hangman, [
        'takes_turns' => true,
        'turn_seconds' => 30,
    ], 4);

    gamesExtendedVisualScores($room, $players);

    $this->captureVisuals(
        'game-picker-eight',
        "/games/{$room->id}",
        fn (string $path, array $options) => gamesExtendedVisualVisit($users[0], $path, $options, '[data-slot="game-picker"] [data-slot="icebreaker-game-card"]')
            ->assertCount('[data-slot="game-picker"] [data-slot="icebreaker-game-card"]', 8),
    );
});

it('renders Two truths and a lie without overflow', function (string $name, bool $inRound, string $marker) {
    $users = gamesExtendedVisualTeam();

    [$room, $players] = gamesExtendedVisualRoom($users, '0199b270-0000-7000-9000-0000000000e1', GameKind::TwoTruths);

    $statements = ["J'ai couru un marathon en 2019", "J'ai grandi sur une île", "Je n'ai jamais bu de café"];

    if ($inRound) {
        $round = activeGameRound($room, [
            'word' => null,
            'leader_player_id' => $players[1]->id,
            'statements' => $statements,
            'lie_index' => 2,
            'number' => 2,
            'started_at' => now()->subSeconds(40)->startOfSecond(),
        ]);

        foreach ([[2, '0'], [3, '2'], [5, '1']] as [$voter, $choice]) {
            GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $players[$voter]->id, 'choice' => $choice]);
        }

        GameStatementSet::factory()->played()->create(['game_room_id' => $room->id, 'player_id' => $players[1]->id, 'statements' => $statements, 'lie_index' => 2]);
    }

    $sets = [
        0 => ["J'ai déjà sauté en parachute", 'Je parle quatre langues', "J'ai un chat qui s'appelle Jira"],
        2 => ["J'ai joué dans un groupe de rock", "J'ai visité trente pays", 'Je dors huit heures par nuit'],
        3 => ['Je fais mon pain moi-même', "J'ai rencontré un astronaute", "Je n'ai jamais vu la mer"],
    ];

    foreach ($sets as $index => $set) {
        GameStatementSet::factory()->create(['game_room_id' => $room->id, 'player_id' => $players[$index]->id, 'statements' => $set, 'lie_index' => 1]);
    }

    $this->captureVisuals(
        $name,
        "/games/{$room->id}",
        fn (string $path, array $options) => gamesExtendedVisualVisit($users[0], $path, $options, $marker)
            ->assertPresent('[data-slot="two-truths-set-form"]'),
    );
})->with([
    'a voter during a round' => ['game-two-truths-vote', true, '[data-slot="two-truths-board"]'],
    'the waiting stage with sets ready' => ['game-two-truths-sets', false, '[data-slot="round-start-card"]'],
]);

it('renders the results of Mood weather without overflow', function () {
    $users = gamesExtendedVisualTeam();

    [$room, $players] = gamesExtendedVisualRoom($users, '0199b270-0000-7000-9000-0000000000f1', GameKind::MoodWeather, playersCount: 7);

    $round = activeGameRound($room, [
        'word' => null,
        'revealed_at' => now()->startOfSecond(),
        'outcome' => GameRoundOutcome::Revealed,
        'ended_at' => now()->startOfSecond(),
    ]);

    $weathers = [GameWeather::Sunny, GameWeather::PartlyCloudy, GameWeather::Sunny, GameWeather::Cloudy, GameWeather::PartlyCloudy, GameWeather::Rainy, GameWeather::PartlyCloudy];

    foreach ($weathers as $index => $weather) {
        GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $players[$index]->id, 'choice' => $weather->value]);
    }

    $this->captureVisuals(
        'game-mood-results',
        "/games/{$room->id}",
        fn (string $path, array $options) => gamesExtendedVisualVisit($users[0], $path, $options, '[data-slot="mood-weather-result"]'),
    );
});

it('renders the vote of Guess who? on the drawn answer without overflow', function () {
    $users = gamesExtendedVisualTeam();

    [$room, $players] = gamesExtendedVisualRoom($users, '0199b270-0000-7000-9000-0000000000f2', GameKind::GuessWho);

    gamesExtendedVisualScores($room, $players);

    $round = activeGameRound($room, [
        'word' => null,
        'question' => 'Quel loisir surprendrait tes collègues ?',
        'number' => 1,
        'started_at' => now()->subMinutes(2)->startOfSecond(),
        'revealed_at' => now()->subSeconds(20)->startOfSecond(),
    ]);

    $texts = [0 => 'Le tir à l\'arc', 2 => 'La broderie au point de croix', 3 => 'Le chant lyrique', 4 => 'La plongée en apnée', 5 => 'Les échecs par correspondance'];

    foreach ($texts as $index => $text) {
        $answer = GameTextAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $players[$index]->id, 'text' => $text]);

        if ($index === 3) {
            $answer->forceFill(['is_drawn' => true])->save();
        }
    }

    foreach ([2, 4] as $voter) {
        GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $players[$voter]->id, 'choice' => $players[5]->id]);
    }

    $this->captureVisuals(
        'game-guess-who-vote',
        "/games/{$room->id}",
        fn (string $path, array $options) => gamesExtendedVisualVisit($users[0], $path, $options, '[data-slot="guess-who-vote"]'),
    );
});

it('renders a speaker\'s turn of Quick question without overflow', function () {
    $users = gamesExtendedVisualTeam();

    [$room, $players] = gamesExtendedVisualRoom($users, '0199b270-0000-7000-9000-0000000000f3', GameKind::QuickQuestion, [
        'turn_seconds' => 60,
        'takes_turns' => true,
    ], 5);

    activeGameRound($room, [
        'word' => null,
        'question' => 'Quel est le meilleur conseil qu\'on t\'ait donné ?',
        'number' => 1,
        'started_at' => now()->subMinute()->startOfSecond(),
        ...gamesExtendedVisualTurn($players, $players[2], 60, 41),
    ]);

    $this->captureVisuals(
        'game-quick-question',
        "/games/{$room->id}",
        fn (string $path, array $options) => gamesExtendedVisualVisit($users[0], $path, $options, '[data-slot="quick-question-speaker"]'),
    );
});

it('renders the end card after the last round of a game without overflow', function () {
    $users = gamesExtendedVisualTeam();

    [$room, $players] = gamesExtendedVisualRoom($users, '0199b270-0000-7000-9000-0000000000f4', GameKind::Hangman, [
        'takes_turns' => true,
        'turn_seconds' => 30,
        'rounds_per_game' => 3,
    ], 5);

    foreach ([1, 2] as $number) {
        GameRound::factory()->ended()->create([
            'game_room_id' => $room->id,
            'game' => GameKind::Hangman,
            'word' => $number === 1 ? 'rétrospective' : 'backlog',
            'number' => $number,
            'rounds_total' => 3,
            'winner_player_id' => $players[$number]->id,
            'started_at' => now()->subMinutes(10 - 3 * $number)->startOfSecond(),
            'ended_at' => now()->subMinutes(8 - 3 * $number)->startOfSecond(),
        ]);
    }

    activeGameRound($room, [
        'word' => 'déploiement',
        'revealed_positions' => range(0, 10),
        'number' => 3,
        'rounds_total' => 3,
        'outcome' => GameRoundOutcome::Solved,
        'started_at' => now()->subMinutes(2)->startOfSecond(),
        'ended_at' => now()->startOfSecond(),
        'winner_player_id' => $players[2]->id,
    ]);

    gamesExtendedVisualScores($room, $players);

    $this->captureVisuals(
        'game-over',
        "/games/{$room->id}",
        fn (string $path, array $options) => gamesExtendedVisualVisit($users[0], $path, $options, '[data-slot="round-end-card"] [data-slot="final-scores"]'),
    );
});
