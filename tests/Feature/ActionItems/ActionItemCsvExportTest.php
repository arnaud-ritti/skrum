<?php

use App\Enums\ActionItemPriority;
use App\Enums\IntegrationProvider;
use App\Enums\TeamRole;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 12:00:00'));
});

it('exports every matching item of every page, in the order of the list, with its columns', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $user = teamMember($team);
    $retro = Retro::factory()->create(['team_id' => $team->id, 'title' => 'Sprint 42']);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Carol']);
    $late = ActionItem::factory()->assignedToGuest($guest)->create([
        'content' => 'Fix the flaky test',
        'priority' => ActionItemPriority::High,
        'due_on' => '2026-10-08',
        'created_at' => '2026-10-01 09:00:00',
    ]);
    ActionItemExternalLink::factory()->create(['action_item_id' => $late->id, 'source' => IntegrationProvider::Jira, 'external_key' => 'PROJ-12']);
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->started()->create([
        'content' => 'Write the runbook',
        'created_at' => '2026-10-02 09:00:00',
    ]);
    ActionItem::factory()->withoutRetro($team, $user)->count(55)->create();

    $response = $this->actingAs($user)
        ->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace]))
        ->assertOk()
        ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')
        ->assertDownload("action-items-{$team->workspace->slug}-2026-10-10.csv");

    $rows = actionItemCsvRows($response);

    expect($rows[0])->toBe(['Action', 'Status', 'Team', 'Assignee', 'Priority', 'Due date', 'Source', 'Created', 'Completed', 'Tickets', 'Link'])
        ->and($rows)->toHaveCount(58)
        ->and(array_slice($rows[1], 0, 10))->toBe(['Fix the flaky test', 'To do', 'Platform', 'Carol (guest)', 'High', '2026-10-08', 'Sprint 42', '2026-10-01', '', 'PROJ-12'])
        ->and($rows[1][10])->toBe(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'item' => $late->id]))
        ->and(collect($rows)->firstWhere(0, 'Write the runbook'))->toMatchArray([1 => 'In progress', 3 => $user->name, 6 => 'Added outside a retro']);
});

it('follows the filters of the page and the viewer\'s visibility', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'open one']);
    ActionItem::factory()->withoutRetro($team, $user)->completed()->create(['content' => 'done one']);
    ActionItem::factory()->withoutRetro(Team::factory()->create(['workspace_id' => $team->workspace_id]), User::factory()->create())->create(['content' => 'hidden']);

    $contents = fn (array $query) => collect(actionItemCsvRows($this->actingAs($user)->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace, ...$query]))))->skip(1)->pluck(0)->sort()->values()->all();

    expect($contents([]))->toBe(['open one'])
        ->and($contents(['status' => 'completed']))->toBe(['done one'])
        ->and($contents(['status' => 'all']))->toBe(['done one', 'open one']);
});

it('neutralises formulas', function (string $text) {
    $team = Team::factory()->create(['name' => '=cmd|calc']);
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => $text]);

    $row = actionItemCsvRows($this->actingAs($user)->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace])))[1];

    expect($row[0])->toBe("'{$text}")->and($row[2])->toBe("'=cmd|calc");
})->with(['=HYPERLINK("http://x")', '+1', '-1', '@SUM(A1)']);

it('writes the header in the viewer\'s language', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $user->update(['locale' => 'fr']);
    ActionItem::factory()->withoutRetro($team, $user)->started()->create();

    $rows = actionItemCsvRows($this->actingAs($user)->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace])));

    expect($rows[0][1])->toBe('Statut')->and($rows[1][1])->toBe('En cours');
});

it('keeps people outside the workspace out', function () {
    $team = Team::factory()->create();

    $this->actingAs(User::factory()->create())->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace]))->assertForbidden();
});

it('sends a visitor who is not signed in to the login page', function () {
    $team = Team::factory()->create();

    $this->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace]))->assertRedirect(route('login'));
});

it('exports the items of a team the member only observes', function () {
    $team = Team::factory()->create();
    $observer = teamMember($team, TeamRole::Observer);
    ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['content' => 'Rotate the keys']);

    $rows = actionItemCsvRows($this->actingAs($observer)->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace])));

    expect(array_column(array_slice($rows, 1), 0))->toBe(['Rotate the keys']);
});
