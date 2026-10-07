<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\GameRoundOutcome;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Models\Column;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\IntegrationDelivery;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     retro: Retro,
 *     room: GameRoom,
 *     ada: User,
 *     adaPlayer: GamePlayer,
 *     bob: User,
 *     bobPlayer: GamePlayer
 * }
 */
function icebreakerScoresInvitesIcebreaker(RetroPhase $phase = RetroPhase::Icebreaker, GameKind $game = GameKind::Hangman, array $attributes = []): array
{
    $retro = Retro::factory()
        ->withIcebreaker()
        ->withGuestAccess()
        ->inPhase($phase)
        ->create(['title' => 'Sprint 13 retro', 'icebreaker_game' => $game, ...$attributes]);

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$ada, $adaParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);
    $retro = $retro->fresh();
    $room = GameRoom::factory()->icebreaker($retro)->game($game)->create();

    return [
        'retro' => $retro,
        'room' => $room,
        'ada' => renamedUser($ada, 'Ada'),
        'adaPlayer' => GamePlayer::factory()->forParticipant($adaParticipant)->create(['game_room_id' => $room->id]),
        'bob' => renamedUser($bob, 'Bob'),
        'bobPlayer' => GamePlayer::factory()->forParticipant($bobParticipant)->create(['game_room_id' => $room->id]),
    ];
}

function icebreakerScoresInvitesIcebreakerPlayer(Retro $retro, GameRoom $room, string $name): GamePlayer
{
    [$user, $participant] = retroMember($retro);
    renamedUser($user, $name);

    return GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     room: GameRoom,
 *     ada: User,
 *     adaPlayer: GamePlayer
 * }
 */
function icebreakerScoresInvitesRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->create([
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    [$ada, $adaPlayer] = gameRoomHost($room);

    return [
        'room' => $room->fresh(),
        'ada' => renamedUser($ada, 'Ada'),
        'adaPlayer' => $adaPlayer,
    ];
}

function icebreakerScoresInvitesTeamGamesPath(GameRoom $room): string
{
    return route('teams.games.index', [$room->team->workspace, $room->team], false);
}

function icebreakerScoresInvitesOpenInvite(mixed $page): mixed
{
    return $page->assertVisible('[aria-label="Invite"]')
        ->click('[aria-label="Invite"]')
        ->assertSeeIn('[data-slot="share-dialog"]', 'Invite to Friday fun')
        ->assertSee('Post a link');
}

it('reveals the "é" of an accented Hangman word to both players when one of them picks "e"', function () {
    ['room' => $room, 'ada' => $ada] = icebreakerScoresInvitesRoom(['access' => GameRoomAccess::Link]);
    $round = activeGameRound($room, ['word' => 'fiancée']);
    $letter = fn (string $letter): string => "[role=\"group\"][aria-label=\"Letters\"] button:has-text(\"{$letter}\")";
    $mask = 'Array.from(document.querySelectorAll(\'[role="img"][data-slot="word-mask"] span\')).map((cell) => cell.textContent || "_").join("")';

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $c = $this->awaitRealtime($this->joinAsGuest(route('games.join.show', $room->guest_token, false), 'Casey'));

    foreach ([$a, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="img"][aria-label="7 letters left to find"]')
            ->assertScript($mask, '_______')
            ->assertCount('[role="group"][aria-label="Letters"] button', 26)
            ->assertNotPresent($letter('é'));
    }

    $c->assertEnabled($letter('e'))
        ->click($letter('e'));

    foreach ([$a, $c] as $page) {
        $page->assertScript($mask, '_____ée')
            ->assertPresent('[role="img"][aria-label="5 letters left to find"]')
            ->assertSeeIn('ul[aria-label="Last moves"]', 'Casey picked E')
            ->assertSee('0 of 6 misses')
            ->assertDisabled($letter('e'))
            ->assertCount('[role="group"][aria-label="Letters"] button', 26)
            ->assertNotPresent($letter('é'));
    }

    expect($round->fresh()->picked_letters)->toBe(['e'])
        ->and($round->fresh()->revealed_positions)->toBe([5, 6])
        ->and($round->fresh()->misses)->toBe(0);
});

it('creates a retro with the Icebreaker phase and Hangman, which opens on the game panel instead of the columns', function () {
    $team = Team::factory()->create();
    $ada = renamedUser(teamMember($team), 'Ada');

    $page = $this->signIn($ada, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New session')
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 13 retro')
        ->assertSee('Start, Stop, Continue')
        ->click('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"]:has-text("Start, Stop, Continue")')
        ->assertSeeIn('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"][aria-checked="true"]', 'Start, Stop, Continue')
        ->assertVisible('#new-retro-icebreaker')
        ->click('#new-retro-icebreaker')
        ->assertAriaAttribute('#new-retro-icebreaker', 'checked', 'true')
        ->assertVisible('#new-retro-icebreaker-game')
        ->click('#new-retro-icebreaker-game')
        ->assertVisible('[role="option"]:has-text("Hangman")')
        ->click('[role="option"]:has-text("Hangman")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#new-retro-icebreaker-game', 'Hangman')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('[aria-current="step"]', 'Icebreaker')
        ->assertPresent('section[aria-label="Icebreaker game"]')
        ->assertAriaAttribute(icebreakerCard('Hangman'), 'checked', 'true')
        ->assertCount('[data-test^="retro-column-"]', 0)
        ->assertSee('Ready to play?')
        ->click('Start')
        ->assertPresent('[role="group"][aria-label="Letters"]')
        ->assertPresent('[role="img"][data-slot="word-mask"]');

    $retro = Retro::query()->where('title', 'Sprint 13 retro')->sole();
    $room = GameRoom::query()->where('retro_id', $retro->id)->sole();

    expect($retro->icebreaker_enabled)->toBeTrue()
        ->and($retro->icebreaker_game)->toBe(GameKind::Hangman)
        ->and($retro->phase)->toBe(RetroPhase::Icebreaker)
        ->and($retro->columns()->count())->toBe(3)
        ->and($room->game)->toBe(GameKind::Hangman)
        ->and(GameRound::query()->where('game_room_id', $room->id)->whereNull('ended_at')->count())->toBe(1);
});

it('plays the game live on the board and keeps cursors and flying reactions working', function () {
    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = icebreakerScoresInvitesIcebreaker();
    activeGameRound($room, ['word' => 'sprint']);

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('section[aria-label="Icebreaker game"]')
            ->assertPresent('[role="img"][aria-label="6 letters left to find"]')
            ->assertCount('[data-test^="retro-column-"]', 0)
            ->assertPresent('.lc-overlay')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]');
    }

    $a->assertAriaAttribute(icebreakerCard('Hangman'), 'checked', 'true')
        ->assertAttributeMissing(icebreakerCard('Hangman'), 'aria-disabled');
    $b->assertAriaAttribute(icebreakerCard('Hangman'), 'disabled', 'true')
        ->assertSeeIn('section[aria-label="Icebreaker game"] #game-stage-title', 'Hangman');

    $b->click('[role="group"][aria-label="Letters"] button:has-text("s")');

    $a->assertPresent('[role="img"][aria-label="5 letters left to find"]')
        ->assertSeeIn('ul[aria-label="Last moves"]', 'Bob picked S');

    $b->hover('[role="group"][aria-label="Letters"]')->hover('main.relative');
    $a->assertSeeIn('.lc-overlay', 'Bob');

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada');
});

it('abandons the round when the facilitator switches the game mid-round', function () {
    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = icebreakerScoresInvitesIcebreaker();
    $round = activeGameRound($room, ['word' => 'sprint']);

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="group"][aria-label="Letters"]');
    }

    $a->click(icebreakerCard('Decoded'))
        ->assertAriaAttribute(icebreakerCard('Decoded'), 'checked', 'true');

    foreach ([$a, $b] as $page) {
        $page->assertNotPresent('[role="group"][aria-label="Letters"]')
            ->assertSeeIn('section[aria-label="Icebreaker game"] [data-slot="round-end-card"]', 'Abandoned')
            ->assertSeeIn('section[aria-label="Icebreaker game"] [data-slot="round-end-card"]', 'sprint');
    }

    $b->assertSeeIn('section[aria-label="Icebreaker game"] #game-stage-title', 'Decoded')
        ->assertSee('Waiting for the host to start.');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Abandoned)
        ->and($room->fresh()->game)->toBe(GameKind::Decoded)
        ->and(GamePoint::query()->count())->toBe(0);
});

it('ends the round when the board timer set during it reaches zero', function () {
    config(['queue.default' => 'database']);

    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = icebreakerScoresInvitesIcebreaker();
    $round = activeGameRound($room, ['word' => 'sprint']);

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="group"][aria-label="Letters"]')
            ->assertNotPresent('[role="timer"]');
    }

    $a->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($round->fresh()->ended_at)->toBeNull();

    $this->travel(61)->seconds();
    $this->workQueue();

    foreach ([$a, $b] as $page) {
        $page->assertNotPresent('[role="group"][aria-label="Letters"]')
            ->assertSeeIn('section[aria-label="Icebreaker game"] [data-slot="badge"]', "Time's up")
            ->assertSeeIn('section[aria-label="Icebreaker game"] [data-slot="round-end-card"]', 'sprint');
    }

    $a->assertSee('Next round');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut)
        ->and(DB::table('jobs')->count())->toBe(0);
});

it('abandons the round and brings the columns back when the facilitator moves to Writing', function () {
    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = icebreakerScoresInvitesIcebreaker();
    $round = activeGameRound($room, ['word' => 'sprint']);

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSeeIn('[aria-current="step"]', 'Icebreaker')
            ->assertPresent('[role="group"][aria-label="Letters"]');
    }

    $a->click('Next');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Writing')
            ->assertNotPresent('section[aria-label="Icebreaker game"]')
            ->assertCount('[data-test^="retro-column-"]', 3)
            ->assertSeeIn('main:has([data-test^="retro-column-"])', 'Continue');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Abandoned)
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Writing)
        ->and(GamePoint::query()->count())->toBe(0);
});

it('shows "Games we played" after the actions, the ROTI and the top topics, with the podium, "Show all" and a drawing replay, to a member and to a guest', function () {
    ['retro' => $retro, 'room' => $room, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = icebreakerScoresInvitesIcebreaker(
        RetroPhase::Completed,
        GameKind::Hangman,
        ['completed_at' => now()],
    );
    $cleoPlayer = icebreakerScoresInvitesIcebreakerPlayer($retro, $room, 'Cleo');
    $danPlayer = icebreakerScoresInvitesIcebreakerPlayer($retro, $room, 'Dan');
    $hangman = GameRound::factory()->ended(GameRoundOutcome::Solved)->create([
        'game_room_id' => $room->id,
        'word' => 'sprint',
        'winner_player_id' => $bobPlayer->id,
        'ended_at' => now()->subMinutes(20),
    ]);
    $draw = GameRound::factory()->game(GameKind::DrawAndGuess)->ended(GameRoundOutcome::Guessed)->create([
        'game_room_id' => $room->id,
        'word' => 'rocket',
        'leader_player_id' => $adaPlayer->id,
        'winner_player_id' => $bobPlayer->id,
        'drawing' => [['type' => 'stroke', 'color' => 'black', 'size' => 4, 'points' => [[100, 100], [400, 300]]]],
        'ended_at' => now()->subMinutes(10),
    ]);
    $room->forceFill(['current_round_id' => $draw->id])->save();
    awardGamePoints($room, $bobPlayer, 6, true, ['game_round_id' => $hangman->id]);
    awardGamePoints($room, $cleoPlayer, 3, false, ['game_round_id' => $hangman->id]);
    awardGamePoints($room, $danPlayer, 1, false, ['game_round_id' => $hangman->id]);
    awardGamePoints($room, $bobPlayer, 10, true, ['game_round_id' => $draw->id, 'game' => GameKind::DrawAndGuess]);
    awardGamePoints($room, $adaPlayer, 5, false, ['game_round_id' => $draw->id, 'game' => GameKind::DrawAndGuess]);
    $games = 'section:has(> h2:has-text("Games we played"))';
    $inOrder = '(() => { const titles = [...document.querySelectorAll("section > h2")].map((title) => title.textContent); return titles.indexOf("Actions created") >= 0 && titles.indexOf("Actions created") < titles.indexOf("Return on time invested") && titles.indexOf("Return on time invested") < titles.indexOf("Top topics") && titles.indexOf("Top topics") < titles.indexOf("Games we played"); })()';

    $b = $this->signIn($bob, "/retros/{$retro->id}");
    $carol = $this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest');

    foreach ([$b, $carol] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertSeeIn($games, '2 rounds played')
            ->assertScript($inOrder, true)
            ->assertCount("{$games} ol.grid > li", 3)
            ->assertSeeIn("{$games} ol.grid", 'Bob')
            ->assertSeeIn("{$games} ol.grid", '16 points')
            ->assertSeeIn("{$games} ol.grid", 'Ada')
            ->assertSeeIn("{$games} ol.grid", 'Cleo')
            ->assertDontSeeIn("{$games} ol.grid", 'Dan')
            ->click("{$games} button:has-text(\"Show all\")")
            ->assertCount("{$games} ol.grid > li", 4)
            ->assertSeeIn("{$games} ol.grid", 'Dan')
            ->assertSeeIn($games, 'Show less')
            ->assertCount("{$games} ol.space-y-2 > li", 2)
            ->assertSeeIn("{$games} ol.space-y-2 > li:has-text(\"sprint\")", 'Solved')
            ->assertSeeIn("{$games} ol.space-y-2 > li:has-text(\"rocket\")", 'Guessed')
            ->assertCount("{$games} button:has-text(\"Replay\")", 1)
            ->click("{$games} button:has-text(\"Replay\")")
            ->assertPresent('[role="dialog"] canvas[aria-label="Drawing of rocket"]')
            ->assertSeeIn('[role="dialog"]', 'rocket');
    }
});

it('labels GIF tiles "Anonymous GIF" in "Games we played" of an anonymous retro', function () {
    ['retro' => $retro, 'room' => $room, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = icebreakerScoresInvitesIcebreaker(
        RetroPhase::Completed,
        GameKind::SprintGif,
        ['completed_at' => now(), 'is_anonymous' => true, 'gifs_enabled' => true],
    );
    $round = GameRound::factory()->game(GameKind::SprintGif)->ended(GameRoundOutcome::Revealed)->create([
        'game_room_id' => $room->id,
        'word' => null,
        'question' => 'How did the sprint feel?',
        'revealed_at' => now()->subMinutes(15),
        'ended_at' => now()->subMinutes(10),
    ]);
    $room->forceFill(['current_round_id' => $round->id])->save();
    $adaAnswer = GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $adaPlayer->id, 'gif_id' => 'partyone']);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $bobPlayer->id, 'gif_id' => 'coffeeone']);
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $bobPlayer->id, 'answer_id' => $adaAnswer->id]);
    awardGamePoints($room, $adaPlayer, 0, false, ['game_round_id' => $round->id]);
    awardGamePoints($room, $bobPlayer, 0, false, ['game_round_id' => $round->id]);
    $games = 'section:has(> h2:has-text("Games we played"))';

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertSeeIn($games, '1 round played')
        ->assertSeeIn("{$games} ol.space-y-2 > li", 'How did the sprint feel?')
        ->assertSeeIn("{$games} ol.space-y-2 > li", 'Revealed')
        ->assertCount("{$games} figure", 2)
        ->assertCount("{$games} figcaption:has-text(\"Anonymous GIF\")", 2)
        ->assertSeeIn("{$games} figure:has(img[src=\"/gifs/partyone/preview\"])", '1 vote')
        ->assertSeeIn("{$games} figure:has(img[src=\"/gifs/coffeeone/preview\"])", '0 votes')
        ->assertDontSeeIn("{$games} ol.space-y-2", 'by Ada')
        ->assertDontSeeIn("{$games} ol.space-y-2", 'by Bob')
        ->assertNotPresent("{$games} button:has-text(\"Replay\")");
});

it('lets a visitor open the guest link of a link room, type a name and play', function () {
    ['room' => $room, 'ada' => $ada] = icebreakerScoresInvitesRoom(['access' => GameRoomAccess::Link]);
    activeGameRound($room, ['word' => 'sprint']);
    $letter = fn (string $letter): string => "[role=\"group\"][aria-label=\"Letters\"] button:has-text(\"{$letter}\")";

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    $c = browserVisit(route('games.join.show', $room->guest_token, false));
    $c->assertSee('Friday fun')
        ->assertSeeIn('[data-slot="guest-join-session"]', 'Hangman')
        ->fill('#name', 'Casey')
        ->click('Join the session')
        ->assertPathIs("/games/{$room->id}");
    $this->awaitRealtime($c);

    foreach ([$a, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="img"][aria-label="6 letters left to find"]')
            ->assertSeeIn('section[aria-labelledby="game-players"]', 'Casey')
            ->assertSeeIn('section[aria-labelledby="game-players"]', '(guest)');
    }

    $c->assertPresent('[aria-label="Language"]')
        ->assertNotPresent('[aria-label="Room menu"]')
        ->assertNotPresent('[role="radiogroup"][aria-label="Choose an icebreaker"]')
        ->assertNotPresent('[aria-label="Back to the team"]')
        ->click($letter('s'));

    $a->assertPresent('[role="img"][aria-label="5 letters left to find"]')
        ->assertSeeIn('ul[aria-label="Last moves"]', 'Casey picked S')
        ->click($letter('p'));

    $c->assertPresent('[role="img"][aria-label="4 letters left to find"]')
        ->assertSeeIn('ul[aria-label="Last moves"]', 'Ada picked P');

    $guest = GamePlayer::query()->where('game_room_id', $room->id)->where('guest_name', 'Casey')->sole();

    expect($guest->user_id)->toBeNull();
});

it('shows "+n" per scorer on the end card and the scores in both browsers, with the guest scoring in the room only', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = icebreakerScoresInvitesRoom(['access' => GameRoomAccess::Link]);
    $round = activeGameRound($room, [
        'word' => 'sprint',
        'picked_letters' => ['s', 'p', 'r', 'i', 'n'],
        'picked_by' => array_fill(0, 5, $adaPlayer->id),
        'revealed_positions' => [0, 1, 2, 3, 4],
    ]);
    $board = '[data-slot="leaderboard"]';

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $c = $this->awaitRealtime($this->joinAsGuest(route('games.join.show', $room->guest_token, false), 'Casey'));

    foreach ([$a, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="img"][aria-label="1 letter left to find"]');
    }

    $c->click('[role="group"][aria-label="Letters"] button:has-text("t")');

    foreach ([$a, $c] as $page) {
        $page->assertSee('Solved')
            ->assertSee('Casey found it!')
            ->assertSeeIn('ul[aria-label="Points of this round"]', '+6 Casey')
            ->assertSeeIn('ul[aria-label="Points of this round"]', '+5 Ada')
            ->assertNotPresent('[role="tab"]')
            ->assertPresent('[data-slot="room-scores"] li:has-text("Casey") [aria-label="6 points"]')
            ->assertSeeIn('[data-slot="room-scores"] li:has-text("Casey")', '(guest)')
            ->assertPresent('[data-slot="room-scores"] li:has-text("Ada") [aria-label="5 points"]');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Solved)
        ->and(GamePoint::query()->where('game_room_id', $room->id)->whereNull('user_id')->sole()->points)->toBe(6)
        ->and(GamePoint::query()->where('player_id', $adaPlayer->id)->sole()->points)->toBe(5);

    $a->navigate(icebreakerScoresInvitesTeamGamesPath($room))
        ->assertSeeIn("{$board} [data-slot=\"podium-place\"]:has-text(\"Ada\") [data-slot=\"podium-points\"]", '5')
        ->assertCount("{$board} [data-slot=\"podium-place\"]", 1)
        ->assertDontSeeIn($board, 'Casey');

    $c->navigate(icebreakerScoresInvitesTeamGamesPath($room))
        ->assertPathIs('/login');
});

it('empties the room leaderboard on "Reset scores" while the team leaderboard keeps the points', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = icebreakerScoresInvitesRoom();
    [$bob, $bobPlayer] = namedGamePlayer($room, 'Bob');
    awardGamePoints($room, $adaPlayer, 7, true, ['created_at' => now()->subHour()]);
    awardGamePoints($room, $bobPlayer, 4, false, ['created_at' => now()->subHour()]);
    $board = '[data-slot="leaderboard"]';

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertNotPresent('[role="tab"]')
            ->assertPresent('[data-slot="room-scores"] li:has-text("Ada") [aria-label="7 points"]')
            ->assertPresent('[data-slot="room-scores"] li:has-text("Bob") [aria-label="4 points"]');
    }

    $b->assertDontSee('Reset scores');

    $a->click('Reset scores')
        ->assertSee('Scores in this room start again from zero. The team leaderboard keeps them.')
        ->click('[role="alertdialog"] button:has-text("Reset scores")')
        ->assertNotPresent('[role="dialog"]');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[data-slot="room-scores"]', 'No points yet.')
            ->assertCount('[data-slot="room-scores"] li [aria-label="0 points"]', 2)
            ->assertNotPresent('[data-slot="room-scores"] [data-slot="player-rank"]:has-text("2")');
    }

    expect($room->fresh()->scores_reset_at)->not->toBeNull()
        ->and(GamePoint::query()->where('game_room_id', $room->id)->count())->toBe(2);

    $a->navigate(icebreakerScoresInvitesTeamGamesPath($room))
        ->assertSeeIn("{$board} [data-slot=\"podium-place\"]:has-text(\"Ada\") [data-slot=\"podium-points\"]", '7')
        ->assertSeeIn("{$board} [data-slot=\"podium-place\"]:has-text(\"Bob\") [data-slot=\"podium-points\"]", '4')
        ->assertCount("{$board} [data-slot=\"podium-place\"]", 2);
});

it('shows a "2-week streak" badge to a member who scored in two consecutive weeks', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = icebreakerScoresInvitesRoom();
    [, $bobPlayer] = namedGamePlayer($room, 'Bob');
    awardGamePoints($room, $adaPlayer, 5, true, ['created_at' => now()->subWeek()]);
    awardGamePoints($room, $adaPlayer, 3, false, ['created_at' => now()]);
    awardGamePoints($room, $bobPlayer, 2, false, ['created_at' => now()]);
    $board = '[data-slot="leaderboard"]';

    $page = $this->signIn($ada, icebreakerScoresInvitesTeamGamesPath($room));

    $page->assertSee('Leaderboard')
        ->assertSeeIn("{$board} [data-slot=\"podium-place\"]:has-text(\"Ada\")", '2-week streak')
        ->assertSeeIn("{$board} [data-slot=\"podium-place\"]:has-text(\"Ada\") [data-slot=\"podium-points\"]", '8')
        ->assertSeeIn("{$board} [data-slot=\"podium-place\"]:has-text(\"Bob\") [data-slot=\"podium-points\"]", '2')
        ->assertDontSeeIn("{$board} [data-slot=\"podium-place\"]:has-text(\"Bob\")", 'streak');
});

it('switches the team leaderboard between "Last 30 days" and "All time"', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = icebreakerScoresInvitesRoom();
    [, $bobPlayer] = namedGamePlayer($room, 'Bob');
    awardGamePoints($room, $adaPlayer, 4, false, ['created_at' => now()]);
    awardGamePoints($room, $bobPlayer, 9, true, ['created_at' => now()->subDays(40)]);
    $board = '[data-slot="leaderboard"]';
    $names = "[...document.querySelectorAll('[data-slot=\"leaderboard\"] [data-slot=\"podium-place\"]')].map((place) => place.querySelector('span.truncate').firstChild.textContent).join(',')";

    $page = $this->signIn($ada, icebreakerScoresInvitesTeamGamesPath($room));

    $page->assertSeeIn('[aria-label="Period"] [data-state="active"]', 'Last 30 days')
        ->assertSeeIn("{$board} [data-slot=\"podium-place\"]:has-text(\"Ada\") [data-slot=\"podium-points\"]", '4')
        ->assertScript($names, 'Ada')
        ->assertDontSeeIn($board, 'Bob')
        ->click('All time')
        ->assertSeeIn('[aria-label="Period"] [data-state="active"]', 'All time')
        ->assertScript($names, 'Bob,Ada')
        ->assertSeeIn("{$board} [data-slot=\"podium-place\"]:has-text(\"Bob\") [data-slot=\"podium-points\"]", '9')
        ->click('Last 30 days')
        ->assertSeeIn('[aria-label="Period"] [data-state="active"]', 'Last 30 days')
        ->assertScript($names, 'Ada');
});

it('posts the room invite to Slack and to Telegram with a link that opens the room', function () {
    config(['queue.default' => 'database']);
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    Http::fake([
        'hooks.slack.com/*' => Http::response('ok'),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
    ]);
    ['room' => $room, 'ada' => $ada] = icebreakerScoresInvitesRoom();
    [$bob] = namedGamePlayer($room, 'Bob');
    TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    icebreakerScoresInvitesOpenInvite($a)
        ->click('Post link to Slack')
        ->assertSee('The message is on its way.')
        ->assertSee('Sending to Slack…');

    $this->workQueue();

    $a->assertSee('Sent to Slack')
        ->click('Post link to Telegram')
        ->assertSee('Sending to Telegram…');

    $this->workQueue();

    $a->assertSee('Sent to Telegram')
        ->assertSee('Sent to Slack');

    Http::assertSent(fn (HttpRequest $request): bool => str_starts_with($request->url(), 'https://hooks.slack.com/')
        && str_contains((string) $request['text'], 'Ada invites you to play Hangman in "Friday fun" (Platform)')
        && str_ends_with((string) data_get($request->data(), 'blocks.1.elements.0.url'), "/games/{$room->id}"));

    Http::assertSent(fn (HttpRequest $request): bool => str_contains($request->url(), 'api.telegram.org')
        && str_contains($request->url(), '/sendMessage')
        && str_contains((string) $request['text'], "/games/{$room->id}")
        && ! str_contains((string) $request['text'], '/play/'));

    expect(IntegrationDelivery::query()->where('status', IntegrationDeliveryStatus::Sent)->count())->toBe(2);

    $b = $this->signIn($bob, "/games/{$room->id}");

    $b->assertPathIs("/games/{$room->id}")
        ->assertSeeIn('header:has(h1) h1', 'Friday fun');
});

it('posts the guest join link of a link room when "Include the guest link" is ticked', function () {
    config(['queue.default' => 'database']);
    enableIntegrations(IntegrationProvider::Slack);
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    ['room' => $room, 'ada' => $ada] = icebreakerScoresInvitesRoom(['access' => GameRoomAccess::Link]);
    TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    icebreakerScoresInvitesOpenInvite($a)
        ->assertSee('Posted guest links stop working if you regenerate the link.')
        ->assertAriaAttribute('[role="dialog"] button[role="checkbox"]', 'checked', 'false')
        ->click('[role="dialog"] button[role="checkbox"]')
        ->assertAriaAttribute('[role="dialog"] button[role="checkbox"]', 'checked', 'true')
        ->click('Post link to Slack')
        ->assertSee('Sending to Slack…');

    $this->workQueue();

    $a->assertSee('Sent to Slack');

    Http::assertSent(fn (HttpRequest $request): bool => str_starts_with($request->url(), 'https://hooks.slack.com/')
        && str_ends_with((string) data_get($request->data(), 'blocks.1.elements.0.url'), "/play/{$room->guest_token}"));

    $visitor = browserVisit("/play/{$room->guest_token}");

    $visitor->assertPathIs("/play/{$room->guest_token}")
        ->assertSee('Friday fun')
        ->assertSeeIn('[data-slot="guest-join-session"]', 'Hangman')
        ->assertVisible('#name');
});

it('offers no guest link on a team room, says who can join, and shows "Invite" to room managers only', function () {
    enableIntegrations(IntegrationProvider::Slack);
    ['room' => $room, 'ada' => $ada] = icebreakerScoresInvitesRoom();
    [$bob] = namedGamePlayer($room, 'Bob');
    TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $b->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertDontSee('Invite')
        ->assertNotPresent('[aria-label="Invite"]');

    icebreakerScoresInvitesOpenInvite($a)
        ->assertSee('Only members of Platform can join.')
        ->assertSee('Post link to Slack')
        ->assertNotPresent('[role="dialog"] button[role="checkbox"]')
        ->assertDontSee('Include the guest link');
});

it('turns the delivery line to "Slack: failed — Reconnect Slack in the team settings." when the Slack channel is gone', function () {
    config(['queue.default' => 'database']);
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    Http::fake([
        'hooks.slack.com/*' => Http::response('channel_is_archived', 404),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
    ]);
    ['room' => $room, 'ada' => $ada] = icebreakerScoresInvitesRoom();
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    icebreakerScoresInvitesOpenInvite($a)
        ->click('Post link to Slack')
        ->assertSee('Sending to Slack…');

    $this->workQueue();

    $a->assertSee('Slack: failed — Reconnect Slack in the team settings.')
        ->assertDontSee('Post link to Slack')
        ->assertSee('Post link to Telegram');

    expect($slack->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Failed);
});

it('keeps "Invite" and the failed delivery line, without a guest-link checkbox, when Slack was the only share channel', function (GameRoomAccess $access, int $checkboxes) {
    config(['queue.default' => 'database']);
    enableIntegrations(IntegrationProvider::Slack);
    Http::fake(['hooks.slack.com/*' => Http::response('channel_is_archived', 404)]);
    ['room' => $room, 'ada' => $ada] = icebreakerScoresInvitesRoom(['access' => $access]);
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    icebreakerScoresInvitesOpenInvite($a)
        ->assertCount('[role="dialog"] button[role="checkbox"]', $checkboxes)
        ->click('Post link to Slack')
        ->assertSee('Sending to Slack…');

    $this->workQueue();

    $a->assertSee('Slack: failed — Reconnect Slack in the team settings.')
        ->assertSee('Invite to Friday fun')
        ->assertNotPresent('[role="dialog"] button:has-text("Post link to Slack")')
        ->assertNotPresent('[role="dialog"] button[role="checkbox"]');

    expect($slack->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);

    $a->navigate("/games/{$room->id}");

    icebreakerScoresInvitesOpenInvite($a)
        ->assertSee('Slack: failed — Reconnect Slack in the team settings.')
        ->assertNotPresent('[role="dialog"] button:has-text("Post link to Slack")')
        ->assertNotPresent('[role="dialog"] button[role="checkbox"]');
})->with([
    'a team room' => [GameRoomAccess::Team, 0],
    'a room open by link' => [GameRoomAccess::Link, 1],
]);

it('offers Microsoft Teams, Mattermost and the webhook when the team connected them, and posts to each', function () {
    config(['queue.default' => 'database']);
    enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost, IntegrationProvider::Webhook);
    outgoingWebhookResolves();
    Http::fake([
        'prod-12.westeurope.logic.azure.com*' => Http::response('', 202),
        'chat.example.com/*' => Http::response('ok'),
        'hooks.example.com/*' => Http::response('', 202),
    ]);
    ['room' => $room, 'ada' => $ada] = icebreakerScoresInvitesRoom();
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $room->team_id]);
    TeamIntegration::factory()->mattermost()->create(['team_id' => $room->team_id]);
    TeamIntegration::factory()->webhook()->create(['team_id' => $room->team_id]);

    $a = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));

    icebreakerScoresInvitesOpenInvite($a)
        ->assertDontSee('Post link to Slack')
        ->assertDontSee('Post link to Telegram')
        ->click('Post link to Microsoft Teams')
        ->assertSee('Sending to Microsoft Teams…');

    $this->workQueue();

    $a->assertSee('Sent to Microsoft Teams')
        ->click('Post link to Mattermost')
        ->assertSee('Sending to Mattermost…');

    $this->workQueue();

    $a->assertSee('Sent to Mattermost')
        ->click('Send link to webhook')
        ->assertSee('Sending to Webhook…');

    $this->workQueue();

    $a->assertSee('Sent to Webhook');

    Http::assertSent(fn (HttpRequest $request): bool => str_contains($request->url(), 'prod-12.westeurope.logic.azure.com')
        && str_contains($request->body(), $room->id));

    Http::assertSent(fn (HttpRequest $request): bool => str_starts_with($request->url(), 'https://chat.example.com/hooks/')
        && str_contains((string) $request['text'], "/games/{$room->id}"));

    Http::assertSent(fn (HttpRequest $request): bool => str_starts_with($request->url(), 'https://hooks.example.com/')
        && $request->hasHeader('X-Skrum-Event', 'game_room.link')
        && str_contains($request->body(), $room->id));

    expect(IntegrationDelivery::query()->where('status', IntegrationDeliveryStatus::Sent)->count())->toBe(3);
});
