<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\GameWeather;
use App\Models\GameChoice;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameStatementSet;
use App\Models\GameTextAnswer;
use App\Support\Games\GameRoomSettings;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Browser\Support\DocsWorld;

function docsGamesRoom(DocsWorld $world, GameKind $game, array $names, array $attributes = []): array
{
    $room = GameRoom::factory()->create([
        'id' => '0199d0c5-0000-7000-9000-000000000001',
        'team_id' => $world->team->id,
        'name' => 'Friday warm-up',
        'game' => $game,
        'access' => GameRoomAccess::Link,
        'created_by_user_id' => $world->person($names[0])->id,
        ...GameRoomSettings::forNewRoom(),
        ...$attributes,
    ]);
    $players = [];

    foreach ($names as $index => $name) {
        $players[$name] = GamePlayer::factory()->create([
            'id' => sprintf('0199d0c5-0000-7000-a000-%012d', $index + 1),
            'game_room_id' => $room->id,
            'user_id' => $world->person($name)->id,
            'created_at' => now()->subMinutes(30 - $index),
        ]);
    }

    $room->update(['host_player_id' => $players[$names[0]]->id]);

    return [$room, $players];
}

function docsGamesReady(mixed $page, string $marker): mixed
{
    return $page->assertPresent($marker)
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

function docsGamesPictureId(string $kind, int $number): string
{
    return sprintf('0199d0c5-0000-7000-%s-%012d', $kind, $number);
}

function docsGamesGifPicture(string $gifId): string
{
    $scenes = [
        'burndown' => [[250, 247, 240], [
            ['line', [60, 55, 50], 70, 40, 70, 310, 6], ['line', [60, 55, 50], 70, 310, 430, 310, 6],
            ['line', [190, 80, 50], 70, 70, 190, 150, 10], ['line', [190, 80, 50], 190, 150, 290, 170, 10], ['line', [190, 80, 50], 290, 170, 420, 290, 10],
            ['ellipse', [190, 80, 50], 420, 290, 34, 34],
        ]],
        'checks' => [[40, 150, 100], [
            ['ellipse', [255, 255, 255], 240, 180, 230, 230],
            ['line', [40, 150, 100], 180, 185, 225, 230, 26], ['line', [40, 150, 100], 225, 230, 305, 135, 26],
        ]],
        'demo' => [[45, 40, 70], [
            ['rectangle', [235, 232, 250], 90, 60, 390, 250],
            ['polygon', [190, 80, 50], [205, 110, 205, 200, 290, 155]],
            ['rectangle', [235, 232, 250], 225, 250, 255, 300], ['rectangle', [235, 232, 250], 170, 295, 310, 310],
        ]],
        'sunrise' => [[250, 200, 150], [
            ['ellipse', [252, 232, 130], 240, 235, 190, 190],
            ['ellipse', [70, 110, 90], 110, 360, 420, 240], ['ellipse', [50, 85, 75], 390, 370, 400, 210],
        ]],
        'rocket' => [[25, 40, 80], [
            ['ellipse', [255, 255, 255], 80, 70, 8, 8], ['ellipse', [255, 255, 255], 400, 110, 10, 10], ['ellipse', [255, 255, 255], 340, 300, 6, 6], ['ellipse', [255, 255, 255], 120, 280, 8, 8],
            ['polygon', [245, 160, 60], [215, 250, 265, 250, 240, 335]],
            ['polygon', [240, 240, 245], [240, 50, 285, 130, 285, 250, 195, 250, 195, 130]],
            ['ellipse', [90, 170, 220], 240, 150, 46, 46],
            ['polygon', [190, 80, 50], [195, 200, 150, 265, 195, 250]], ['polygon', [190, 80, 50], [285, 200, 330, 265, 285, 250]],
        ]],
    ];

    [$background, $shapes] = $scenes[$gifId];
    $drawn = imagecreatetruecolor(1440, 1080);
    $tripled = fn (array $values): array => array_map(fn (int $value): int => $value * 3, $values);

    imagefill($drawn, 0, 0, imagecolorallocate($drawn, ...$background));

    foreach ($shapes as $shape) {
        $colour = imagecolorallocate($drawn, ...$shape[1]);

        match ($shape[0]) {
            'ellipse' => imagefilledellipse($drawn, ...[...$tripled(array_slice($shape, 2)), $colour]),
            'rectangle' => imagefilledrectangle($drawn, ...[...$tripled(array_slice($shape, 2)), $colour]),
            'polygon' => imagefilledpolygon($drawn, $tripled($shape[2]), $colour),
            'line' => imagesetthickness($drawn, $shape[6] * 3) && imageline($drawn, ...[...$tripled(array_slice($shape, 2, 4)), $colour]),
        };
    }

    $image = imagecreatetruecolor(480, 360);

    imagecopyresampled($image, $drawn, 0, 0, 0, 0, 480, 360, 1440, 1080);

    ob_start();
    imagegif($image);

    return (string) ob_get_clean();
}

function docsGamesFakeGifs(): void
{
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'docs-gif-key', 'rating' => 'pg']]);

    Storage::fake();

    Http::fake([
        'api.giphy.com/*' => fn (HttpRequest $request) => Http::response(['data' => giphyItem(basename((string) parse_url($request->url(), PHP_URL_PATH)))]),
        'media.giphy.com/*' => fn (HttpRequest $request) => Http::response(
            docsGamesGifPicture(explode('/', trim((string) parse_url($request->url(), PHP_URL_PATH), '/'))[0]),
            200,
            ['Content-Type' => 'image/gif'],
        ),
    ]);
}

it('shows the new session dialog on the Icebreaker type with the eight games', function () {
    $world = DocsWorld::create();

    docsGamesFakeGifs();

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false).'?new=icebreaker')
        ->resize(1440, 1320)
        ->assertPresent('[role="dialog"] [data-slot="icebreaker-session-fields"]')
        ->assertCount('[role="dialog"] [data-slot="icebreaker-game-card"]', 8)
        ->assertNotPresent('[role="dialog"] [data-slot="icebreaker-game-card"][aria-disabled="true"]')
        ->fill('#new-icebreaker-name', 'Friday warm-up');

    $this->docShot($page, 'games/new-game', '[role="dialog"]');
});

it('shows a game room before its first round, with the players who joined', function () {
    $world = DocsWorld::create();

    docsGamesFakeGifs();

    [$room] = docsGamesRoom($world, GameKind::Hangman, ['Camille', 'Théo', 'Inès', 'Malik']);
    $path = route('games.show', $room, false);

    foreach (['Théo', 'Inès', 'Malik'] as $name) {
        docsGamesReady($this->docsVisit($world->person($name), $path), '[data-slot="round-start-card"]');
    }

    $page = docsGamesReady($this->docsVisit($world->person('Camille'), $path)->resize(1440, 1180), '[data-slot="round-start-card"]')
        ->assertCount('[data-slot="player-row"]:not([data-offline])', 4)
        ->assertCount('[data-slot="game-picker"] [data-slot="icebreaker-game-card"]', 8)
        ->assertPresent('[data-slot="game-settings-card"]');

    $this->docShot($page, 'games/lobby', 'body');
});

it('shows the leaderboard of the team on the Games tab of Insights', function () {
    $world = DocsWorld::create();

    [$room, $players] = docsGamesRoom($world, GameKind::Hangman, ['Camille', 'Théo', 'Inès', 'Malik', 'Sofia', 'Noa']);

    foreach (['Inès' => [64, 3], 'Théo' => [52, 2], 'Camille' => [47, 2], 'Noa' => [31, 1], 'Malik' => [26, 1], 'Sofia' => [18, 0]] as $name => [$points, $wins]) {
        awardGamePoints($room, $players[$name], $points - 5 * $wins, false, ['created_at' => now()]);

        foreach (range(1, max($wins, 1)) as $win) {
            awardGamePoints($room, $players[$name], $wins === 0 ? 0 : 5, $wins > 0, ['created_at' => now()]);
        }
    }

    $page = $this->docsVisit($world->person('Camille'), route('teams.games.index', [$world->workspace, $world->team], false))
        ->resize(1440, 700)
        ->assertPresent('[data-slot="team-games"] [data-slot="leaderboard-row"]')
        ->assertNotPresent('[data-slot="leaderboard-skeleton"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'games/index', 'main');
});

it('shows a round of Hangman in turns, on the turn of the viewer', function () {
    $world = DocsWorld::create();

    [$room, $players] = docsGamesRoom($world, GameKind::Hangman, ['Camille', 'Théo', 'Inès', 'Malik']);

    activeGameRound($room, [
        'word' => 'retrospective',
        'picked_letters' => ['e', 'a', 't', 's', 'n', 'o'],
        'picked_by' => [$players['Théo']->id, $players['Inès']->id, $players['Malik']->id, $players['Camille']->id, $players['Théo']->id, $players['Inès']->id],
        'revealed_positions' => [1, 2, 4, 5, 7, 9, 12],
        'misses' => 2,
        'number' => 1,
        'turn_order' => array_map(fn (GamePlayer $player): string => $player->id, array_values($players)),
        'turn_player_id' => $players['Camille']->id,
    ]);

    $page = docsGamesReady($this->docsVisit($world->person('Camille'), route('games.show', $room, false))->resize(1440, 1000), '[data-slot="hangman-board"]')
        ->assertPresent('[data-slot="hangman-turn-banner"]');

    $this->docShot($page, 'games/hangman', '[data-slot="game-stage-content"]');
});

it('shows a round of Draw & Guess as a guesser sees it, with the drawing, the players and the guesses', function () {
    $world = DocsWorld::create();

    [$room, $players] = docsGamesRoom($world, GameKind::DrawAndGuess, ['Camille', 'Théo', 'Inès', 'Malik', 'Noa']);

    $round = activeGameRound($room, [
        'word' => 'coffee cup',
        'leader_player_id' => $players['Théo']->id,
        'revealed_positions' => [2],
        'guessers_total' => 4,
        'winner_player_id' => $players['Noa']->id,
        'number' => 1,
        'started_at' => now()->subSeconds(60)->startOfSecond(),
        'drawing' => [
            ['type' => 'stroke', 'color' => 'black', 'size' => 10, 'points' => [[330, 300], [330, 520], [360, 560], [560, 560], [590, 520], [590, 300], [330, 300]]],
            ['type' => 'stroke', 'color' => 'apricot', 'size' => 10, 'points' => [[590, 350], [670, 360], [680, 430], [590, 470]]],
            ['type' => 'stroke', 'color' => 'coral', 'size' => 4, 'points' => [[400, 250], [380, 200], [410, 160], [390, 110]]],
            ['type' => 'stroke', 'color' => 'coral', 'size' => 4, 'points' => [[500, 250], [480, 200], [510, 160], [490, 110]]],
            ['type' => 'stroke', 'color' => 'sky', 'size' => 24, 'points' => [[240, 640], [700, 640]]],
            ['type' => 'fill', 'color' => 'sun', 'x' => 460, 'y' => 430],
        ],
        'drawing_points' => 24,
    ]);

    foreach ([['Malik', 'a bucket', false, false, 12], ['Camille', 'tea time', false, false, 19], ['Noa', 'coffee cup', false, true, 24], ['Inès', 'coffee mug', true, false, 31]] as $index => [$name, $text, $isNearMiss, $isCorrect, $seconds]) {
        GameGuess::factory()->create([
            'id' => docsGamesPictureId('b000', $index + 1),
            'game_round_id' => $round->id,
            'player_id' => $players[$name]->id,
            'text' => $text,
            'is_near_miss' => $isNearMiss,
            'is_correct' => $isCorrect,
            'hints' => $isCorrect ? 1 : null,
            'created_at' => $round->started_at->copy()->addSeconds($seconds),
        ]);
    }

    $path = route('games.show', $room, false);

    foreach (['Camille', 'Théo', 'Malik', 'Noa'] as $name) {
        docsGamesReady($this->docsVisit($world->person($name), $path), '[data-slot="draw-sheet"]');
    }

    $page = docsGamesReady($this->docsVisit($world->person('Inès'), $path), '[data-slot="draw-sheet"] canvas:not(.cursor-crosshair)')
        ->assertPresent('section[aria-labelledby="game-guesses"]')
        ->assertCount('[data-slot="player-row"]:not([data-offline])', 5);

    $this->docShot($page, 'games/draw', '[data-slot="game-layout"]');
});

it('shows a round of Decoded as a guesser sees it, with the emoji clue and the attempts', function () {
    $world = DocsWorld::create();

    [$room, $players] = docsGamesRoom($world, GameKind::Decoded, ['Camille', 'Théo', 'Inès', 'Malik', 'Noa']);

    $round = activeGameRound($room, [
        'word' => 'deadline',
        'leader_player_id' => $players['Théo']->id,
        'revealed_positions' => [0],
        'clue' => ['📅', '⏰', '😱'],
        'number' => 1,
        'started_at' => now()->subSeconds(60)->startOfSecond(),
    ]);

    foreach ([['Inès', 'calendar'], ['Malik', 'late meeting'], ['Inès', 'due date']] as $index => [$name, $text]) {
        GameGuess::factory()->create([
            'id' => docsGamesPictureId('b000', $index + 1),
            'game_round_id' => $round->id,
            'player_id' => $players[$name]->id,
            'text' => $text,
            'created_at' => $round->started_at->copy()->addSeconds(10 * ($index + 1)),
        ]);
    }

    $page = docsGamesReady($this->docsVisit($world->person('Inès'), route('games.show', $room, false))->resize(1440, 1000), '[data-slot="clue-row"]')
        ->assertPresent('[data-slot="decoded-answer"]');

    $this->docShot($page, 'games/decoded', '[data-slot="game-stage-content"]');
});

it('shows the vote of Sprint in one GIF, with the gallery, the captions and the hidden authors', function () {
    $world = DocsWorld::create();

    docsGamesFakeGifs();

    [$room, $players] = docsGamesRoom($world, GameKind::SprintGif, ['Camille', 'Théo', 'Inès', 'Malik', 'Noa']);

    $round = activeGameRound($room, [
        'word' => null,
        'question' => 'How was this sprint, in one GIF?',
        'votes_allowed' => 2,
        'authors_hidden' => true,
        'number' => 1,
        'revealed_at' => now()->startOfSecond(),
    ]);
    $answers = [];

    foreach ([['Camille', 'burndown', 'Me in front of the burndown'], ['Théo', 'checks', 'When the CI finally passes'], ['Inès', 'demo', 'Friday\'s demo'], ['Malik', 'sunrise', 'Monday\'s standup'], ['Noa', 'rocket', 'After the release']] as $index => [$name, $gifId, $caption]) {
        $answers[$name] = GameGifAnswer::factory()->create([
            'id' => docsGamesPictureId('c000', $index + 1),
            'game_round_id' => $round->id,
            'player_id' => $players[$name]->id,
            'gif_id' => $gifId,
            'caption' => $caption,
        ]);
    }

    foreach ([['Camille', 'Théo'], ['Inès', 'Théo'], ['Inès', 'Noa'], ['Malik', 'Inès']] as [$voter, $author]) {
        GameGifVote::factory()->create([
            'game_round_id' => $round->id,
            'voter_player_id' => $players[$voter]->id,
            'answer_id' => $answers[$author]->id,
        ]);
    }

    $path = route('games.show', $room, false);

    foreach (['Théo', 'Inès', 'Malik', 'Noa'] as $name) {
        docsGamesReady($this->docsVisit($world->person($name), $path), '[data-slot="gif-gallery"] [data-slot="gif-tile"]');
    }

    $page = docsGamesReady($this->docsVisit($world->person('Camille'), $path)->resize(1440, 1400), '[data-slot="gif-gallery"] [data-slot="gif-tile"]')
        ->assertSeeIn('[data-slot="game-stage-content"]', '3 of 5 voted')
        ->assertScript('[...document.querySelectorAll(\'[data-slot="gif-tile"] img\')].every((image) => image.complete && image.naturalWidth > 0)', true);

    $this->docShot($page, 'games/gif', '[data-slot="game-stage-content"]');
});

it('shows a round of Two truths and a lie as a voter sees it', function () {
    $world = DocsWorld::create();

    [$room, $players] = docsGamesRoom($world, GameKind::TwoTruths, ['Camille', 'Théo', 'Inès', 'Malik']);

    $statements = ['I ran a marathon in 2019', 'I grew up on an island', 'I have never drunk coffee'];

    $round = activeGameRound($room, [
        'word' => null,
        'leader_player_id' => $players['Théo']->id,
        'statements' => $statements,
        'lie_index' => 2,
        'number' => 1,
    ]);

    GameStatementSet::factory()->played()->create(['game_room_id' => $room->id, 'player_id' => $players['Théo']->id, 'statements' => $statements, 'lie_index' => 2]);

    foreach (['Malik' => '0', 'Inès' => '1'] as $name => $choice) {
        GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $players[$name]->id, 'choice' => $choice]);
    }

    $path = route('games.show', $room, false);

    foreach (['Camille', 'Théo', 'Malik'] as $name) {
        docsGamesReady($this->docsVisit($world->person($name), $path), '[data-slot="two-truths-board"]');
    }

    $page = docsGamesReady($this->docsVisit($world->person('Inès'), $path), '[data-slot="two-truths-board"]')
        ->assertSeeIn('[data-slot="two-truths-board"]', '2 of 3 voted');

    $this->docShot($page, 'games/two-truths', '[data-slot="two-truths-board"]');
});

it('shows a round of Mood weather before the host shows the weather', function () {
    $world = DocsWorld::create();

    [$room, $players] = docsGamesRoom($world, GameKind::MoodWeather, ['Camille', 'Théo', 'Inès', 'Malik', 'Noa']);

    $round = activeGameRound($room, ['word' => null, 'number' => 1]);

    foreach (['Camille' => GameWeather::PartlyCloudy, 'Théo' => GameWeather::Sunny, 'Inès' => GameWeather::Rainy, 'Malik' => GameWeather::Sunny] as $name => $weather) {
        GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $players[$name]->id, 'choice' => $weather->value]);
    }

    $page = docsGamesReady($this->docsVisit($world->person('Camille'), route('games.show', $room, false)), '[data-slot="mood-weather-board"]')
        ->assertSeeIn('[data-slot="mood-weather-board"]', '4 answered');

    $this->docShot($page, 'games/mood', '[data-slot="mood-weather-board"]');
});

it('shows the vote of Guess who? on the drawn answer', function () {
    $world = DocsWorld::create();

    [$room, $players] = docsGamesRoom($world, GameKind::GuessWho, ['Camille', 'Théo', 'Inès', 'Malik', 'Noa']);

    $round = activeGameRound($room, [
        'word' => null,
        'question' => 'What was your very first job?',
        'number' => 1,
        'revealed_at' => now()->startOfSecond(),
    ]);

    foreach (['Camille' => 'Waiting tables in a pizzeria', 'Théo' => 'Picking apples', 'Inès' => 'Lifeguard at the town pool', 'Malik' => 'Delivering newspapers by bike', 'Noa' => 'Selling ice cream on the beach'] as $name => $text) {
        GameTextAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $players[$name]->id, 'text' => $text])
            ->forceFill(['is_drawn' => $name === 'Malik'])
            ->save();
    }

    GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $players['Théo']->id, 'choice' => $players['Noa']->id]);
    GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $players['Inès']->id, 'choice' => $players['Malik']->id]);

    $page = docsGamesReady($this->docsVisit($world->person('Camille'), route('games.show', $room, false)), '[data-slot="guess-who-vote"]')
        ->assertPresent('[data-slot="guess-who-board"] [data-slot="question-banner"]');

    $this->docShot($page, 'games/guess-who', '[data-slot="guess-who-board"]');
});

it('shows the turn of a speaker in Quick question, as the host sees it', function () {
    $world = DocsWorld::create();

    [$room, $players] = docsGamesRoom($world, GameKind::QuickQuestion, ['Camille', 'Théo', 'Inès', 'Malik', 'Noa']);

    activeGameRound($room, [
        'word' => null,
        'question' => 'Which skill would you like to learn this year?',
        'number' => 1,
        'turn_order' => array_map(fn (GamePlayer $player): string => $player->id, array_values($players)),
        'turn_player_id' => $players['Inès']->id,
    ]);

    $page = docsGamesReady($this->docsVisit($world->person('Camille'), route('games.show', $room, false)), '[data-slot="quick-question-speaker"]');

    $this->docShot($page, 'games/quick-question', '[data-slot="quick-question-board"]');
});
