<?php

use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use App\Models\Team;
use App\Models\User;

/**
 * @param  array<string, mixed>  $attributes
 */
function p10aGame(array $attributes = []): PokerGame
{
    return PokerGame::factory()
        ->customCards(['1', '2', '3', '5', '8', '?', '☕'])
        ->create(['title' => 'Sprint 12 estimates', ...$attributes]);
}

function p10aTeamMember(Team $team, string $name = 'Ada Facilitator'): User
{
    $user = teamMember($team);

    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @return array{
 *     0: User,
 *     1: PokerPlayer
 * }
 */
function p10aFacilitator(PokerGame $game, string $name = 'Ada Facilitator'): array
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
function p10aMember(PokerGame $game, string $name): array
{
    [$user, $player] = pokerMember($game);

    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return [$user, $player];
}

function p10aTeamPath(Team $team): string
{
    return route('teams.show', [$team->workspace, $team], false);
}

function p10aTaskOrderScript(): string
{
    return 'Array.from(document.querySelectorAll(\'[data-test="poker-task-row"]\')).map(function (row) { return row.querySelector("span span").textContent; }).join(" / ")';
}

function p10aCurrentTaskScript(): string
{
    return 'document.querySelector(\'[data-test="poker-task-row"][aria-current="true"] span span\').textContent';
}

it('[P10a-01] shows the planning poker section under the retrospectives on the team page', function () {
    $team = Team::factory()->create();
    $ada = p10aTeamMember($team);

    $page = $this->signIn($ada, p10aTeamPath($team));

    $page->assertSee('No retrospectives yet.')
        ->assertSee('Planning poker')
        ->assertSee('New game')
        ->assertSee('Estimation history')
        ->assertSee('No games yet.')
        ->assertScript('document.body.innerText.indexOf("No retrospectives yet.") < document.body.innerText.indexOf("Planning poker")', true);
});

it('[P10a-02] creates a game with a custom deck and opens it', function () {
    $team = Team::factory()->create();
    $ada = p10aTeamMember($team);

    $page = $this->signIn($ada, p10aTeamPath($team));

    $page->assertSee('New game')
        ->click('New game')
        ->assertVisible('#new-poker-title')
        ->assertScript('document.querySelector("#new-poker-title").value === "Poker " + new Date().toLocaleDateString("en", { dateStyle: "medium" })', true)
        ->assertCount('[role="radio"]', 5)
        ->assertSee('Fibonacci')
        ->assertSee('Modified Fibonacci')
        ->assertSee('T-shirt sizes')
        ->assertSee('Powers of 2')
        ->assertSee('Custom')
        ->assertScript('Array.from(document.querySelectorAll(\'[role="radio"]\')[0].querySelectorAll("span span")).map(function (chip) { return chip.textContent; }).join(" ")', '0 1 2 3 5 8 13 21 34 55 89 ? ☕')
        ->click('[role="radio"]:has-text("Custom")')
        ->assertVisible('#deck-custom-cards')
        ->fill('#deck-custom-cards', '1, 2, 3, 5, 8')
        ->assertSee('Add ?')
        ->assertSee('Add ☕')
        ->assertAttribute('#deck-include-unknown', 'aria-checked', 'true')
        ->assertAttribute('#deck-include-coffee', 'aria-checked', 'true')
        ->fill('#new-poker-title', 'Sprint 12 estimates')
        ->click('Create game')
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

it('[P10a-03] rejects a custom deck with a repeated card or without an estimate card', function () {
    $team = Team::factory()->create();
    $ada = p10aTeamMember($team);

    $page = $this->signIn($ada, p10aTeamPath($team));

    $page->assertSee('New game')
        ->click('New game')
        ->assertVisible('[role="radio"]:has-text("Custom")')
        ->click('[role="radio"]:has-text("Custom")')
        ->assertVisible('#deck-custom-cards')
        ->fill('#deck-custom-cards', '3,  3')
        ->click('Create game')
        ->assertSee('Each card can appear only once.')
        ->fill('#deck-custom-cards', '?, ☕')
        ->click('Create game')
        ->assertSee('Add at least one card that can be an estimate.')
        ->click('Cancel')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('No games yet.');

    expect(PokerGame::query()->count())->toBe(0);
});
it('[P10a-04a] adds tasks in order and renders their Markdown safely', function () {
    $game = p10aGame();
    [$ada] = p10aFacilitator($game);

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
        ->assertScript(p10aTaskOrderScript(), 'Login page / Password reset / Export invoices');

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

it('[P10a-04b] moves a task to the top with the keyboard and keeps the order after a reload', function () {
    $game = p10aGame();
    [$ada] = p10aFacilitator($game);
    [$bob] = p10aMember($game, 'Bob Member');

    foreach (['Login page', 'Password reset', 'Export invoices'] as $title) {
        PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => $title]);
    }

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertCount('@poker-task-row', 3);

    $this->dragWithKeyboard(
        $facilitator,
        '[data-test="poker-task-row"]:has-text("Export invoices") [aria-label="Drag to reorder"]',
        ['Space', 'ArrowUp', 'ArrowUp', 'Space'],
    );

    $facilitator->assertScript(p10aTaskOrderScript(), 'Export invoices / Login page / Password reset');
    $member->assertScript(p10aTaskOrderScript(), 'Export invoices / Login page / Password reset');

    $facilitator->navigate("/poker/{$game->id}")
        ->assertCount('@poker-task-row', 3)
        ->assertScript(p10aTaskOrderScript(), 'Export invoices / Login page / Password reset');
});

it('[P10a-05] lets the facilitator allow guests and gives a working guest link', function () {
    $game = p10aGame();
    [$ada] = p10aFacilitator($game);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Guest link…')
        ->click('Guest link…')
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

it('[P10a-06] lets a guest join through the link with a restricted view', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $joinUrl = "/poker/join/{$game->guest_token}";

    visit($joinUrl)
        ->assertSee('Sprint 12 estimates')
        ->assertSee('Choose the name other players will see.')
        ->assertSee('Display name')
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
it('[P10a-07a] shows the task picked by the facilitator as current to everyone', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Password reset']);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $facilitator->assertSee('Pick a task to start voting');
    $guest->assertSee('Waiting for the facilitator to pick a task');

    $facilitator->click('Login page')
        ->assertCount('[data-test="poker-task-row"][aria-current="true"]', 1)
        ->assertScript(p10aCurrentTaskScript(), 'Login page')
        ->assertSee('Show votes')
        ->assertButtonDisabled('Show votes');

    $guest->assertCount('[data-test="poker-task-row"][aria-current="true"]', 1)
        ->assertScript(p10aCurrentTaskScript(), 'Login page')
        ->assertVisible('section[aria-labelledby^="poker-task-"]')
        ->assertEnabled('[aria-label="Play 5"]')
        ->assertDontSee('Show votes');
});

it('[P10a-07b] shows a played card face-down and never its value before the reveal', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
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
        ->assertButtonEnabled('Show votes')
        ->assertEnabled('[aria-label="Play 8"]')
        ->click('[aria-label="Play 8"]');

    $guest->assertVisible('[aria-label="Ada Facilitator: Voted"]')
        ->assertSee('Votes: 2')
        ->assertNotPresent('[aria-label="Ada Facilitator: 8"]')
        ->assertDontSeeIn('section[aria-label="Players"]', '8')
        ->assertScript('document.querySelector(\'section[aria-label="Players"]\').innerText.includes("8")', false);
});

it('[P10a-07c] lets a player change, withdraw and replay a card', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
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

it('[P10a-08] reveals both votes with the result to everyone', function () {
    $game = p10aGame();
    [$ada, $adaPlayer] = p10aFacilitator($game);
    [$bob, $bobPlayer] = p10aMember($game, 'Bob Member');
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $round = openPokerRound($game, $task);
    pokerVote($round, $adaPlayer, '8');
    pokerVote($round, $bobPlayer, '3');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertSee('Show votes')
        ->assertButtonEnabled('Show votes')
        ->click('Show votes');

    foreach ([$facilitator, $member] as $page) {
        $page->assertVisible('[aria-label="Ada Facilitator: 8"]')
            ->assertVisible('[aria-label="Bob Member: 3"]')
            ->assertSee('Average')
            ->assertSee('5.5')
            ->assertSee('Nearest card: 5')
            ->assertScript('Array.from(document.querySelectorAll(\'[aria-labelledby="poker-result"] li\')).map(function (row) { return row.querySelectorAll("span")[0].textContent + " x" + row.querySelectorAll("span")[2].textContent; }).join(" / ")', '3 x1 / 8 x1')
            ->assertDontSee('Consensus')
            ->assertDisabled('[aria-label="Play 5"]');
    }
});

it('[P10a-09] re-votes to a consensus and saves the estimate for everyone', function () {
    $game = p10aGame();
    [$ada, $adaPlayer] = p10aFacilitator($game);
    [$bob, $bobPlayer] = p10aMember($game, 'Bob Member');
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
        ->assertSee('Show votes');

    $member->assertVisible('[aria-label="Bob Member: Not voted yet"]')
        ->assertEnabled('[aria-label="Play 5"]');

    $facilitator->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]');
    $member->click('[aria-label="Play 5"]');

    $facilitator->assertVisible('[aria-label="Bob Member: Voted"]')
        ->assertSee('Votes: 2')
        ->assertButtonEnabled('Show votes')
        ->click('Show votes');

    foreach ([$facilitator, $member] as $page) {
        $page->assertSee('Consensus')
            ->assertSee('Nearest card: 5');
    }

    $facilitator->assertVisible('[aria-label="Estimate"]')
        ->assertSeeIn('[aria-label="Estimate"]', '5')
        ->click('Save estimate');

    foreach ([$facilitator, $member] as $page) {
        $page->assertSee('Estimate: 5')
            ->assertScript('Array.from(document.querySelectorAll(\'[data-test="poker-task-row"] [data-slot="badge"]\')).map(function (badge) { return badge.textContent; }).join(" / ")', '5 / Votes: 2');
    }

    $facilitator->assertVisible('button:has-text("Rounds (2)")')
        ->click('button:has-text("Rounds (2)")')
        ->assertSee('Round 2')
        ->assertSee('Round 1')
        ->assertSee('Ada Facilitator: 5')
        ->assertSee('Bob Member: 5')
        ->assertSee('Ada Facilitator: 8')
        ->assertSee('Bob Member: 3')
        ->assertSee('Average: 5.5');

    expect($task->refresh()->estimate)->toBe('5');
});
