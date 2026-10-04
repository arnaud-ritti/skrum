<?php

use App\Enums\ActionItemPriority;
use App\Events\ActionItems\TeamActionItemDeleted;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake([TeamActionItemSaved::class, TeamActionItemDeleted::class]);
    $this->travelTo(CarbonImmutable::parse('2026-11-02 09:00:00'));
});

/**
 * @param  array<string, mixed>  $body
 */
function postBulkMatching(Team $team, User $user, string $route, array $body): TestResponse
{
    return test()->actingAs($user)->postJson(route($route, $team->workspace), $body);
}

it('changes every visible item the filters match, and only those', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $low = ActionItem::factory()->withoutRetro($team, $user)->count(3)->create(['priority' => ActionItemPriority::Low]);
    $high = ActionItem::factory()->withoutRetro($team, $user)->create(['priority' => ActionItemPriority::High]);
    $elsewhere = ActionItem::factory()->withoutRetro(Team::factory()->create(['workspace_id' => $team->workspace_id]), User::factory()->create())->create(['priority' => ActionItemPriority::Low]);

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => ['priority' => 'low'], 'count' => 3, 'changes' => ['status' => 'doing']])
        ->assertOk()
        ->assertJsonPath('actionItems', [])
        ->assertJsonPath('changedCount', 3)
        ->assertJsonPath('refused', []);

    expect(ActionItem::query()->whereNotNull('started_at')->pluck('id')->sort()->values()->all())->toBe($low->pluck('id')->sort()->values()->all())
        ->and($high->fresh()->started_at)->toBeNull()
        ->and($elsewhere->fresh()->started_at)->toBeNull();
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 3);
});

it('reads empty filters as the landing filters', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->count(2)->create();
    $done = ActionItem::factory()->withoutRetro($team, $user)->completed()->create();

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 2, 'changes' => ['priority' => 'high']])
        ->assertOk()
        ->assertJsonPath('changedCount', 2);

    expect($done->fresh()->priority)->toBe(ActionItemPriority::Medium);
});

it('never reaches a team the member cannot see through the filters', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $hidden = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->create();
    $theirs = ActionItem::factory()->withoutRetro($hidden, User::factory()->create())->create();

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => ['team' => $hidden->id], 'count' => 1, 'changes' => ['priority' => 'low']])
        ->assertOk()
        ->assertJsonPath('changedCount', 1);

    expect($mine->fresh()->priority)->toBe(ActionItemPriority::Low)
        ->and($theirs->fresh()->priority)->toBe(ActionItemPriority::Medium);
});

it('refuses the items the member may not change, with their title, in the order of the list', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $author = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Mine']);
    $later = ActionItem::factory()->withoutRetro($team, $author)->create(['content' => 'Later', 'due_on' => '2026-11-20']);
    $sooner = ActionItem::factory()->withoutRetro($team, $author)->create(['content' => 'Sooner', 'due_on' => '2026-11-10']);

    $response = postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 3, 'changes' => ['priority' => 'low']])
        ->assertOk()
        ->assertJsonPath('changedCount', 1);

    expect($response->json('refused'))->toBe([
        ['id' => $sooner->id, 'title' => 'Sooner', 'message' => 'Only the author, the facilitator or an admin can change this action item.'],
        ['id' => $later->id, 'title' => 'Later', 'message' => 'Only the author, the facilitator or an admin can change this action item.'],
    ]);
});

it('changes nothing when the list changed since the member counted it', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->withoutRetro($team, $user)->count(3)->create();

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 2, 'changes' => ['priority' => 'low']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['count' => 'The list changed: 3 action items match now.']);

    expect(ActionItem::query()->whereKey($items->pluck('id'))->where('priority', 'low')->count())->toBe(0);
    Event::assertNotDispatched(TeamActionItemSaved::class);
});

it('refuses more matching items than the cap, and changes the cap in one request', function () {
    Queue::fake();
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->withoutRetro($team, $user)->count(500)->create();

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 500, 'changes' => ['status' => 'completed']])
        ->assertOk()
        ->assertJsonPath('changedCount', 500);

    ActionItem::factory()->withoutRetro($team, $user)->count(501)->create();

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 500, 'changes' => ['priority' => 'low']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['filters' => 'More than 500 action items match. Narrow the filters.']);

    expect(ActionItem::query()->whereKey($items->pluck('id'))->whereNull('completed_at')->count())->toBe(0)
        ->and(ActionItem::query()->where('priority', 'low')->count())->toBe(0);
});

it('deletes every matching item the member may delete', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $outside = ActionItem::factory()->withoutRetro($team, $user)->count(2)->create();
    $theirs = ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['content' => 'Theirs']);

    $response = postBulkMatching($team, $user, 'workspaces.actionItemBulkDeletions.store', ['filters' => ['source' => 'outside'], 'count' => 3])
        ->assertOk()
        ->assertJsonCount(2, 'deleted')
        ->assertJsonPath('refused.0.title', 'Theirs');

    expect(ActionItem::query()->whereKey($outside->pluck('id'))->count())->toBe(0)
        ->and($theirs->fresh())->not->toBeNull()
        ->and($response->json('refused.0.id'))->toBe($theirs->id);
    Event::assertDispatchedTimes(TeamActionItemDeleted::class, 2);
});

it('refuses a target it cannot read', function (string $route, Closure $body) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();

    postBulkMatching($team, $user, $route, $body($item->id))->assertUnprocessable();

    expect($item->fresh())->not->toBeNull()
        ->and($item->fresh()->priority)->toBe(ActionItemPriority::Medium);
})->with([
    'ids and count' => ['workspaces.actionItemBulkUpdates.store', fn (string $id) => ['ids' => [$id], 'count' => 1, 'changes' => ['priority' => 'low']]],
    'ids and filters' => ['workspaces.actionItemBulkUpdates.store', fn (string $id) => ['ids' => [$id], 'filters' => [], 'changes' => ['priority' => 'low']]],
    'filters without count' => ['workspaces.actionItemBulkUpdates.store', fn (string $id) => ['filters' => ['priority' => 'medium'], 'changes' => ['priority' => 'low']]],
    'count above the cap' => ['workspaces.actionItemBulkUpdates.store', fn (string $id) => ['filters' => [], 'count' => 501, 'changes' => ['priority' => 'low']]],
    'unknown filter' => ['workspaces.actionItemBulkUpdates.store', fn (string $id) => ['filters' => ['item' => $id], 'count' => 1, 'changes' => ['priority' => 'low']]],
    'deletion without count' => ['workspaces.actionItemBulkDeletions.store', fn (string $id) => ['filters' => []]],
    'deletion with ids and count' => ['workspaces.actionItemBulkDeletions.store', fn (string $id) => ['ids' => [$id], 'count' => 1]],
]);

it('keeps other workspaces out of the filters target', function (string $route, array $body) {
    $team = Team::factory()->create();
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();

    postBulkMatching($team, User::factory()->create(), $route, $body)->assertForbidden();

    expect($item->fresh())->not->toBeNull()
        ->and($item->fresh()->priority)->toBe(ActionItemPriority::Medium);
})->with([
    'bulk updates' => ['workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 1, 'changes' => ['priority' => 'low']]],
    'bulk deletions' => ['workspaces.actionItemBulkDeletions.store', ['filters' => [], 'count' => 1]],
]);
