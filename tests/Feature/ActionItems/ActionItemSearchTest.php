<?php

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Team;
use App\Models\User;

/**
 * @param  array<string, string>  $query
 * @return array<int, string>
 */
function searchedContents(Team $team, User $user, array $query): array
{
    $items = test()->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, ...$query]))
        ->assertOk()
        ->viewData('page')['props']['items']['data'];

    return collect($items)->pluck('content')->sort()->values()->all();
}

it('finds an item by its text in any case, and respects accents', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Write the on-call RUNBOOK']);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Été planning']);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Other']);

    expect(searchedContents($team, $user, ['q' => 'runbook']))->toBe(['Write the on-call RUNBOOK'])
        ->and(searchedContents($team, $user, ['q' => 'ÉTÉ']))->toBe(['Été planning'])
        ->and(searchedContents($team, $user, ['q' => 'ete']))->toBe([]);
});

it('finds an item by its ticket key in any case', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $linked = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Linked']);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Not linked']);
    ActionItemExternalLink::factory()->create(['action_item_id' => $linked->id, 'external_key' => 'PROJ-12']);

    expect(searchedContents($team, $user, ['q' => 'proj-12']))->toBe(['Linked'])
        ->and(searchedContents($team, $user, ['q' => 'PROJ-1']))->toBe(['Linked']);
});

it('combines the search with the other filters and narrows the counters', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'runbook high', 'priority' => ActionItemPriority::High]);
    ActionItem::factory()->withoutRetro($team, $user)->completed()->create(['content' => 'runbook done']);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'other high', 'priority' => ActionItemPriority::High]);

    $counts = $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'q' => 'runbook']))
        ->viewData('page')['props']['counts'];

    expect(searchedContents($team, $user, ['q' => 'runbook', 'priority' => 'high']))->toBe(['runbook high'])
        ->and(searchedContents($team, $user, ['q' => 'runbook', 'status' => 'todo,doing,completed']))->toBe(['runbook done', 'runbook high'])
        ->and($counts)->toBe(['open' => 1, 'overdue' => 0, 'completed' => 1, 'mine' => 0, 'rituals' => 0]);
});

it('gives the search back trimmed and cut, and an empty search as none', function (string $given, ?string $expected) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $filters = $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'q' => $given]))
        ->viewData('page')['props']['filters'];

    expect($filters['q'])->toBe($expected);
})->with([
    'trimmed' => ['  runbook  ', 'runbook'],
    'cut at 100' => [str_repeat('a', 120), str_repeat('a', 100)],
    'blank' => ['   ', null],
]);

it('never searches a team the viewer cannot see, on the page or through "all matching"', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $hidden = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'runbook mine']);
    $theirs = ActionItem::factory()->withoutRetro($hidden, User::factory()->create())->create(['content' => 'runbook theirs']);

    expect(searchedContents($team, $user, ['q' => 'runbook']))->toBe(['runbook mine']);

    $this->actingAs($user)
        ->postJson(route('workspaces.actionItemBulkUpdates.store', $team->workspace), ['filters' => ['q' => 'runbook'], 'count' => 1, 'changes' => ['priority' => 'low']])
        ->assertOk()
        ->assertJsonPath('changedCount', 1);

    expect($mine->fresh()->priority)->toBe(ActionItemPriority::Low)
        ->and($theirs->fresh()->priority)->toBe(ActionItemPriority::Medium);
});

it('exports what the search finds', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'runbook']);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'other']);

    $rows = actionItemCsvRows($this->actingAs($user)->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace, 'q' => 'RUNBOOK'])));

    expect(collect($rows)->skip(1)->pluck(0)->values()->all())->toBe(['runbook']);
});

it('keeps the folded key of a link up to date', function () {
    $link = ActionItemExternalLink::factory()->create(['external_key' => 'ABC-1']);

    expect(ActionItemExternalLink::query()->whereContains('external_key', 'abc-1')->exists())->toBeTrue();

    $link->update(['external_key' => 'XYZ-2']);

    expect(ActionItemExternalLink::query()->whereContains('external_key', 'abc')->exists())->toBeFalse()
        ->and(ActionItemExternalLink::query()->whereContains('external_key', 'xyz-2')->exists())->toBeTrue();
});
