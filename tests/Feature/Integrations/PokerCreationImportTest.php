<?php

use App\Enums\IntegrationProvider;
use App\Models\PokerGame;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira);
});

/**
 * @return array{0: Team, 1: TeamIntegration, 2: User}
 */
function importTeam(): array
{
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    return [$team, $integration, teamMember($team)];
}

it('creates the game with the chosen tickets in the source order', function () {
    [$team, , $member] = importTeam();
    fakeJiraTrackerApi([
        jiraTrackerIssue('10002', 'PROJ-2', ['labels' => ['csv']]),
        jiraTrackerIssue('10001', 'PROJ-1'),
    ]);

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 44 refinement', 'deck' => 'fibonacci',
            'import_source' => 'jira', 'import_ids' => ['10002', '10001', '10404'],
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('inertia.flash_data.toast.message', '2 tickets imported, 1 skipped.');

    $game = PokerGame::query()->sole();

    expect($game->tasks()->orderBy('position')->pluck('external_key')->all())->toBe(['PROJ-2', 'PROJ-1'])
        ->and($game->tasks()->where('external_key', 'PROJ-2')->sole()->external_labels)->toBe(['csv']);
});

it('counts one imported ticket in the singular', function () {
    [$team, , $member] = importTeam();
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1')]);

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 44 refinement', 'deck' => 'fibonacci',
            'import_source' => 'jira', 'import_ids' => ['10001', '10404'],
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('inertia.flash_data.toast.message', '1 ticket imported, 1 skipped.');
});

it('creates nothing when the tracker fails', function () {
    [$team, , $member] = importTeam();
    Http::fake(['api.atlassian.com/*' => Http::response(['errorMessages' => ['boom']], 500)]);

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'P', 'deck' => 'fibonacci', 'import_source' => 'jira', 'import_ids' => ['10001'],
        ])
        ->assertSessionHasErrors('import_ids');

    expect(PokerGame::query()->count())->toBe(0);
});

it('refuses an import with typed tasks, and an import without a connection', function () {
    [$team, , $member] = importTeam();

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'P', 'deck' => 'fibonacci', 'import_source' => 'jira', 'import_ids' => ['1'], 'tasks' => ['Typed'],
        ])
        ->assertSessionHasErrors('import_ids');

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'P', 'deck' => 'fibonacci', 'import_source' => 'linear', 'import_ids' => ['1'],
        ])
        ->assertNotFound();

    $unconnectedTeam = Team::factory()->create();

    $this->actingAs(teamMember($unconnectedTeam))
        ->post(route('teams.pokerGames.store', [$unconnectedTeam->workspace, $unconnectedTeam]), [
            'title' => 'P', 'deck' => 'fibonacci', 'import_source' => 'jira', 'import_ids' => ['1'],
        ])
        ->assertSessionHasErrors('import_ids');

    expect(PokerGame::query()->count())->toBe(0);
});

it('browses the tracker from the team, as from a game', function () {
    [$team, , $member] = importTeam();
    fakeJiraTrackerApi();

    $this->actingAs($member)
        ->getJson(route('teams.pokerImports.containers.index', [$team->workspace, $team, 'jira']))
        ->assertOk()
        ->assertJsonPath('containers.0.name', 'Sweep scrum board');

    $this->actingAs($member)
        ->getJson(route('teams.pokerImports.iterations.index', [$team->workspace, $team, 'jira', 'container' => '7']))
        ->assertOk()
        ->assertJsonPath('0.name', 'Sprint 31');

    $this->actingAs($member)
        ->postJson(route('teams.pokerImports.preview.store', [$team->workspace, $team, 'jira']), ['mode' => 'query', 'query' => 'project = PROJ'])
        ->assertOk()
        ->assertJsonPath('issues.0.key', 'PROJ-1')
        ->assertJsonPath('issues.0.alreadyImported', false);

    $this->actingAs(User::factory()->create())
        ->getJson(route('teams.pokerImports.containers.index', [$team->workspace, $team, 'jira']))
        ->assertForbidden();
});

it('refuses an import list that is empty, too long, repeated, or sent without a known source', function (array $payload, string $field) {
    [$team, , $member] = importTeam();

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), ['title' => 'P', 'deck' => 'fibonacci', ...$payload])
        ->assertSessionHasErrors($field);

    expect(PokerGame::query()->count())->toBe(0);
    Http::assertNothingSent();
})->with([
    'empty list' => [['import_source' => 'jira', 'import_ids' => []], 'import_ids'],
    'a hundred and one ids' => [['import_source' => 'jira', 'import_ids' => array_map(fn (int $id): string => (string) $id, range(1, 101))], 'import_ids'],
    'repeated id' => [['import_source' => 'jira', 'import_ids' => ['10001', '10001']], 'import_ids.1'],
    'id too long' => [['import_source' => 'jira', 'import_ids' => [str_repeat('9', 101)]], 'import_ids.0'],
    'no source' => [['import_ids' => ['10001']], 'import_source'],
    'unknown source' => [['import_source' => 'trello', 'import_ids' => ['10001']], 'import_source'],
]);

it('refuses an import at creation to a member of another team of the workspace', function () {
    [$team] = importTeam();
    $otherTeam = Team::factory()->for($team->workspace)->create();

    $this->actingAs(teamMember($otherTeam))
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'P', 'deck' => 'fibonacci', 'import_source' => 'jira', 'import_ids' => ['10001'],
        ])
        ->assertForbidden();

    expect(PokerGame::query()->count())->toBe(0);
    Http::assertNothingSent();
});
