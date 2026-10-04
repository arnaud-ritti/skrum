<?php

use App\Events\ActionItems\TeamActionItemDeleted;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

beforeEach(function () {
    Event::fake([TeamActionItemDeleted::class]);
});

it('deletes what the member may delete and refuses the rest', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->withSubtasks(2)->create();
    $someoneElses = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();
    $invisible = ActionItem::factory()->withoutRetro(Team::factory()->create(['workspace_id' => $team->workspace_id]), User::factory()->create())->create();

    $this->actingAs($user)
        ->postJson(route('workspaces.actionItemBulkDeletions.store', $team->workspace), ['ids' => [$mine->id, $someoneElses->id, $invisible->id]])
        ->assertOk()
        ->assertJsonPath('deleted', [$mine->id])
        ->assertJsonPath('refused.0.id', $someoneElses->id)
        ->assertJsonPath('refused.0.message', 'Only the author, the facilitator or an admin can change this action item.')
        ->assertJsonPath('refused.1.message', 'This action item no longer exists.');

    expect(ActionItem::query()->find($mine->id))->toBeNull()
        ->and($someoneElses->fresh())->not->toBeNull()
        ->and($invisible->fresh())->not->toBeNull();
    Event::assertDispatchedTimes(TeamActionItemDeleted::class, 1);
});

it('lets a workspace admin delete any item in bulk', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $ids = ActionItem::factory()->withoutRetro($team, teamMember($team))->count(3)->create()->pluck('id')->all();

    $this->actingAs($admin)
        ->postJson(route('workspaces.actionItemBulkDeletions.store', $team->workspace), ['ids' => $ids])
        ->assertOk()
        ->assertJsonCount(3, 'deleted');

    expect(ActionItem::query()->whereKey($ids)->count())->toBe(0);
});

it('refuses an empty or oversized list', function (array $ids) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->postJson(route('workspaces.actionItemBulkDeletions.store', $team->workspace), ['ids' => $ids])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ids');
})->with([
    'empty' => [[]],
    'too many' => [array_map(fn () => (string) Str::uuid7(), range(1, 51))],
]);

it('keeps guests and other workspaces out', function () {
    $team = Team::factory()->create();
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();
    $route = route('workspaces.actionItemBulkDeletions.store', $team->workspace);

    $this->postJson($route, ['ids' => [$item->id]])->assertUnauthorized();
    $this->actingAs(User::factory()->create())->postJson($route, ['ids' => [$item->id]])->assertForbidden();

    expect($item->fresh())->not->toBeNull();
});
