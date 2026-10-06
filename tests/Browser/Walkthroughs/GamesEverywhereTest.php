<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Models\Column;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use App\Models\Team;

/** @var array<int, string> */
const GamesEverywhereGames = ['Hangman', 'Draw & Guess', 'Decoded', 'Sprint in one GIF', 'Two truths and a lie', 'Mood weather', 'Guess who?', 'Quick question'];

it('offers the eight games when a retro gets an icebreaker, and opens the retro on the chosen new game', function () {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'browser-gif-key', 'rating' => 'pg']]);
    $team = Team::factory()->create();
    $ada = renamedUser(teamMember($team), 'Ada');

    $page = $this->signIn($ada, route('teams.show', [$team->workspace, $team], false));

    $page->click('New session')
        ->fill('#new-retro-title', 'Sprint 27 retro')
        ->click('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"]:has-text("Start, Stop, Continue")')
        ->click('#new-retro-icebreaker')
        ->click('#new-retro-icebreaker-game')
        ->assertCount('[role="listbox"] [role="option"]', 8);

    foreach (GamesEverywhereGames as $game) {
        $page->assertPresent("[role=\"listbox\"] [role=\"option\"]:has-text(\"{$game}\")");
    }

    $page->click('[role="option"]:has-text("Quick question")')
        ->assertSeeIn('#new-retro-icebreaker-game', 'Quick question')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertPresent('section[aria-label="Icebreaker game"]')
        ->assertAriaAttribute('[role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]:has-text("Quick question")', 'checked', 'true');

    $retro = Retro::query()->where('title', 'Sprint 27 retro')->sole();

    expect($retro->icebreaker_game)->toBe(GameKind::QuickQuestion)
        ->and(GameRoom::query()->where('retro_id', $retro->id)->sole()->game)->toBe(GameKind::QuickQuestion);
});

it('names the new games on the Sessions page and in the history of a room', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $ada = renamedUser(teamMember($team), 'Ada');
    $room = GameRoom::factory()->game(GameKind::GuessWho)->create(['team_id' => $team->id, 'name' => 'Friday fun']);
    GameRoom::factory()->game(GameKind::TwoTruths)->create(['team_id' => $team->id, 'name' => 'Lies', 'updated_at' => now()->subDay()]);
    $player = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $ada->id]);
    $room->forceFill(['host_player_id' => $player->id])->save();
    GameRound::factory()->game(GameKind::MoodWeather)->ended(GameRoundOutcome::Revealed)->create([
        'game_room_id' => $room->id, 'word' => null, 'number' => 1, 'ended_at' => now()->subMinutes(5),
    ]);
    GameRound::factory()->game(GameKind::QuickQuestion)->ended(GameRoundOutcome::Finished)->create([
        'game_room_id' => $room->id, 'word' => null, 'question' => 'What made you smile this week?', 'number' => 1, 'ended_at' => now()->subMinutes(2),
    ]);

    $page = $this->signIn($ada, route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'icebreaker'], false));

    $page->assertSeeIn("a[href\$=\"/games/{$room->id}\"]", 'Guess who?')
        ->assertSeeIn('[data-slot="sessions-page"] [data-slot="load-more-feed"]', 'Two truths and a lie')
        ->click("a[href\$=\"/games/{$room->id}\"]")
        ->assertPathIs("/games/{$room->id}")
        ->click('History')
        ->assertSeeIn('[role="dialog"]', 'Mood weather')
        ->assertSeeIn('[role="dialog"]', 'What made you smile this week?')
        ->assertSeeIn('[role="dialog"]', 'Everyone has spoken');
});

it('lists the rounds of the new games in "Games we played" of a completed retro', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Completed)
        ->create(['title' => 'Sprint 27 retro', 'icebreaker_game' => GameKind::TwoTruths, 'completed_at' => now()]);
    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);
    [$ada, $adaParticipant] = retroFacilitator($retro);
    renamedUser($ada, 'Ada');
    $room = GameRoom::factory()->icebreaker($retro->fresh())->game(GameKind::TwoTruths)->create();
    $adaPlayer = GamePlayer::factory()->forParticipant($adaParticipant)->create(['game_room_id' => $room->id]);
    $truths = GameRound::factory()->game(GameKind::TwoTruths)->ended(GameRoundOutcome::Revealed)->create([
        'game_room_id' => $room->id, 'word' => null, 'leader_player_id' => $adaPlayer->id,
        'statements' => ['I ski', 'I sing', 'I fly'], 'lie_index' => 2, 'ended_at' => now()->subMinutes(20),
    ]);
    $mood = GameRound::factory()->game(GameKind::MoodWeather)->ended(GameRoundOutcome::Revealed)->create([
        'game_room_id' => $room->id, 'word' => null, 'ended_at' => now()->subMinutes(10),
    ]);
    $room->forceFill(['current_round_id' => $mood->id])->save();
    awardGamePoints($room, $adaPlayer, 2, false, ['game_round_id' => $truths->id, 'game' => GameKind::TwoTruths]);
    awardGamePoints($room, $adaPlayer, 0, false, ['game_round_id' => $mood->id, 'game' => GameKind::MoodWeather]);
    $games = 'section:has(> h2:has-text("Games we played"))';

    $page = $this->signIn($ada, "/retros/{$retro->id}");

    $page->assertSeeIn($games, '2 rounds played')
        ->assertSeeIn("{$games} ol.space-y-2 > li:has-text(\"3 statements\")", 'Revealed')
        ->assertSeeIn("{$games} ol.space-y-2 > li:has-text(\"Mood weather\")", 'Revealed')
        ->assertDontSeeIn($games, 'I fly');
});
