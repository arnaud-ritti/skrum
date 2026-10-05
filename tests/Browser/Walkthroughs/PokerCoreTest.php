<?php

use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use App\Models\Team;
use App\Models\User;
use Tests\Browser\Support\ReverbServer;

/**
 * @param  array<string, mixed>  $attributes
 */
function pokerCoreGame(array $attributes = []): PokerGame
{
    return PokerGame::factory()
        ->customCards(['1', '2', '3', '5', '8', '?', '☕'])
        ->create(['title' => 'Sprint 12 estimates', ...$attributes]);
}

/**
 * @return array{
 *     0: User,
 *     1: PokerPlayer
 * }
 */
function pokerCoreFacilitator(PokerGame $game, string $name = 'Ada Facilitator'): array
{
    [$user, $player] = pokerFacilitator($game);

    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return [$user, $player];
}

/**
 * @return array{
 *     0: User,
 *     1: PokerPlayer
 * }
 */
function pokerCoreMember(PokerGame $game, string $name): array
{
    [$user, $player] = pokerMember($game);

    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return [$user, $player];
}

function pokerCoreCurrentTaskScript(): string
{
    return 'document.querySelector(\'[data-test="poker-task-row"][aria-current="true"] span span\').textContent';
}

it('shows the planning poker section under the retrospectives on the team page', function () {
    $team = Team::factory()->create();
    $ada = renamedUser(teamMember($team), 'Ada Facilitator');

    $page = $this->signIn($ada, teamPath('teams.show', $team));

    $page->assertSee('No retrospectives yet.')
        ->assertSee('Planning poker')
        ->assertSee('New session')
        ->assertSee('Estimation history')
        ->assertSee('No games yet.')
        ->assertScript('document.body.innerText.indexOf("No retrospectives yet.") < document.body.innerText.indexOf("Planning poker")', true);
});

it('creates a game with a custom deck and opens it', function () {
    $team = Team::factory()->create();
    $ada = renamedUser(teamMember($team), 'Ada Facilitator');

    $page = $this->signIn($ada, teamPath('teams.show', $team));

    $page->assertSee('New session')
        ->click('New session')
        ->click('[role="dialog"] [role="radio"]:has-text("Planning poker")')
        ->assertVisible('#new-poker-title')
        ->assertScript('document.querySelector("#new-poker-title").value === "Poker " + new Date().toLocaleDateString("en", { dateStyle: "medium" })', true)
        ->assertCount('[aria-label="Deck"] [role="radio"]', 4)
        ->assertSee('Fibonacci')
        ->assertSee('Modified Fibonacci')
        ->assertSee('T-shirt sizes')
        ->assertSee('Powers of 2')
        ->assertSee('New deck')
        ->assertAttribute('[aria-label="Deck"] [role="radio"] >> nth=0', 'aria-checked', 'true')
        ->assertScript('Array.from(document.querySelectorAll(\'[data-slot="deck-selected"] [data-slot="deck-preview-card"] > span[aria-hidden="true"]\')).map(function (chip) { return chip.textContent; }).join(" ")', '0 1 2 3 5 8 13 21 34 55 89 ? ☕')
        ->click('[role="dialog"] button:has-text("New deck")')
        ->assertVisible('#deck-custom-cards')
        ->fill('#deck-custom-cards', '1, 2, 3, 5, 8')
        ->assertSee("I don't know")
        ->assertSee('I need a break')
        ->assertAttribute('#deck-custom-unknown', 'aria-checked', 'true')
        ->assertAttribute('#deck-custom-coffee', 'aria-checked', 'true')
        ->fill('#new-poker-title', 'Sprint 12 estimates')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/');

    $game = PokerGame::query()->sole();

    $page->assertPathIs("/poker/{$game->id}")
        ->assertVisible('[aria-label="Game title"]')
        ->assertValue('[aria-label="Game title"]', 'Sprint 12 estimates')
        ->assertSee('Custom')
        ->assertVisible('[aria-label="Facilitator menu"]')
        ->assertSee('Add the first task')
        ->assertNotPresent('[aria-label="Your cards"]');

    expect($game->cards)->toBe(['1', '2', '3', '5', '8', '?', '☕'])
        ->and($game->team_id)->toBe($team->id);
});

it('rejects a custom deck with a repeated card or without an estimate card', function () {
    $team = Team::factory()->create();
    $ada = renamedUser(teamMember($team), 'Ada Facilitator');

    $page = $this->signIn($ada, teamPath('teams.show', $team));

    $page->assertSee('New session')
        ->click('New session')
        ->click('[role="dialog"] [role="radio"]:has-text("Planning poker")')
        ->assertVisible('[role="dialog"] button:has-text("New deck")')
        ->click('[role="dialog"] button:has-text("New deck")')
        ->assertVisible('#deck-custom-cards')
        ->fill('#deck-custom-cards', '3,  3')
        ->assertSee('Duplicate value: 3')
        ->click('Create & open')
        ->assertSee('This deck needs at least 2 values before the game is created.')
        ->fill('#deck-custom-cards', '?, ☕')
        ->assertSee('Use the switches below for ? and ☕.')
        ->click('Create & open')
        ->assertSee('This deck needs at least 2 values before the game is created.')
        ->assertPathIs(teamPath('teams.show', $team))
        ->click('[role="dialog"] [data-slot="session-dialog-footer"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('No games yet.');

    expect(PokerGame::query()->count())->toBe(0);
});

it('adds tasks in order and renders their Markdown safely', function () {
    $game = pokerCoreGame();
    [$ada] = pokerCoreFacilitator($game);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Add the first task')
        ->click('Add task')
        ->assertVisible('#poker-task-title')
        ->fill('#poker-task-title', 'Login page')
        ->fill('#poker-task-description', "**bold** and [the docs](https://example.com/docs)\n\n<script>alert(1)</script>")
        ->click('Save')
        ->assertCount('@poker-task-row', 1)
        ->click('Add task')
        ->assertVisible('#poker-task-title')
        ->fill('#poker-task-title', 'Password reset')
        ->click('Save')
        ->assertCount('@poker-task-row', 2)
        ->click('Add task')
        ->assertVisible('#poker-task-title')
        ->fill('#poker-task-title', 'Export invoices')
        ->click('Save')
        ->assertCount('@poker-task-row', 3)
        ->assertScript(pokerTaskTitlesScript(), 'Login page / Password reset / Export invoices');

    $page->click('Login page')
        ->assertVisible('section[aria-labelledby^="poker-task-"] strong')
        ->assertScript('document.querySelector(\'section[aria-labelledby^="poker-task-"] strong\').textContent', 'bold')
        ->assertAttribute('section[aria-labelledby^="poker-task-"] a[href="https://example.com/docs"]', 'target', '_blank')
        ->assertAttributeContains('section[aria-labelledby^="poker-task-"] a[href="https://example.com/docs"]', 'rel', 'noopener')
        ->assertSee('<script>alert(1)</script>')
        ->assertScript('document.querySelectorAll(\'section[aria-labelledby^="poker-task-"] script\').length', 0);

    expect(PokerTask::query()->where('poker_game_id', $game->id)->orderBy('position')->pluck('title')->all())
        ->toBe(['Login page', 'Password reset', 'Export invoices']);
});

it('moves a task to the top with the keyboard and keeps the order after a reload', function () {
    $game = pokerCoreGame();
    [$ada] = pokerCoreFacilitator($game);
    [$bob] = pokerCoreMember($game, 'Bob Member');

    foreach (['Login page', 'Password reset', 'Export invoices'] as $title) {
        PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => $title]);
    }

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertCount('@poker-task-row', 3);

    $this->dragWithKeyboard(
        $facilitator,
        '[aria-label="Drag to reorder Export invoices"]',
        ['Space', 'ArrowUp', 'ArrowUp', 'Space'],
    );

    $facilitator->assertScript(pokerTaskTitlesScript(), 'Export invoices / Login page / Password reset');
    $member->assertScript(pokerTaskTitlesScript(), 'Export invoices / Login page / Password reset');

    $facilitator->navigate("/poker/{$game->id}")
        ->assertCount('@poker-task-row', 3)
        ->assertScript(pokerTaskTitlesScript(), 'Export invoices / Login page / Password reset');
});

it('lets the facilitator allow guests and gives a working guest link', function () {
    $game = pokerCoreGame();
    [$ada] = pokerCoreFacilitator($game);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Hand over facilitation…')
        ->assertDontSee('Settings…')
        ->assertDontSee('Guest link…')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]')
        ->click('[aria-label="Share"]')
        ->assertVisible('#poker-guest-link-access')
        ->click('#poker-guest-link-access')
        ->assertVisible('input[aria-label="Guest link"]')
        ->assertSee('Copy');

    $joinUrl = $facilitator->value('input[aria-label="Guest link"]');

    expect($joinUrl)->toEndWith("/poker/join/{$game->guest_token}")
        ->and($game->refresh()->guest_access_enabled)->toBeTrue();

    $guest = $this->joinAsGuest($joinUrl, 'Visitor');

    $guest->assertPathIs("/poker/{$game->id}")
        ->assertSee('Sprint 12 estimates');
});

it('lets a guest join through the link with a restricted view', function () {
    $game = pokerCoreGame(['guest_access_enabled' => true]);
    [$ada] = pokerCoreFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $joinUrl = "/poker/join/{$game->guest_token}";

    visit($joinUrl)
        ->assertSee('Sprint 12 estimates')
        ->assertSee('Join as a guest')
        ->assertSee('Your nickname')
        ->assertSee('Join as spectator');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest($joinUrl, 'Visitor'));

    $guest->assertPathIs("/poker/{$game->id}")
        ->assertSee('Sprint 12 estimates')
        ->assertCount('img[data-presence-id]', 2)
        ->assertPresent('img[data-presence-id][alt="Ada Facilitator"]')
        ->assertPresent('img[data-presence-id][alt="Visitor"]')
        ->assertNotPresent('[aria-label="Back to the team"]')
        ->assertDontSee('Add task')
        ->assertVisible('[aria-label="Language"]');

    $facilitator->assertCount('img[data-presence-id]', 2)
        ->assertPresent('img[data-presence-id][alt="Visitor"]')
        ->assertVisible('[aria-label="Back to the team"]')
        ->assertSee('Add task')
        ->assertNotPresent('[aria-label="Language"]');
});

it('shows the task picked by the facilitator as current to everyone', function () {
    $game = pokerCoreGame(['guest_access_enabled' => true]);
    [$ada] = pokerCoreFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Password reset']);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $facilitator->assertSee('Pick a task to start voting');
    $guest->assertSee('Waiting for the facilitator to pick a task');

    $facilitator->click('Login page')
        ->assertCount('[data-test="poker-task-row"][aria-current="true"]', 1)
        ->assertScript(pokerCoreCurrentTaskScript(), 'Login page')
        ->assertSee('Reveal cards')
        ->assertButtonDisabled('Reveal cards');

    $guest->assertCount('[data-test="poker-task-row"][aria-current="true"]', 1)
        ->assertScript(pokerCoreCurrentTaskScript(), 'Login page')
        ->assertVisible('section[aria-labelledby^="poker-task-"]')
        ->assertEnabled('[aria-label="Play 5"]')
        ->assertDontSee('Reveal cards');
});

it('shows a played card face-down and never its value before the reveal', function () {
    $game = pokerCoreGame(['guest_access_enabled' => true]);
    [$ada] = pokerCoreFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    openPokerRound($game, $task);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $guest->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]');

    $facilitator->assertVisible('[aria-label="Visitor: Voted"]')
        ->assertSee('Votes: 1')
        ->assertNotPresent('[aria-label="Visitor: 5"]')
        ->assertDontSeeIn('section[aria-label="Players"]', '5')
        ->assertScript('document.querySelector(\'section[aria-label="Players"]\').innerText.includes("5")', false)
        ->assertButtonEnabled('Reveal cards')
        ->assertEnabled('[aria-label="Play 8"]')
        ->click('[aria-label="Play 8"]');

    $guest->assertVisible('[aria-label="Ada Facilitator: Voted"]')
        ->assertSee('Votes: 2')
        ->assertNotPresent('[aria-label="Ada Facilitator: 8"]')
        ->assertDontSeeIn('section[aria-label="Players"]', '8')
        ->assertScript('document.querySelector(\'section[aria-label="Players"]\').innerText.includes("8")', false);
});

it('lets a player change, withdraw and replay a card', function () {
    $game = pokerCoreGame(['guest_access_enabled' => true]);
    [$ada] = pokerCoreFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    openPokerRound($game, $task);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $guest->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]')
        ->assertAttribute('[aria-label="Play 5"]', 'aria-pressed', 'true');

    $facilitator->assertVisible('[aria-label="Visitor: Voted"]')
        ->assertSee('Votes: 1');

    $guest->assertEnabled('[aria-label="Play 3"]')
        ->click('[aria-label="Play 3"]')
        ->assertAttribute('[aria-label="Play 3"]', 'aria-pressed', 'true')
        ->assertAttribute('[aria-label="Play 5"]', 'aria-pressed', 'false')
        ->assertEnabled('[aria-label="Play 3"]')
        ->click('[aria-label="Play 3"]')
        ->assertAttribute('[aria-label="Play 3"]', 'aria-pressed', 'false');

    $facilitator->assertVisible('[aria-label="Visitor: Not voted yet"]')
        ->assertSee('Votes: 0');

    $guest->assertEnabled('[aria-label="Play 3"]')
        ->click('[aria-label="Play 3"]')
        ->assertAttribute('[aria-label="Play 3"]', 'aria-pressed', 'true');

    $facilitator->assertVisible('[aria-label="Visitor: Voted"]')
        ->assertSee('Votes: 1');

    $visitor = PokerPlayer::query()
        ->where('poker_game_id', $game->id)
        ->where('guest_name', 'Visitor')
        ->sole();

    expect(PokerVote::query()->where('poker_player_id', $visitor->id)->pluck('value')->all())->toBe(['3']);
});

it('reveals both votes with the result to everyone', function () {
    $game = pokerCoreGame();
    [$ada, $adaPlayer] = pokerCoreFacilitator($game);
    [$bob, $bobPlayer] = pokerCoreMember($game, 'Bob Member');
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $round = openPokerRound($game, $task);
    pokerVote($round, $adaPlayer, '8');
    pokerVote($round, $bobPlayer, '3');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertSee('Reveal cards')
        ->assertButtonEnabled('Reveal cards')
        ->click('Reveal cards');

    foreach ([$facilitator, $member] as $page) {
        $page->assertVisible('[aria-label="Ada Facilitator: 8"]')
            ->assertVisible('[aria-label="Bob Member: 3"]')
            ->assertSee('Average')
            ->assertSee('5.5')
            ->assertSee('Nearest card: 5')
            ->assertScript('Array.from(document.querySelectorAll(\'[aria-labelledby="poker-result"] li\')).map(function (row) { return row.querySelectorAll("span")[0].textContent + " x" + row.querySelectorAll("span")[2].textContent; }).join(" / ")', '3 x1 / 8 x1')
            ->assertDontSee('Consensus')
            ->assertNotPresent('[aria-label="Play 5"]');
    }
});

it('re-votes to a consensus and saves the estimate for everyone', function () {
    $game = pokerCoreGame();
    [$ada, $adaPlayer] = pokerCoreFacilitator($game);
    [$bob, $bobPlayer] = pokerCoreMember($game, 'Bob Member');
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $firstRound = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($firstRound, $adaPlayer, '8');
    pokerVote($firstRound, $bobPlayer, '3');
    $game->forceFill(['current_task_id' => $task->id])->save();

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertSee('Re-vote')
        ->click('Re-vote')
        ->assertVisible('[aria-label="Ada Facilitator: Not voted yet"]')
        ->assertSee('Reveal cards');

    $member->assertVisible('[aria-label="Bob Member: Not voted yet"]')
        ->assertEnabled('[aria-label="Play 5"]');

    $facilitator->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]');
    $member->click('[aria-label="Play 5"]');

    $facilitator->assertVisible('[aria-label="Bob Member: Voted"]')
        ->assertSee('Votes: 2')
        ->assertButtonEnabled('Reveal cards')
        ->click('Reveal cards');

    foreach ([$facilitator, $member] as $page) {
        $page->assertSee('Consensus')
            ->assertSee('Nearest card: 5');
    }

    $facilitator->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '5')
        ->assertSee('Validate 5')
        ->click('@poker-validate');

    foreach ([$facilitator, $member] as $page) {
        $page->assertSee('Estimate: 5')
            ->assertScript('Array.from(document.querySelectorAll(\'[data-test="poker-task-row"] [data-slot="badge"]\')).map(function (badge) { return badge.textContent; }).join(" / ")', '5 / Votes: 2');
    }

    $facilitator->assertAttribute('button:has-text("Rounds (2)")', 'aria-expanded', 'true')
        ->assertSee('Round 2')
        ->assertSee('Round 1')
        ->assertSee('Ada Facilitator: 5')
        ->assertSee('Bob Member: 5')
        ->assertSee('Ada Facilitator: 8')
        ->assertSee('Bob Member: 3')
        ->assertSee('avg 5.5 · re-voted');

    expect($task->refresh()->estimate)->toBe('5');
});

it('moves to the next task and drops a deleted current task for everyone', function () {
    $game = pokerCoreGame(['guest_access_enabled' => true]);
    [$ada] = pokerCoreFacilitator($game);
    $estimated = PokerTask::factory()->estimated('5')->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Password reset']);
    openPokerRound($game, $estimated);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $facilitator->assertSee('Next task')
        ->click('Next task')
        ->assertScript(pokerCoreCurrentTaskScript(), 'Password reset');

    $guest->assertScript(pokerCoreCurrentTaskScript(), 'Password reset')
        ->assertEnabled('[aria-label="Play 3"]')
        ->click('[aria-label="Play 3"]');

    $facilitator->assertVisible('[aria-label="Visitor: Voted"]')
        ->assertVisible('[aria-label="Delete task"]')
        ->click('[aria-label="Delete task"]')
        ->assertSee('Delete this task?')
        ->click('[role="alertdialog"] button:has-text("Delete")');

    $facilitator->assertSee('Pick a task to start voting')
        ->assertCount('@poker-task-row', 1);

    $guest->assertSee('Waiting for the facilitator to pick a task')
        ->assertCount('@poker-task-row', 1)
        ->assertDontSee('Password reset');

    expect(PokerTask::query()->where('poker_game_id', $game->id)->pluck('title')->all())->toBe(['Login page'])
        ->and($game->refresh()->current_task_id)->toBeNull();
});

it('makes an ended game read-only for everyone and editable again once reopened', function () {
    $game = pokerCoreGame(['guest_access_enabled' => true]);
    [$ada] = pokerCoreFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    openPokerRound($game, $task);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $guest->assertEnabled('[aria-label="Play 5"]');

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('End game')
        ->click('End game')
        ->assertSee('End this game?')
        ->click('[role="alertdialog"] button:has-text("End game")');

    $facilitator->assertSee('Game ended')
        ->assertDontSee('Add task')
        ->assertNotPresent('[data-test="poker-task-row"] button')
        ->assertDisabled('[aria-label="Play 5"]');

    $guest->assertSee('Game ended')
        ->assertSee('Waiting for the facilitator to pick a task')
        ->assertDisabled('[aria-label="Play 5"]');

    expect($game->refresh()->ended_at)->not->toBeNull();

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Reopen game')
        ->click('Reopen game')
        ->assertDontSee('Game ended')
        ->assertSee('Add task')
        ->click('Login page');

    $guest->assertDontSee('Game ended')
        ->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]');

    $facilitator->assertVisible('[aria-label="Visitor: Voted"]');

    expect($game->refresh()->ended_at)->toBeNull();
});

it('lets another member take control and hand facilitation back', function () {
    $game = pokerCoreGame();
    [$ada, $adaPlayer] = pokerCoreFacilitator($game);
    [$cleo, $cleoPlayer] = pokerCoreMember($game, 'Cleo Member');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($cleo, "/poker/{$game->id}"));

    $facilitator->assertVisible('[aria-label="Facilitator menu"]');

    $member->assertSee('Take control')
        ->click('Take control')
        ->assertVisible('[aria-label="Facilitator menu"]')
        ->assertDontSee('Take control');

    $facilitator->assertSee('Take control')
        ->assertNotPresent('[aria-label="Facilitator menu"]');

    expect($game->refresh()->facilitator_player_id)->toBe($cleoPlayer->id);

    $member->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Hand over facilitation…')
        ->click('Hand over facilitation…')
        ->assertVisible('#poker-new-facilitator')
        ->click('#poker-new-facilitator')
        ->assertVisible('[role="option"]:has-text("Ada Facilitator")')
        ->click('[role="option"]:has-text("Ada Facilitator")')
        ->assertButtonEnabled('Hand over')
        ->click('Hand over');

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->assertDontSee('Take control');

    $member->assertSee('Take control')
        ->assertNotPresent('[aria-label="Facilitator menu"]');

    expect($game->refresh()->facilitator_player_id)->toBe($adaPlayer->id);
});

it('lets a member take control of an ended game and reopen it', function () {
    $game = pokerCoreGame(['ended_at' => now()]);
    [$ada] = pokerCoreFacilitator($game);
    [$cleo, $cleoPlayer] = pokerCoreMember($game, 'Cleo Member');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($cleo, "/poker/{$game->id}"));

    $facilitator->assertSee('Game ended');

    $member->assertSee('Game ended')
        ->assertSee('Take control')
        ->click('Take control')
        ->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Reopen game')
        ->click('Reopen game')
        ->assertDontSee('Game ended');

    $facilitator->assertDontSee('Game ended')
        ->assertSee('Take control');

    expect($game->refresh()->ended_at)->toBeNull()
        ->and($game->facilitator_player_id)->toBe($cleoPlayer->id);
});

it('ends the access of guests when the guest link is regenerated', function () {
    $game = pokerCoreGame(['guest_access_enabled' => true]);
    [$ada] = pokerCoreFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $oldToken = $game->guest_token;

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$oldToken}", 'Visitor'));

    $facilitator->assertVisible('[aria-label="Share"]')
        ->click('[aria-label="Share"]')
        ->assertVisible('input[aria-label="Guest link"]');

    $oldUrl = $facilitator->value('input[aria-label="Guest link"]');

    $facilitator->click('Regenerate link')
        ->assertSeeIn('[role="alertdialog"]', 'Regenerate the invite link?')
        ->click('[role="alertdialog"] button:text-is("Regenerate")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertValueIsNot('input[aria-label="Guest link"]', $oldUrl);

    $guest->assertSee('Your access to this game has ended.')
        ->assertDontSee('Back to the team');

    visit($oldUrl)->assertSee('This guest link is no longer valid.');

    expect($game->refresh()->guest_token)->not->toBe($oldToken)
        ->and($facilitator->value('input[aria-label="Guest link"]'))->toEndWith("/poker/join/{$game->guest_token}");
});

it('shows the game summary on the team page and the rounds in the estimation history', function () {
    $game = pokerCoreGame();
    [$ada, $adaPlayer] = pokerCoreFacilitator($game);
    [, $bobPlayer] = pokerCoreMember($game, 'Bob Member');
    $task = PokerTask::factory()->estimated('5')->create(['poker_game_id' => $game->id, 'title' => 'Export invoices']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Password reset']);
    $firstRound = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($firstRound, $adaPlayer, '8');
    pokerVote($firstRound, $bobPlayer, '3');
    $secondRound = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($secondRound, $adaPlayer, '5');
    pokerVote($secondRound, $bobPlayer, '5');
    $otherGame = pokerCoreGame(['team_id' => $game->team_id, 'title' => 'Sprint 13 estimates']);
    PokerTask::factory()->estimated('3')->create(['poker_game_id' => $otherGame->id, 'title' => 'Search page']);
    $teamPath = teamPath('teams.show', $game->team);

    $page = $this->signIn($ada, $teamPath);

    $page->assertSee('Sprint 12 estimates')
        ->assertSee('3 tasks · 1 estimated · 5 points')
        ->assertSee('Last activity')
        ->click('Estimation history')
        ->assertPathIs("{$teamPath}/estimates")
        ->assertSee('Export invoices')
        ->assertSee('Search page');

    $page->click('button[aria-label="Game"]')
        ->assertVisible('[role="option"]:has-text("Sprint 12 estimates")')
        ->click('[role="option"]:has-text("Sprint 12 estimates")')
        ->assertQueryStringHas('game', $game->id)
        ->assertDontSee('Search page')
        ->assertSee('Export invoices');

    $page->fill('input[aria-label="Search tasks"]', 'search')
        ->assertQueryStringHas('q', 'search')
        ->assertSee('No matching tasks.')
        ->fill('input[aria-label="Search tasks"]', 'invoice')
        ->assertQueryStringHas('q', 'invoice')
        ->assertSee('Export invoices');

    $page->assertVisible('[aria-label="Show rounds"]')
        ->click('[aria-label="Show rounds"]')
        ->assertSee('Round 2')
        ->assertSee('Round 1')
        ->assertSee('Ada Facilitator: 5')
        ->assertSee('Bob Member: 5')
        ->assertSee('Ada Facilitator: 8')
        ->assertSee('Bob Member: 3')
        ->assertSee('5 × 2')
        ->assertSee('Average: 5.5')
        ->assertSee('Consensus');
});

it('deletes the game, sends the facilitator to the team page and tells the guest', function () {
    $game = pokerCoreGame(['guest_access_enabled' => true]);
    [$ada] = pokerCoreFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $teamPath = teamPath('teams.show', $game->team);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Delete game…')
        ->click('Delete game…')
        ->assertSee('Delete this game?')
        ->click('[role="alertdialog"] button:has-text("Delete")');

    $facilitator->assertPathIs($teamPath)
        ->assertSee('Planning poker')
        ->assertSee('No games yet.');

    $guest->assertSee('This game was deleted.')
        ->assertDontSee('Back to the team');

    expect(PokerGame::query()->whereKey($game->id)->exists())->toBeFalse();
});

it('shows the reconnecting banner and catches up when the connection returns', function () {
    $game = pokerCoreGame(['guest_access_enabled' => true]);
    [$ada] = pokerCoreFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    try {
        ReverbServer::stop();

        $guest->assertSee('Reconnecting…');

        $facilitator->assertSee('Add task')
            ->click('Add task')
            ->assertVisible('#poker-task-title')
            ->fill('#poker-task-title', 'Added while offline')
            ->click('Save')
            ->assertCount('@poker-task-row', 2);

        $guest->assertSee('Reconnecting…')
            ->assertCount('@poker-task-row', 1);
    } finally {
        ReverbServer::start();
    }

    $guest->assertDontSee('Reconnecting…')
        ->assertSee('Added while offline')
        ->assertCount('@poker-task-row', 2);
});
