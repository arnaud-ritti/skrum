<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Models\Column;
use App\Models\GameChoice;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\GameStatementSet;
use App\Models\GameTextAnswer;
use App\Models\Retro;
use App\Models\User;
use App\Support\Games\GameWordBook;

/**
 * @return array{room: GameRoom, ada: User, adaPlayer: GamePlayer, bob: User, bobPlayer: GamePlayer}
 */
function newGamesRoom(GameKind $game): array
{
    $room = GameRoom::factory()->game($game)->linkAccess()->create(['name' => 'Lunch']);
    [$ada, $adaPlayer] = gameRoomHost($room);
    [$bob, $bobPlayer] = gameRoomMember($room);

    $room->forceFill(['created_by_user_id' => $ada->id])->save();
    $ada->forceFill(['name' => 'Ada Host', 'locale' => 'en'])->save();
    $bob->forceFill(['name' => 'Bob', 'locale' => 'en'])->save();

    return ['room' => $room->fresh(), 'ada' => $ada, 'adaPlayer' => $adaPlayer, 'bob' => $bob, 'bobPlayer' => $bobPlayer];
}

function newGamesPlayerRow(string $name): string
{
    return "[data-slot=\"game-left\"] [data-slot=\"player-row\"]:has-text(\"{$name}\")";
}

function newGamesRadio(string $board, string $label): string
{
    return "[data-slot=\"{$board}\"] [role=\"radio\"]:has-text(\"{$label}\")";
}

function newGamesOnlyPrompt(string $prompt): void
{
    app()->instance(GameWordBook::class, new GameWordBook(prompts: ['en' => [$prompt]]));
}

const NewGamesSetForm = '[data-slot="two-truths-set-form"]';

it('plays a round of Two truths and a lie: sets prepared before, a teller chosen among the ready players, votes and the reveal', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = newGamesRoom(GameKind::TwoTruths);
    GameStatementSet::factory()->create([
        'game_room_id' => $room->id,
        'player_id' => $bobPlayer->id,
        'statements' => ['I ski', 'I sing', 'I fly'],
        'lie_index' => 2,
    ]);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="3 online"]');

    $host->assertSeeIn(NewGamesSetForm, 'My statements')
        ->fill(NewGamesSetForm.' form > div:nth-child(1) textarea', 'I have three cats')
        ->fill(NewGamesSetForm.' form > div:nth-child(2) textarea', 'I ran a marathon')
        ->fill(NewGamesSetForm.' form > div:nth-child(3) textarea', 'I was born in Lyon')
        ->click(NewGamesSetForm.' fieldset label:has-text("Statement 2")')
        ->click(NewGamesSetForm.' button[type="submit"]')
        ->assertSeeIn(NewGamesSetForm, 'Statements ready')
        ->assertSeeIn(NewGamesSetForm, 'I ran a marathon');

    $member->assertSeeIn(newGamesPlayerRow('Ada Host'), 'Statements ready')
        ->assertSeeIn(newGamesPlayerRow('Bob'), 'Statements ready')
        ->assertDontSeeIn(newGamesPlayerRow('Visitor'), 'Statements ready')
        ->assertDontSee('I ran a marathon')
        ->assertSee('Waiting for the host to start.');
    $guest->assertDontSee('I ski')
        ->assertSeeIn(NewGamesSetForm, 'My statements');

    expect(GameStatementSet::query()->where('player_id', $adaPlayer->id)->sole()->lie_index)->toBe(1);

    $host->click('[aria-label="Who tells?"]')
        ->click('[role="option"]:has-text("Bob")')
        ->click('[data-slot="round-start-card"] button:has-text("Start")');

    $member->assertSeeIn('#two-truths-teller', 'Your statements')
        ->assertSeeIn('[data-slot="two-truths-board"] li:has-text("I fly")', 'Lie')
        ->assertNotPresent('[data-slot="two-truths-board"] [role="radio"]');
    $host->assertSeeIn('#two-truths-teller', "Bob's statements")
        ->assertCount('[data-slot="two-truths-board"] [role="radio"]', 3)
        ->assertNotPresent('[data-slot="two-truths-board"] [data-slot="badge"]');

    $host->click(newGamesRadio('two-truths-board', 'I fly'))
        ->assertAriaAttribute(newGamesRadio('two-truths-board', 'I fly'), 'checked', 'true');
    $guest->click(newGamesRadio('two-truths-board', 'I ski'));

    $member->assertSee('2 of 2 voted')
        ->click('Reveal the lie');

    foreach ([$host, $member, $guest] as $page) {
        $page->assertSeeIn('[data-slot="two-truths-result"] li:has-text("I fly")', 'Lie')
            ->assertSeeIn('[data-slot="two-truths-result"] li:has-text("I ski")', 'True')
            ->assertPresent('[data-slot="two-truths-result"] li:has-text("I fly") ul[aria-label="Picked by Ada Host"]')
            ->assertPresent('[data-slot="two-truths-result"] li:has-text("I ski") ul[aria-label="Picked by Visitor"]')
            ->assertSeeIn('[data-slot="round-end-card"] [aria-label="Points of this round"]', '+5 Ada Host')
            ->assertSeeIn('[data-slot="round-end-card"] [aria-label="Points of this round"]', '+2 Bob');
    }

    $member->assertSeeIn(NewGamesSetForm, 'Played')
        ->assertSeeIn(NewGamesSetForm, 'Write new ones');

    expect(GameRound::query()->sole()->outcome)->toBe(GameRoundOutcome::Revealed);
});

it('disables the start of Two truths while no one has statements ready', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob] = newGamesRoom(GameKind::TwoTruths);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="3 online"]');

    $host->assertSeeIn('[data-slot="round-start-card"]', 'No one has statements ready.')
        ->assertDisabled('[data-slot="round-start-card"] button:has-text("Start")')
        ->assertNotPresent('[aria-label="Who tells?"]');
});

it('gathers the anonymous mood of three players and shows the weather, never who picked it', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob] = newGamesRoom(GameKind::MoodWeather);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="3 online"]');

    $host->click('[data-slot="round-start-card"] button:has-text("Start")');

    foreach ([$host, $member, $guest] as $page) {
        $page->assertSeeIn('#mood-weather-prompt', "What's the weather of your mood?")
            ->assertSee('Answers are anonymous.')
            ->assertCount('[data-slot="mood-weather-board"] [role="radio"]', 5);
    }

    $host->click(newGamesRadio('mood-weather-board', 'Sunny'));
    $member->click(newGamesRadio('mood-weather-board', 'Sunny'));
    $guest->click(newGamesRadio('mood-weather-board', 'Rainy'))
        ->assertAriaAttribute(newGamesRadio('mood-weather-board', 'Rainy'), 'checked', 'true');

    $host->assertSee('3 answered')
        ->click('Show the weather');

    foreach ([$host, $member, $guest] as $page) {
        $page->assertSeeIn('[data-slot="mood-weather-result"] li:has-text("Sunny")', '2')
            ->assertSeeIn('[data-slot="mood-weather-result"] li:has-text("Rainy")', '1')
            ->assertSeeIn('[data-slot="mood-weather-result"]', '3 answered')
            ->assertNotPresent('[data-slot="mood-weather-result"] [data-slot="person-avatar"]');
    }

    $snapshot = $this->snapshotOf($member, "/games/{$room->id}/snapshot");

    expect(json_encode($snapshot, JSON_THROW_ON_ERROR))->not->toContain('sunny');
});

it('keeps the weather back under three answers', function () {
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = newGamesRoom(GameKind::MoodWeather);
    $round = activeGameRound($room, ['word' => null, 'number' => 1]);
    GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $adaPlayer->id, 'choice' => 'sunny']);
    GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $bobPlayer->id, 'choice' => 'stormy']);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));

    $host->assertAriaAttribute(newGamesRadio('mood-weather-board', 'Sunny'), 'checked', 'true')
        ->assertSee('2 answered')
        ->click('Show the weather');

    foreach ([$host, $member] as $page) {
        $page->assertSeeIn('[data-slot="mood-weather-result"]', 'Not enough answers to show the weather (3 needed).')
            ->assertDontSeeIn('[data-slot="round-end-card"]', 'Stormy');
    }
});

it('plays Guess who?: answers, one drawn answer without its author, a vote for the author and the reveal', function () {
    newGamesOnlyPrompt('What did you have for breakfast?');
    ['room' => $room, 'ada' => $ada, 'bob' => $bob, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = newGamesRoom(GameKind::GuessWho);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="3 online"]');

    $host->click('[data-slot="round-start-card"] button:has-text("Start")');

    foreach ([$host, $member, $guest] as $page) {
        $page->assertSee('What did you have for breakfast?')
            ->assertSee('0 answered');
    }

    $host->assertDisabled('button:has-text("Draw an answer")')
        ->assertSee('At least 2 answers are needed.');

    $member->fill('[data-slot="guess-who-board"] textarea', 'Porridge with honey')
        ->click('[data-slot="guess-who-board"] button[type="submit"]')
        ->assertSee('1 answered');
    $guest->fill('[data-slot="guess-who-board"] textarea', 'Cold pizza')
        ->click('[data-slot="guess-who-board"] button[type="submit"]')
        ->assertSee('2 answered');

    $host->assertSee('2 answered')
        ->assertDontSee('Porridge with honey')
        ->assertDontSee('Cold pizza')
        ->click('button:has-text("Draw an answer")');

    $drawn = GameTextAnswer::query()->where('is_drawn', true)->sole();
    $hidden = $drawn->text === 'Cold pizza' ? 'Porridge with honey' : 'Cold pizza';
    $authorIsBob = $drawn->player_id === $bobPlayer->id;
    [$authorPage, $otherAnswerer] = $authorIsBob ? [$member, $guest] : [$guest, $member];

    foreach ([$host, $member, $guest] as $page) {
        $page->assertSeeIn('[data-slot="guess-who-vote"]', $drawn->text)
            ->assertDontSee($hidden)
            ->assertSee('0 voted');
    }

    $authorPage->assertSee("It's your answer — the others are guessing.")
        ->assertNotPresent('[data-slot="guess-who-vote"] [role="radio"]');

    $authorName = $authorIsBob ? 'Bob' : 'Visitor';
    $wrongName = $authorIsBob ? 'Visitor' : 'Bob';

    $host->assertCount('[data-slot="guess-who-vote"] [role="radio"]', 2)
        ->click("[data-slot=\"guess-who-vote\"] [role=\"radio\"][aria-label=\"{$authorName}\"]")
        ->assertSee('1 voted');
    $otherAnswerer->assertCount('[data-slot="guess-who-vote"] [role="radio"]', 1)
        ->click("[data-slot=\"guess-who-vote\"] [role=\"radio\"][aria-label=\"{$authorName}\"]");

    $authorPage->assertSee('2 voted');

    $host->click('Show the author');

    foreach ([$host, $member, $guest] as $page) {
        $page->assertSeeIn('[data-slot="guess-who-result"]', "Written by {$authorName}")
            ->assertPresent("[data-slot=\"guess-who-result\"] ul[aria-label=\"Named by Ada Host, {$wrongName}\"]")
            ->assertDontSee($hidden);
    }

    $host->assertAttribute('[data-slot="guess-who-result"] [data-slot="my-vote"]', 'data-correct', 'true')
        ->assertSeeIn('[data-slot="round-end-card"] [aria-label="Points of this round"]', '+5 Ada Host');

    expect(GameRound::query()->sole()->outcome)->toBe(GameRoundOutcome::Revealed)
        ->and($adaPlayer->id)->not->toBe($drawn->player_id);
});

it('passes the word round the speaking order in Quick question, "Done" for the speaker and "Next" for the host', function () {
    newGamesOnlyPrompt('What made you smile this week?');
    ['room' => $room, 'ada' => $ada] = newGamesRoom(GameKind::QuickQuestion);

    $host = $this->awaitRealtime($this->signIn($ada, "/games/{$room->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Visitor'));
    $third = $this->awaitRealtime($this->joinAsGuest("/play/{$room->guest_token}", 'Zoe'));

    $host->assertPresent('[role="group"][aria-label="3 online"]')
        ->click('[data-slot="round-start-card"] button:has-text("Start")');

    $host->assertSeeIn('[data-slot="quick-question-speaker"]', 'Your turn to speak')
        ->assertSeeIn('[data-slot="turn-order"] h3', 'Speaking order')
        ->assertSeeIn('[data-slot="turn-order"]', 'Next: Visitor');
    $guest->assertSee('What made you smile this week?')
        ->assertSeeIn('[data-slot="quick-question-speaker"]', 'Ada Host is speaking')
        ->assertNotPresent('[data-slot="quick-question-speaker"] button');

    $host->click('[data-slot="quick-question-speaker"] button:has-text("Done")');

    $guest->assertSeeIn('[data-slot="quick-question-speaker"]', 'Your turn to speak');
    $host->assertSeeIn('[data-slot="quick-question-speaker"]', 'Visitor is speaking')
        ->click('[data-slot="quick-question-speaker"] button:has-text("Next")');

    $third->assertSeeIn('[data-slot="quick-question-speaker"]', 'Your turn to speak')
        ->click('[data-slot="quick-question-speaker"] button:has-text("Done")');

    foreach ([$host, $guest, $third] as $page) {
        $page->assertSeeIn('[data-slot="round-end-card"]', 'Everyone has spoken');
    }

    expect(GameRound::query()->sole()->outcome)->toBe(GameRoundOutcome::Finished);
});

it('plays Mood weather as the icebreaker of a retro and says Guess who? is not available in an anonymous retro', function () {
    $retro = Retro::factory()->withIcebreaker()->anonymous()->inPhase(RetroPhase::Icebreaker)
        ->create(['title' => 'Sprint 27 retro', 'icebreaker_game' => GameKind::MoodWeather]);
    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);
    [$ada, $adaParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);
    $ada->forceFill(['name' => 'Ada', 'locale' => 'en'])->save();
    $bob->forceFill(['name' => 'Bob', 'locale' => 'en'])->save();
    $room = GameRoom::factory()->icebreaker($retro->fresh())->game(GameKind::MoodWeather)->create();
    GamePlayer::factory()->forParticipant($adaParticipant)->create(['game_room_id' => $room->id]);
    GamePlayer::factory()->forParticipant($bobParticipant)->create(['game_room_id' => $room->id]);
    $card = fn (string $game): string => "[role=\"radiogroup\"][aria-label=\"Choose an icebreaker\"] [role=\"radio\"]:has-text(\"{$game}\")";

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $a->assertPresent('section[aria-label="Icebreaker game"]')
        ->assertAriaAttribute($card('Guess who?'), 'disabled', 'true')
        ->assertSeeIn($card('Guess who?'), 'Not in an anonymous retro')
        ->assertAriaAttribute($card('Mood weather'), 'checked', 'true')
        ->click('section[aria-label="Icebreaker game"] [data-slot="round-start-card"] button:has-text("Start")');

    $a->click(newGamesRadio('mood-weather-board', 'Cloudy'));
    $b->click(newGamesRadio('mood-weather-board', 'Stormy'));

    $a->assertSee('2 answered')
        ->click('Show the weather');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[data-slot="mood-weather-result"]', 'Not enough answers to show the weather (3 needed).');
    }

    expect(GameRound::query()->sole())
        ->game->toBe(GameKind::MoodWeather)
        ->outcome->toBe(GameRoundOutcome::Revealed);
});
