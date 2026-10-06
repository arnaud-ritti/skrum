<?php

use App\Enums\IntegrationProvider;
use App\Enums\PokerRevealReason;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;

/**
 * Ada facilitates "Sprint 44 refinement" of the Atlas team; one task has a saved estimate.
 *
 * @return array{
 *     game: PokerGame,
 *     team: Team,
 *     ada: User,
 *     adaPlayer: PokerPlayer
 * }
 */
function cvpAtlasGame(bool $guestAccess = false): array
{
    $team = Team::factory()->create(['name' => 'Atlas']);
    $game = PokerGame::factory()->for($team)->create(['title' => 'Sprint 44 refinement', 'guest_access_enabled' => $guestAccess]);
    [$ada, $adaPlayer] = pokerFacilitator($game);
    $task = PokerTask::factory()->estimated('5')->create(['poker_game_id' => $game->id, 'title' => 'Checkout flow']);
    $round = openPokerRound($game, $task);
    pokerVote($round, $adaPlayer, '5');
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();

    return [
        'game' => $game,
        'team' => $team,
        'ada' => renamedUser($ada, 'Ada'),
        'adaPlayer' => $adaPlayer,
    ];
}

function cvpTeamPath(Team $team, string $page): string
{
    return route($page, [$team->workspace, $team], false);
}

function cvpWorkspaceMemberOutsideTeam(Team $team, string $name): User
{
    $user = renamedUser(User::factory()->create(), $name);
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);

    return $user;
}

/**
 * @param  array<int, array<string, mixed>>  $issuesAtCreation  the answer of Jira to the search of the chosen ids, or null for an outage
 */
function cvpFakeJiraForCreation(?array $issuesAtCreation): void
{
    $sprintIssues = [
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page']),
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => 'Payment retries']),
    ];

    $creationAnswer = $issuesAtCreation === null
        ? Http::response(['errorMessages' => ['Jira is down for maintenance.']], 503)
        : Http::response(['issues' => $issuesAtCreation, 'isLast' => true]);

    Http::fake([
        jiraApiUrl('rest/agile/1.0/board/*/sprint*') => Http::response(['values' => [
            ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active'],
        ]]),
        jiraApiUrl('rest/agile/1.0/board*') => Http::response([
            'values' => [['id' => 7, 'name' => 'Web team board']],
            'isLast' => true,
        ]),
        jiraApiUrl('rest/api/3/search/jql') => Http::sequence()
            ->push(['issues' => $sprintIssues, 'isLast' => true])
            ->pushResponse($creationAnswer),
        jiraApiUrl('rest/api/3/issue/*/editmeta') => Http::response(['fields' => []]),
        'api.atlassian.com/*' => Http::response(['errorMessages' => ['Unexpected request in a browser test.']], 404),
    ]);
}

function cvpPickSprintIssues(mixed $page): mixed
{
    return $page->assertVisible('#new-poker-title')
        ->fill('#new-poker-title', 'Imported refinement')
        ->click('[role="dialog"] [role="tab"]:has-text("Import from Jira")')
        ->click('[aria-label="Choose a board"]')
        ->click('[role="option"]:has-text("Web team board")')
        ->click('[aria-label="Choose a sprint"]')
        ->click('[role="option"]:has-text("Sprint 31")')
        ->click('Show issues')
        ->assertSeeIn('[role="dialog"] li:has-text("PROJ-2")', 'Payment retries');
}

it('refuses the poker room to a workspace member of another team with the team block, and to a stranger with a plain 403', function () {
    ['game' => $game] = cvpAtlasGame();
    $nadia = cvpWorkspaceMemberOutsideTeam($game->team, 'Nadia Haddad');
    $olga = renamedUser(User::factory()->create(), 'Olga Outsider');

    $this->signIn($nadia, "/poker/{$game->id}")
        ->assertPresent('[data-slot="error-page"][data-status="403"] [data-slot="access-request"]')
        ->assertSee("You don't have access to this team")
        ->assertNotPresent('[data-realtime]')
        ->assertDontSee('Sprint 44 refinement');

    $this->signIn($olga, "/poker/{$game->id}")
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-slot="access-request"]')
        ->assertDontSee('Atlas')
        ->assertDontSee('Sprint 44 refinement')
        ->assertNoJavaScriptErrors();

    expect($game->players()->whereIn('user_id', [$nadia->id, $olga->id])->count())->toBe(0);
});

it('sends a visitor to the login for a game without guests, and explains both ways back for a game open to guests', function () {
    ['game' => $closedGame] = cvpAtlasGame();
    ['game' => $openGame] = cvpAtlasGame(guestAccess: true);

    visit("/poker/{$closedGame->id}")->assertPathIs('/login');

    visit("/poker/{$openGame->id}")
        ->assertSee('Your session has ended.')
        ->assertSee('Guests: ask the facilitator for the guest link.')
        ->assertDontSee('Sprint 44 refinement');
});

it('opens the room to an observer as a watcher who sees the notice, has no hand, and loses an unrevealed vote', function () {
    ['game' => $game] = cvpAtlasGame();
    [$olivia, $oliviaPlayer] = pokerMember($game);
    renamedUser($olivia, 'Olivia');
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Refund mail']);
    $round = openPokerRound($game, $task);
    pokerVote($round, $oliviaPlayer, '8');
    $game->forceFill(['current_task_id' => $task->id])->save();
    $game->team->members()->updateExistingPivot($olivia->id, ['role' => TeamRole::Observer->value]);

    $page = $this->awaitRealtime($this->signIn($olivia, "/poker/{$game->id}"));

    $page->assertSeeIn('[data-slot="observer-notice"]', 'You are observing this session.')
        ->assertSee('Sprint 44 refinement')
        ->assertNotPresent('[role="group"][aria-label="Your cards"]')
        ->assertNoJavaScriptErrors();

    expect($oliviaPlayer->fresh()->is_spectator)->toBeTrue()
        ->and($round->votes()->where('poker_player_id', $oliviaPlayer->id)->exists())->toBeFalse();
});

it('takes a signed-in member who follows the guest link straight into the game as themself', function () {
    ['game' => $game, 'team' => $team] = cvpAtlasGame(guestAccess: true);
    $bob = renamedUser(teamMember($team), 'Bob');

    $this->signIn($bob, "/poker/join/{$game->guest_token}")
        ->assertPathIs("/poker/{$game->id}")
        ->assertNotPresent('#name')
        ->assertSee('Sprint 44 refinement');

    expect($game->players()->where('user_id', $bob->id)->count())->toBe(1)
        ->and($game->players()->whereNotNull('guest_name')->count())->toBe(0);
});

it('shows a guest at the poker join page the colour of the facilitator online as taken and keeps the free colour they pick', function () {
    ['game' => $game, 'ada' => $ada] = cvpAtlasGame(guestAccess: true);
    $ada->forceFill(['presence_color' => 9])->save();

    $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $guest = visit("/poker/join/{$game->guest_token}");

    $guest->assertPresent('[data-slot="guest-join"] [role="radio"][aria-label="Colour 9 (taken)"][aria-disabled="true"]')
        ->fill('#name', 'Gus Guest')
        ->click('[data-slot="guest-join"] [role="radio"][aria-label="Colour 7"]')
        ->assertAttribute('[data-slot="guest-join"] [role="radio"][aria-label="Colour 7"]', 'aria-checked', 'true')
        ->click('Join the session')
        ->assertPathIs("/poker/{$game->id}");

    $this->awaitRealtime($guest);

    expect($game->players()->where('guest_name', 'Gus Guest')->value('presence_color'))->toBe(7);
});

it('shows the estimation history to a member and to an observer, and refuses it to another team, a visitor and a guest of the game', function () {
    ['game' => $game, 'team' => $team, 'ada' => $ada] = cvpAtlasGame(guestAccess: true);
    $observer = renamedUser(teamMember($team, TeamRole::Observer), 'Otto');
    $nadia = cvpWorkspaceMemberOutsideTeam($team, 'Nadia Haddad');
    $path = cvpTeamPath($team, 'teams.estimates.index');

    foreach ([$ada, $observer] as $viewer) {
        $this->signIn($viewer, $path)
            ->assertSeeIn('[data-slot="estimation-history"] h2', 'Estimation history')
            ->assertSeeIn('[data-slot="estimate-row"]', 'Checkout flow')
            ->assertSeeIn('[data-slot="estimate-row"] [data-slot="estimate-value"]', '5');
    }

    $this->signIn($nadia, $path)
        ->assertPresent('[data-slot="error-page"][data-status="403"] [data-slot="access-request"]')
        ->assertNotPresent('[data-slot="estimation-history"]');

    visit($path)->assertPathIs('/login');

    $this->joinAsGuest("/poker/join/{$game->guest_token}", 'Gus Guest')
        ->navigate($path)
        ->assertPathIs('/login');
});

it('shows the saved decks to a member who may create one and read-only to an observer, and refuses them to another team and a visitor', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $member = renamedUser(teamMember($team), 'Bob');
    $observer = renamedUser(teamMember($team, TeamRole::Observer), 'Otto');
    $nadia = cvpWorkspaceMemberOutsideTeam($team, 'Nadia Haddad');
    SavedPokerDeck::factory()->for($team)->create(['name' => 'Hours', 'cards' => ['1', '2', '4', '8', '?']]);
    $path = cvpTeamPath($team, 'teams.pokerDecks.index');

    $this->signIn($member, $path)
        ->assertSeeIn('[data-slot="saved-decks-grid"]', 'Hours')
        ->assertPresent('[data-slot="saved-decks-page"] button:has-text("New deck")');

    $this->signIn($observer, $path)
        ->assertSeeIn('[data-slot="saved-decks-grid"]', 'Hours')
        ->assertNotPresent('[data-slot="saved-decks-page"] button:has-text("New deck")')
        ->assertNotPresent('[data-slot="deck-create"]');

    $this->signIn($nadia, $path)
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-slot="saved-decks-page"]');

    visit($path)->assertPathIs('/login');
});

it('opens a game created from Jira tickets with the one the source still returns, and says how many were skipped', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $alice = renamedUser(teamMember($team), 'Alice');
    cvpFakeJiraForCreation([jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page'])]);

    $page = cvpPickSprintIssues($this->signIn($alice, cvpTeamPath($team, 'teams.show').'?new=poker'));

    $page->click('Create & open')
        ->assertPathBeginsWith('/poker/')
        ->assertSee('1 ticket imported, 1 skipped.')
        ->assertCount('@poker-task-row', 1)
        ->assertSeeIn('[data-test="poker-task-row"]', 'Checkout page');

    expect(PokerGame::query()->where('title', 'Imported refinement')->sole()->tasks()->pluck('external_key')->all())->toBe(['PROJ-1']);
});

it('creates no game when Jira fails while the game is created, and says so on the import tab', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $alice = renamedUser(teamMember($team), 'Alice');
    cvpFakeJiraForCreation(null);

    $page = cvpPickSprintIssues($this->signIn($alice, cvpTeamPath($team, 'teams.show').'?new=poker'));

    $page->click('Create & open')
        ->assertPresent('[role="dialog"] [role="tabpanel"] [role="alert"]')
        ->assertPathIs(cvpTeamPath($team, 'teams.show'))
        ->assertVisible('#new-poker-title');

    expect(PokerGame::query()->where('title', 'Imported refinement')->exists())->toBeFalse();
});
