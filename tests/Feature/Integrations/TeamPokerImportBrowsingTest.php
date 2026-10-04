<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\TeamRole;
use App\Models\PokerGame;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira);
});

/**
 * @return array{0: Team, 1: TeamIntegration}
 */
function teamBrowseTeam(): array
{
    $team = Team::factory()->create();

    return [$team, TeamIntegration::factory()->jira()->create(['team_id' => $team->id])];
}

/**
 * @return array<string, array{0: string, 1: string, 2: array<string, string>}>
 */
function teamBrowseRequests(Team $team, string $source = 'jira'): array
{
    return [
        'containers' => ['getJson', route('teams.pokerImports.containers.index', [$team->workspace, $team, $source]), []],
        'iterations' => ['getJson', route('teams.pokerImports.iterations.index', [$team->workspace, $team, $source, 'container' => '7']), []],
        'preview' => ['postJson', route('teams.pokerImports.preview.store', [$team->workspace, $team, $source]), ['mode' => 'query', 'query' => 'project = PROJ']],
    ];
}

it('refuses the team browse to a member of another team of the same workspace, to an observer and to a stranger', function (string $who) {
    [$team] = teamBrowseTeam();
    $otherTeam = Team::factory()->for($team->workspace)->create();
    $user = match ($who) {
        'other team' => teamMember($otherTeam),
        'observer' => teamMember($team, TeamRole::Observer),
        'stranger' => User::factory()->create(),
    };

    foreach (teamBrowseRequests($team) as [$method, $url, $payload]) {
        $this->actingAs($user)->{$method}($url, $payload)->assertForbidden();
    }

    Http::assertNothingSent();
})->with(['other team', 'observer', 'stranger']);

it('lets a workspace manager who is not in the team browse its tracker', function () {
    [$team] = teamBrowseTeam();
    fakeJiraTrackerApi();

    $this->actingAs(workspaceManager($team->workspace))
        ->getJson(route('teams.pokerImports.containers.index', [$team->workspace, $team, 'jira']))
        ->assertOk()
        ->assertJsonPath('containers.0.name', 'Sweep scrum board');
});

it('answers 401 to a logged-out request, even one carrying a poker guest cookie', function () {
    [$team] = teamBrowseTeam();
    $game = PokerGame::factory()->for($team)->withGuestAccess()->create();
    $guest = pokerGuest($game);

    foreach (teamBrowseRequests($team) as [$method, $url, $payload]) {
        $this->withCookies(pokerGuestCookie($guest))->withCredentials()->{$method}($url, $payload)->assertUnauthorized();
    }

    Http::assertNothingSent();
});

it('answers 404 for a disabled tracker and 409 for a team without an active connection', function () {
    [$team, $integration] = teamBrowseTeam();
    $member = teamMember($team);
    $containers = fn (string $source): string => route('teams.pokerImports.containers.index', [$team->workspace, $team, $source]);

    $this->actingAs($member)->getJson($containers('linear'))->assertNotFound();

    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);

    $this->actingAs($member)->getJson($containers('linear'))
        ->assertConflict()
        ->assertJsonPath('message', 'Connect Linear in the team settings.');

    $integration->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();

    $this->actingAs($member)->getJson($containers('jira'))
        ->assertConflict()
        ->assertJsonPath('message', 'Reconnect Jira in the team settings.');

    Http::assertNothingSent();
});

it('refuses a preview without a mode, an iteration preview without its iteration and a query preview without its query', function (array $payload, string $field) {
    [$team] = teamBrowseTeam();

    $this->actingAs(teamMember($team))
        ->postJson(route('teams.pokerImports.preview.store', [$team->workspace, $team, 'jira']), $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    Http::assertNothingSent();
})->with([
    'no mode' => [[], 'mode'],
    'unknown mode' => [['mode' => 'board'], 'mode'],
    'iteration without id' => [['mode' => 'iteration'], 'iteration_id'],
    'query without text' => [['mode' => 'query'], 'query'],
]);

it('answers 404 for a team of another workspace', function () {
    [$team] = teamBrowseTeam();
    $otherWorkspaceTeam = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)
        ->getJson(route('teams.pokerImports.containers.index', [$otherWorkspaceTeam->workspace, $team, 'jira']))
        ->assertNotFound();

    Http::assertNothingSent();
});

it('counts the team browse and the game browse against one limit per person', function () {
    [$team] = teamBrowseTeam();
    fakeJiraTrackerApi();
    $game = PokerGame::factory()->for($team)->create();
    [$member] = pokerMember($game);
    [$otherMember] = pokerMember($game);
    $teamUrl = route('teams.pokerImports.containers.index', [$team->workspace, $team, 'jira']);

    foreach (range(1, TrackerBrowseLimit::MaxAttempts) as $attempt) {
        $this->actingAs($member)->getJson($teamUrl)->assertOk();
    }

    $this->actingAs($member)
        ->getJson(route('poker.imports.containers.index', [$game, 'jira']))
        ->assertTooManyRequests()
        ->assertJsonPath('message', 'Too many requests, wait a moment.');

    $this->actingAs($member)->getJson($teamUrl)->assertTooManyRequests();

    $this->actingAs($otherMember)->getJson($teamUrl)->assertOk();
});
