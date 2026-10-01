<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Models\Column;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;

function p13dNamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

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
function p13dIcebreaker(RetroPhase $phase = RetroPhase::Icebreaker, GameKind $game = GameKind::Hangman, array $attributes = []): array
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
        'ada' => p13dNamed($ada, 'Ada'),
        'adaPlayer' => GamePlayer::factory()->forParticipant($adaParticipant)->create(['game_room_id' => $room->id]),
        'bob' => p13dNamed($bob, 'Bob'),
        'bobPlayer' => GamePlayer::factory()->forParticipant($bobParticipant)->create(['game_room_id' => $room->id]),
    ];
}

function p13dIcebreakerPlayer(Retro $retro, GameRoom $room, string $name): GamePlayer
{
    [$user, $participant] = retroMember($retro);
    p13dNamed($user, $name);

    return GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
}

it('[P13d-06a] creates a retro with the Icebreaker phase and Hangman, which opens on the game panel instead of the columns', function () {
    $team = Team::factory()->create();
    $ada = p13dNamed(teamMember($team), 'Ada');

    $page = $this->signIn($ada, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 13 retro')
        ->assertSee('Start, Stop, Continue')
        ->click('[role="dialog"] li button:has-text("Start, Stop, Continue")')
        ->assertSeeIn('[role="dialog"] li button[aria-pressed="true"]', 'Start, Stop, Continue')
        ->click('[role="dialog"] button:has-text("Settings")')
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
        ->assertSeeIn('[aria-label="Game"]', 'Hangman')
        ->assertCount('[data-test^="retro-column-"]', 0)
        ->assertSee('Ready to play?')
        ->click('Start')
        ->assertPresent('[role="group"][aria-label="Letters"]')
        ->assertPresent('[role="img"][aria-label$="letters left to find"]');

    $retro = Retro::query()->where('title', 'Sprint 13 retro')->sole();
    $room = GameRoom::query()->where('retro_id', $retro->id)->sole();

    expect($retro->icebreaker_enabled)->toBeTrue()
        ->and($retro->icebreaker_game)->toBe(GameKind::Hangman)
        ->and($retro->phase)->toBe(RetroPhase::Icebreaker)
        ->and($retro->columns()->count())->toBe(3)
        ->and($room->game)->toBe(GameKind::Hangman)
        ->and(GameRound::query()->where('game_room_id', $room->id)->whereNull('ended_at')->count())->toBe(1);
});

it('[P13d-06b] plays the game live on the board and keeps cursors and flying reactions working', function () {
    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = p13dIcebreaker();
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

    $a->assertSeeIn('[aria-label="Game"]', 'Hangman');
    $b->assertNotPresent('[aria-label="Game"]')
        ->assertSeeIn('section[aria-label="Icebreaker game"]', 'Hangman');

    $b->click('[role="group"][aria-label="Letters"] button:has-text("s")');

    $a->assertPresent('[role="img"][aria-label="5 letters left to find"]')
        ->assertSeeIn('ul[aria-label="Last letters"]', 'Bob picked S');

    $b->hover('[role="group"][aria-label="Letters"]')->hover('main.relative');
    $a->assertSeeIn('.lc-overlay', 'Bob');

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada');
});

it('[P13d-06c] abandons the round when the facilitator switches the game mid-round', function () {
    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = p13dIcebreaker();
    $round = activeGameRound($room, ['word' => 'sprint']);

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="group"][aria-label="Letters"]');
    }

    $a->click('[aria-label="Game"]')
        ->assertVisible('[role="option"]:has-text("Decoded")')
        ->click('[role="option"]:has-text("Decoded")')
        ->assertSeeIn('[aria-label="Game"]', 'Decoded');

    foreach ([$a, $b] as $page) {
        $page->assertNotPresent('[role="group"][aria-label="Letters"]')
            ->assertSeeIn('section[aria-label="Icebreaker game"]', 'Abandoned')
            ->assertSeeIn('section[aria-label="Icebreaker game"]', 'sprint');
    }

    $b->assertSeeIn('section[aria-label="Icebreaker game"]', 'Decoded')
        ->assertSee('Waiting for the host to start.');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Abandoned)
        ->and($room->fresh()->game)->toBe(GameKind::Decoded)
        ->and(GamePoint::query()->count())->toBe(0);
});

it('[P13d-06d] ends the round when the board timer set during it reaches zero', function () {
    config(['queue.default' => 'database']);

    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = p13dIcebreaker();
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
            ->assertSeeIn('section[aria-label="Icebreaker game"]', "Time's up")
            ->assertSeeIn('section[aria-label="Icebreaker game"]', 'sprint');
    }

    $a->assertSee('Next round');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut)
        ->and(DB::table('jobs')->count())->toBe(0);
});

it('[P13d-06e] abandons the round and brings the columns back when the facilitator moves to Writing', function () {
    ['retro' => $retro, 'room' => $room, 'ada' => $ada, 'bob' => $bob] = p13dIcebreaker();
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

it('[P13d-11a] shows "Games we played" between the action items and ROTI, with the podium, "Show all" and a drawing replay, to a member and to a guest', function () {
    ['retro' => $retro, 'room' => $room, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = p13dIcebreaker(
        RetroPhase::Completed,
        GameKind::Hangman,
        ['completed_at' => now()],
    );
    $cleoPlayer = p13dIcebreakerPlayer($retro, $room, 'Cleo');
    $danPlayer = p13dIcebreakerPlayer($retro, $room, 'Dan');
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
    $inOrder = '(() => { const titles = [...document.querySelectorAll("section > h2")].map((title) => title.textContent); return titles.indexOf("Action items") >= 0 && titles.indexOf("Action items") < titles.indexOf("Games we played") && titles.indexOf("Games we played") < titles.indexOf("Return on time invested"); })()';

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

it('[P13d-11b] labels GIF tiles "Anonymous GIF" in "Games we played" of an anonymous retro', function () {
    ['retro' => $retro, 'room' => $room, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = p13dIcebreaker(
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

    $page->assertSeeIn($games, '1 rounds played')
        ->assertSeeIn("{$games} ol.space-y-2 > li", 'How did the sprint feel?')
        ->assertSeeIn("{$games} ol.space-y-2 > li", 'Revealed')
        ->assertCount("{$games} figure", 2)
        ->assertCount("{$games} figcaption:has-text(\"Anonymous GIF\")", 2)
        ->assertSeeIn("{$games} figure:has(img[src=\"/gifs/partyone/preview\"])", 'Votes: 1')
        ->assertSeeIn("{$games} figure:has(img[src=\"/gifs/coffeeone/preview\"])", 'Votes: 0')
        ->assertDontSeeIn("{$games} ol.space-y-2", 'by Ada')
        ->assertDontSeeIn("{$games} ol.space-y-2", 'by Bob')
        ->assertNotPresent("{$games} button:has-text(\"Replay\")");
});
