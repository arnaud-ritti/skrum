<?php

use App\Enums\ActionItemRecurrence;
use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake([TeamActionItemSaved::class, ActionItemCompleted::class]);
});

/**
 * @param  array<int, string>  $ids
 * @param  array<string, mixed>  $changes
 */
function postBulkUpdate(Team $team, User $user, array $ids, array $changes): TestResponse
{
    return test()->actingAs($user)->postJson(route('workspaces.actionItemBulkUpdates.store', $team->workspace), ['ids' => $ids, 'changes' => $changes]);
}

it('changes every item the member may change, and announces each', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $mate = teamMember($team);
    $items = ActionItem::factory()->withoutRetro($team, $user)->count(3)->create();

    postBulkUpdate($team, $user, $items->pluck('id')->all(), ['priority' => 'high', 'due_on' => '2026-11-02', 'assignee_user_id' => $mate->id])
        ->assertOk()
        ->assertJsonCount(3, 'actionItems')
        ->assertJsonPath('changedCount', 3)
        ->assertJsonPath('refused', [])
        ->assertJsonPath('actionItems.0.priority', 'high')
        ->assertJsonPath('actionItems.0.dueOn', '2026-11-02')
        ->assertJsonPath('actionItems.0.assignee.id', $mate->id);

    expect(ActionItem::query()->whereKey($items->pluck('id'))->where('priority', 'high')->count())->toBe(3);
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 3);
});

it('goes on past an item that fails unexpectedly, and reports it', function () {
    Exceptions::fake();
    $team = Team::factory()->create();
    $user = teamMember($team);
    [$failing, $fine] = ActionItem::factory()->withoutRetro($team, $user)->count(2)->create()->all();
    ActionItem::saving(function (ActionItem $item) use ($failing): void {
        if ($item->id === $failing->id) {
            throw new RuntimeException('Lock timeout');
        }
    });

    postBulkUpdate($team, $user, [$failing->id, $fine->id], ['priority' => 'high'])
        ->assertOk()
        ->assertJsonPath('changedCount', 1)
        ->assertJsonPath('refused.0.id', $failing->id)
        ->assertJsonPath('refused.0.title', $failing->content)
        ->assertJsonPath('refused.0.message', 'This action item could not be changed. Try again.');

    expect($fine->fresh()->priority->value)->toBe('high');
    Exceptions::assertReported(RuntimeException::class);
});

it('completes in bulk, with one next occurrence and one completion per item', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->withoutRetro($team, $user)->recurring(ActionItemRecurrence::Weekly)->count(2)->create();

    postBulkUpdate($team, $user, $items->pluck('id')->all(), ['status' => 'completed'])->assertOk()->assertJsonPath('actionItems.1.status', 'completed');

    expect(ActionItem::query()->whereIn('previous_occurrence_id', $items->pluck('id'))->count())->toBe(2);
    Event::assertDispatchedTimes(ActionItemCompleted::class, 2);
});

it('starts items in bulk', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->withoutRetro($team, $user)->count(2)->create();

    postBulkUpdate($team, $user, $items->pluck('id')->all(), ['status' => 'doing'])->assertOk();

    expect(ActionItem::query()->whereKey($items->pluck('id'))->whereNotNull('started_at')->count())->toBe(2);
});

it('changes what it can and refuses the rest, each with its reason', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $author = teamMember($team);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->create();
    $someoneElses = ActionItem::factory()->withoutRetro($team, $author)->create();
    $recurring = ActionItem::factory()->withoutRetro($team, $user)->recurring(ActionItemRecurrence::Weekly)->create();
    $lockedRetro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id, 'is_locked' => true]);
    $onLockedBoard = ActionItem::factory()->create(['retro_id' => $lockedRetro->id]);
    $invisible = ActionItem::factory()->withoutRetro(Team::factory()->create(['workspace_id' => $team->workspace_id]), User::factory()->create())->create();
    $deleted = ActionItem::factory()->withoutRetro($team, $user)->create();
    $deletedId = $deleted->id;
    $deleted->delete();

    $response = postBulkUpdate($team, $user, [$mine->id, $someoneElses->id, $recurring->id, $onLockedBoard->id, $invisible->id, $deletedId], ['due_on' => null, 'priority' => 'low'])
        ->assertOk()
        ->assertJsonCount(1, 'actionItems')
        ->assertJsonPath('actionItems.0.id', $mine->id)
        ->assertJsonPath('actionItems.0.priority', 'low');

    expect(collect($response->json('refused'))->pluck('message', 'id')->all())->toBe([
        $someoneElses->id => 'Only the author, the facilitator or an admin can change this action item.',
        $recurring->id => 'A recurring action item needs a due date.',
        $onLockedBoard->id => 'The board is closed for editing.',
        $invisible->id => 'This action item no longer exists.',
        $deletedId => 'This action item no longer exists.',
    ]);
    expect(collect($response->json('refused'))->pluck('title', 'id')->all())->toBe([
        $someoneElses->id => $someoneElses->content,
        $recurring->id => $recurring->content,
        $onLockedBoard->id => $onLockedBoard->content,
        $invisible->id => null,
        $deletedId => null,
    ]);
    expect($someoneElses->fresh()->priority->value)->toBe('medium')
        ->and($recurring->fresh()->due_on)->not->toBeNull()
        ->and($recurring->fresh()->priority->value)->toBe('medium');
});

it('refuses an assignee who is not in the item\'s team, item by item', function () {
    $team = Team::factory()->create();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $admin = workspaceManager($team->workspace);
    $mate = teamMember($team);
    $here = ActionItem::factory()->withoutRetro($team, $admin)->create();
    $there = ActionItem::factory()->withoutRetro($other, $admin)->create();

    $response = postBulkUpdate($team, $admin, [$here->id, $there->id], ['assignee_user_id' => $mate->id])->assertOk();

    expect($response->json('actionItems.0.id'))->toBe($here->id)
        ->and($response->json('refused.0.id'))->toBe($there->id)
        ->and($there->fresh()->assignee_user_id)->toBeNull();
});

it('refuses a request it cannot read', function (Closure $body) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();

    $this->actingAs($user)->postJson(route('workspaces.actionItemBulkUpdates.store', $team->workspace), $body($item->id))->assertUnprocessable();

    expect($item->fresh()->priority->value)->toBe('medium');
})->with([
    'no id' => [fn (string $id) => ['ids' => [], 'changes' => ['priority' => 'low']]],
    'too many ids' => [fn (string $id) => ['ids' => [$id, ...array_map(fn () => (string) Str::uuid7(), range(1, 50))], 'changes' => ['priority' => 'low']]],
    'not a uuid' => [fn (string $id) => ['ids' => [$id, 'nope'], 'changes' => ['priority' => 'low']]],
    'no change' => [fn (string $id) => ['ids' => [$id], 'changes' => []]],
    'unknown change' => [fn (string $id) => ['ids' => [$id], 'changes' => ['priority' => 'low', 'content' => 'Renamed']]],
    'bad status' => [fn (string $id) => ['ids' => [$id], 'changes' => ['priority' => 'low', 'status' => 'someday']]],
    'bad date' => [fn (string $id) => ['ids' => [$id], 'changes' => ['priority' => 'low', 'due_on' => '02/11/2026']]],
]);

it('keeps guests and other workspaces out', function () {
    $team = Team::factory()->create();
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();

    $this->postJson(route('workspaces.actionItemBulkUpdates.store', $team->workspace), ['ids' => [$item->id], 'changes' => ['priority' => 'low']])->assertUnauthorized();
    postBulkUpdate($team, User::factory()->create(), [$item->id], ['priority' => 'low'])->assertForbidden();
});

it('refuses each item of a team the member only observes', function () {
    $team = Team::factory()->create();
    $observer = teamMember($team, TeamRole::Observer);
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->assignedTo($observer)->create();

    postBulkUpdate($team, $observer, [$item->id], ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('changedCount', 0)
        ->assertJsonPath('refused.0.id', $item->id)
        ->assertJsonPath('refused.0.message', 'Only the assignee or a manager can complete this action item.');

    expect($item->fresh()->completed_at)->toBeNull();
});

it('allows twenty bulk changes and exports a minute', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $workspace = $team->workspace;
    $unknown = (string) Str::uuid7();

    foreach (range(1, 8) as $attempt) {
        postBulkUpdate($team, $user, [$unknown], ['priority' => 'low'])->assertOk();
        $this->actingAs($user)->postJson(route('workspaces.actionItemBulkDeletions.store', $workspace), ['ids' => [$unknown]])->assertOk();
    }

    foreach (range(1, 4) as $attempt) {
        $this->actingAs($user)->get(route('workspaces.actionItemCsvExports.show', $workspace))->assertOk();
    }

    postBulkUpdate($team, $user, [$unknown], ['priority' => 'low'])->assertTooManyRequests();
    $this->actingAs($user)->postJson(route('workspaces.actionItemBulkDeletions.store', $workspace), ['ids' => [$unknown]])->assertTooManyRequests();
    $this->actingAs($user)->get(route('workspaces.actionItemCsvExports.show', $workspace))->assertTooManyRequests();
});
