<?php

use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Events\ActionItems\TeamActionItemDeleted;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
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

it('refuses the items of a team the member only observes and the items of a board closed for editing', function () {
    $team = Team::factory()->create();
    $observedTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $user = teamMember($team);
    $observedTeam->members()->attach($user, ['role' => TeamRole::Observer->value]);
    $observed = ActionItem::factory()->withoutRetro($observedTeam, $user)->create();
    $lockedRetro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id, 'is_locked' => true]);
    $participant = Participant::factory()->create(['retro_id' => $lockedRetro->id, 'user_id' => $user->id]);
    $lockedRetro->forceFill(['facilitator_participant_id' => $participant->id])->save();
    $onLockedBoard = ActionItem::factory()->create(['retro_id' => $lockedRetro->id, 'created_by_participant_id' => $participant->id]);

    $response = $this->actingAs($user)
        ->postJson(route('workspaces.actionItemBulkDeletions.store', $team->workspace), ['ids' => [$observed->id, $onLockedBoard->id]])
        ->assertOk()
        ->assertJsonPath('deleted', []);

    expect(collect($response->json('refused'))->pluck('title', 'id')->all())->toBe([
        $observed->id => $observed->content,
        $onLockedBoard->id => $onLockedBoard->content,
    ])
        ->and($response->json('refused.0.message'))->toBe('Only the author, the facilitator or an admin can change this action item.')
        ->and($response->json('refused.1.message'))->toBe('The board is closed for editing.')
        ->and($observed->fresh())->not->toBeNull()
        ->and($onLockedBoard->fresh())->not->toBeNull();
    Event::assertNotDispatched(TeamActionItemDeleted::class);
});

it('reads an item of another workspace of the member as gone', function (string $route, array $body) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $elsewhere = Team::factory()->create();
    $elsewhere->workspace->members()->attach($user, ['role' => 'admin']);
    $elsewhere->members()->attach($user);
    $foreign = ActionItem::factory()->withoutRetro($elsewhere, $user)->create();

    $this->actingAs($user)
        ->postJson(route($route, $team->workspace), ['ids' => [$foreign->id], ...$body])
        ->assertOk()
        ->assertJsonPath('refused.0.id', $foreign->id)
        ->assertJsonPath('refused.0.title', null)
        ->assertJsonPath('refused.0.message', 'This action item no longer exists.');

    expect($foreign->fresh())->not->toBeNull()
        ->and($foreign->fresh()->priority->value)->toBe('medium');
})->with([
    'bulk updates' => ['workspaces.actionItemBulkUpdates.store', ['changes' => ['priority' => 'low']]],
    'bulk deletions' => ['workspaces.actionItemBulkDeletions.store', []],
]);
