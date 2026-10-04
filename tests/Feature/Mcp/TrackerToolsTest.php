<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\McpScope;
use App\Enums\PokerDeck;
use App\Enums\TeamRole;
use App\Jobs\SyncTaskEstimate;
use App\Mcp\Tools\Poker\ImportTasks;
use App\Mcp\Tools\Poker\ListIterations;
use App\Mcp\Tools\Poker\ListSources;
use App\Mcp\Tools\Poker\SyncTask;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Http::preventStrayRequests());

/**
 * @return array{0: Team, 1: User}
 */
function trackerMcpTeam(): array
{
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    return [$team, $user];
}

it('offers the tracker tools only when a visible team has an active tracker', function () {
    $trackerTools = ['poker.game.task.sync', 'poker.game.tasks.import', 'poker.iterations.list', 'poker.sources.list'];
    $team = Team::factory()->create();
    $user = teamMember($team);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $listed = fn (array $scopes = [McpScope::Read, McpScope::Write]) => array_values(array_intersect(mcpToolNames(actingAsMcp($user, $scopes)), $trackerTools));

    expect($listed())->toBeEmpty();

    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Slack);

    expect($listed())->toBe($trackerTools)
        ->and($listed([McpScope::Read]))->toBe(['poker.iterations.list', 'poker.sources.list']);

    $integration->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();
    TeamIntegration::factory()->jira()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);

    expect($listed())->toBeEmpty();

    actingAsMcp($user)->tool(ListSources::class, ['team_id' => $team->id])->assertHasErrors(['Tool [poker.sources.list] not found.']);
});

it('lists the team trackers with their capabilities and nothing secret', function () {
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::Slack);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $team->id]);
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);

    $response = actingAsMcp($user)->tool(ListSources::class, ['team_id' => $team->id])->assertOk();

    expect(mcpStructured($response)['items'])->toBe([
        ['source' => 'jira', 'siteName' => 'Acme', 'status' => 'active', 'access' => 'write', 'canImport' => true, 'canWriteBack' => true, 'writeBackUnavailableReason' => null, 'canSyncStatus' => false, 'syncMode' => 'off', 'estimateFields' => [['id' => 'customfield_10016', 'name' => 'Story point estimate']], 'defaultEstimateFieldId' => 'customfield_10016'],
        ['source' => 'linear', 'siteName' => 'Acme', 'status' => 'active', 'access' => 'read', 'canImport' => true, 'canWriteBack' => false, 'writeBackUnavailableReason' => 'This Linear connection is read-only.', 'canSyncStatus' => false, 'syncMode' => 'off', 'estimateFields' => [], 'defaultEstimateFieldId' => null],
    ]);
    $response->assertDontSee(['jira-access', 'jira-refresh', 'linear-access', 'hooks.slack.com']);
});

it('explains why estimates cannot be written back', function () {
    [$team, $user] = trackerMcpTeam();
    $team->integrations()->sole()->forceFill(['settings' => ['cloudId' => 'cloud-1', 'siteName' => 'Acme', 'storyPointFields' => []]])->save();

    $items = mcpStructured(actingAsMcp($user)->tool(ListSources::class, ['team_id' => $team->id])->assertOk())['items'];

    expect($items[0])->toMatchArray(['canImport' => true, 'canWriteBack' => false, 'writeBackUnavailableReason' => 'No story points field found.']);
});

it('answers an empty list or an error for a team without a connected tracker', function () {
    [$team, $user] = trackerMcpTeam();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $other->members()->attach($user);

    expect(mcpStructured(actingAsMcp($user)->tool(ListSources::class, ['team_id' => $other->id])->assertOk())['items'])->toBe([]);

    actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $other->id, 'source' => 'jira'])
        ->assertHasErrors(['This team has no connected tracker.']);

    Http::assertNothingSent();
});

it('lists containers, then the iterations of one', function () {
    [$team, $user] = trackerMcpTeam();
    fakeJiraTrackerApi();

    expect(mcpStructured(actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'jira'])->assertOk()))
        ->toBe(['containers' => [['id' => '7', 'name' => 'Sweep scrum board']], 'iterations' => []])
        ->and(mcpStructured(actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'jira', 'container_id' => '7'])->assertOk()))->toBe(['containers' => null, 'iterations' => [['id' => '31', 'name' => 'Sprint 31', 'state' => 'active', 'startsOn' => null, 'endsOn' => null]]]);
});

it('turns tracker failures into tool errors', function () {
    [$team, $user] = trackerMcpTeam();
    Http::fake(['api.atlassian.com/*' => Http::response([], 503)]);

    actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'jira'])
        ->assertHasErrors(['Jira did not respond. Try again later.']);
});

it('asks to reconnect without quoting the provider error', function () {
    [$team, $user] = trackerMcpTeam();
    Http::fake([
        'api.atlassian.com/*' => Http::response(['message' => 'Unauthorized'], 401),
        'auth.atlassian.com/*' => Http::response(['error' => 'invalid_grant', 'error_description' => 'refresh token revoked'], 400),
    ]);

    actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'jira'])
        ->assertHasErrors(['Reconnect Jira in the team settings.'])
        ->assertDontSee(['Unauthorized', 'refresh token revoked']);
});

it('imports a whole sprint or query, skipping existing issues', function () {
    [$team, $user] = trackerMcpTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    importedPokerTask($game, ['external_id' => '10001', 'external_key' => 'PROJ-1']);
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::response([
        'issues' => [jiraTrackerIssue('10001', 'PROJ-1'), jiraTrackerIssue('10002', 'PROJ-2')],
        'nextPageToken' => 'more',
    ])]);

    expect(mcpStructured(mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira', 'iteration_id' => '31'])->assertOk()))
        ->toBe(['imported' => 1, 'skipped' => 1, 'truncated' => true])
        ->and($game->tasks()->where('external_key', 'PROJ-2')->exists())->toBeTrue();

    Http::assertSent(fn (Request $request) => $request['jql'] === 'sprint = 31 ORDER BY Rank ASC');

    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira'])->assertHasErrors();
    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira', 'iteration_id' => '31', 'query' => 'project = PROJ'])->assertHasErrors();
});

it('imports by query when the iteration id is an empty string', function () {
    [$team, $user] = trackerMcpTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::response(['issues' => [jiraTrackerIssue('10002', 'PROJ-2')]])]);

    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira', 'iteration_id' => '', 'query' => 'project = PROJ'])->assertOk();

    Http::assertSent(fn (Request $request) => str_contains((string) $request['jql'], 'project = PROJ'));
});

it('refuses to browse the tracker for an observer', function () {
    [$team] = trackerMcpTeam();
    $observer = teamMember($team, TeamRole::Observer);
    fakeJiraTrackerApi();

    actingAsMcp($observer)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'jira'])
        ->assertHasErrors(['Observers can follow this session but not take part.']);

    Http::assertNothingSent();
});

it('keeps the 200-task limit and surfaces JQL errors when importing', function () {
    [$team, $user] = trackerMcpTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    PokerTask::factory()->count(199)->create(['poker_game_id' => $game->id]);
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::sequence()
        ->push(['issues' => [jiraTrackerIssue('10001', 'PROJ-1'), jiraTrackerIssue('10002', 'PROJ-2')]])
        ->push(['errorMessages' => ['The JQL query is invalid.']], 400)]);

    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira', 'query' => 'project = PROJ'])
        ->assertHasErrors(['This game can hold 200 tasks at most.']);
    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira', 'query' => 'project ='])
        ->assertHasErrors(['The JQL query is invalid.']);

    expect($game->tasks()->count())->toBe(199);
});

it('forces or retries a write-back for the facilitator only', function () {
    Queue::fake();
    [$team, $user] = trackerMcpTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $player = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);
    $game->forceFill(['facilitator_player_id' => $player->id])->save();
    $synced = importedPokerTask($game, ['estimate' => '5', 'estimate_numeric' => 5, 'synced_at' => now()]);
    $failed = importedPokerTask($game, ['estimate' => '3', 'estimate_numeric' => 3, 'needs_sync' => true, 'sync_error' => 'Boom']);
    $bare = importedPokerTask($game);

    expect(mcpStructured(mcpWriter($user)->tool(SyncTask::class, ['task_id' => $synced->id])->assertOk()))->toBe(['syncState' => 'pending'])
        ->and(mcpStructured(mcpWriter($user)->tool(SyncTask::class, ['task_id' => $failed->id])->assertOk()))->toBe(['syncState' => 'pending'])
        ->and($synced->fresh()?->needs_sync)->toBeTrue()
        ->and($failed->fresh()?->sync_error)->toBeNull();

    mcpWriter($user)->tool(SyncTask::class, ['task_id' => $bare->id])->assertHasErrors(['Set an estimate before syncing it.']);
    mcpWriter(teamMember($team))->tool(SyncTask::class, ['task_id' => $synced->id])->assertHasErrors(['Only the facilitator can do this.']);
    mcpWriter(User::factory()->create())->tool(SyncTask::class, ['task_id' => $synced->id])->assertHasErrors();

    Queue::assertPushed(SyncTaskEstimate::class, 2);
});

it('lists Jira Data Center and GitHub sources and never chat channels', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub, IntegrationProvider::MicrosoftTeams);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create(['team_id' => $team->id]);
    TeamIntegration::factory()->gitHub(IntegrationAccess::Read)->create(['team_id' => $team->id]);
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);

    $response = actingAsMcp($user)->tool(ListSources::class, ['team_id' => $team->id])->assertOk();

    expect(mcpStructured($response)['items'])->toBe([
        ['source' => 'jira_dc', 'siteName' => 'Acme Jira', 'status' => 'active', 'access' => 'write', 'canImport' => true, 'canWriteBack' => true, 'writeBackUnavailableReason' => null, 'canSyncStatus' => false, 'syncMode' => 'off', 'estimateFields' => [['id' => 'customfield_10002', 'name' => 'Story Points']], 'defaultEstimateFieldId' => 'customfield_10002'],
        ['source' => 'github', 'siteName' => 'acme', 'status' => 'active', 'access' => 'read', 'canImport' => true, 'canWriteBack' => false, 'writeBackUnavailableReason' => 'This GitHub connection is read-only.', 'canSyncStatus' => false, 'syncMode' => 'off', 'estimateFields' => [], 'defaultEstimateFieldId' => null],
    ]);
    $response->assertDontSee([TeamIntegrationFactory::JiraDataCenterToken, 'logic.azure.com']);
});

it('reports status sync from the connection', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $team = Team::factory()->create();
    $user = teamMember($team);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true], 'inbound_mode' => IntegrationInboundMode::Polling])->save();

    expect(mcpStructured(actingAsMcp($user)->tool(ListSources::class, ['team_id' => $team->id])->assertOk())['items'][0])
        ->toMatchArray(['canWriteBack' => true, 'canSyncStatus' => true, 'syncMode' => 'polling']);
});

it('lists GitHub repositories and milestones', function () {
    $this->travelTo(Date::parse('2026-10-07 12:00:00'));
    enableIntegrations(IntegrationProvider::GitHub);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);
    fakeGitHubTrackerApi();

    expect(mcpStructured(actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'github'])->assertOk())['containers'])
        ->toBe([['id' => '9001', 'name' => 'acme/api'], ['id' => '9002', 'name' => 'acme/web']])
        ->and(mcpStructured(actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'github', 'container_id' => '9001'])->assertOk())['iterations'][1])->toBe(['id' => '9001/2', 'name' => 'Sprint 2', 'state' => 'active', 'startsOn' => null, 'endsOn' => '2026-10-10']);
});

it('requires a repository for GitHub queries', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    fakeGitHubTrackerApi();

    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'github', 'query' => 'login'])->assertHasErrors();

    expect(mcpStructured(mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'github', 'query' => 'login', 'container_id' => '9001'])->assertOk()))
        ->toBe(['imported' => 1, 'skipped' => 0, 'truncated' => false])
        ->and($game->tasks()->where('external_key', 'acme/api#7')->exists())->toBeTrue();
});

it('queues the block write of a GitHub task for the facilitator', function () {
    Queue::fake();
    enableIntegrations(IntegrationProvider::GitHub);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->deck(PokerDeck::Tshirt)->create(['team_id' => $team->id]);
    $player = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);
    $game->forceFill(['facilitator_player_id' => $player->id])->save();
    $task = importedPokerTask($game, ['estimate' => 'XL', 'synced_at' => now()], IntegrationProvider::GitHub);

    expect(mcpStructured(mcpWriter($user)->tool(SyncTask::class, ['task_id' => $task->id])->assertOk()))->toBe(['syncState' => 'pending']);

    Queue::assertPushed(SyncTaskEstimate::class, fn (SyncTaskEstimate $job) => $job->taskId === $task->id);
});
