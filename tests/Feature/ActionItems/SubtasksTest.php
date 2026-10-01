<?php

use App\Enums\RetroPhase;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Retro, 1: ActionItem, 2: User}
 */
function subtaskBoardItem(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    return [$retro, $item, $user];
}

it('adds, edits, reorders, checks and deletes sub-tasks on the board', function () {
    [$retro, $item, $user] = subtaskBoardItem();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00'));

    foreach (['Draft', 'Review', 'Ship'] as $content) {
        $this->actingAs($user)
            ->postJson(route('retros.action-items.subtasks.store', [$retro, $item]), ['content' => $content])
            ->assertCreated();
    }

    $ship = ActionItemSubtask::query()->where('content', 'Ship')->sole();
    $draft = ActionItemSubtask::query()->where('content', 'Draft')->sole();

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.subtasks.update', [$retro, $ship]), ['position' => 0, 'content' => 'Ship it'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.content', 'Ship it')
        ->assertJsonPath('actionItem.subtasks.1.content', 'Draft')
        ->assertJsonPath('actionItem.subtasks.2.content', 'Review');

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.subtasks.update', [$retro, $draft]), ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.1.isCompleted', true)
        ->assertJsonPath('actionItem.status', 'open');

    $this->actingAs($user)
        ->deleteJson(route('retros.action-items.subtasks.destroy', [$retro, $ship]))
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.content', 'Draft')
        ->assertJsonPath('actionItem.subtasks.0.position', 0)
        ->assertJsonPath('actionItem.subtasks.1.position', 1);

    expect($item->fresh()->updated_at?->toDateTimeString())->toBe('2026-10-05 10:00:00');
    Event::assertDispatched(fn (TeamActionItemSaved $event) => count($event->actionItem['subtasks']) === 3);
});

it('keeps the structure to managers and ticking to completers', function () {
    [$retro, $item] = subtaskBoardItem();
    [$assignee] = retroMember($retro);
    [$stranger] = retroMember($retro);
    $item->update(['assignee_user_id' => $assignee->id]);
    $subtask = ActionItemSubtask::factory()->create(['action_item_id' => $item->id]);

    $this->actingAs($assignee)->postJson(route('retros.action-items.subtasks.store', [$retro, $item]), ['content' => 'Mine'])->assertForbidden();
    $this->actingAs($assignee)->patchJson(route('retros.action-items.subtasks.update', [$retro, $subtask]), ['content' => 'Renamed'])->assertForbidden();
    $this->actingAs($assignee)->deleteJson(route('retros.action-items.subtasks.destroy', [$retro, $subtask]))->assertForbidden();
    $this->actingAs($stranger)->patchJson(route('retros.action-items.subtasks.update', [$retro, $subtask]), ['status' => 'completed'])->assertForbidden();
    $this->actingAs($assignee)
        ->patchJson(route('retros.action-items.subtasks.update', [$retro, $subtask]), ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.isCompleted', true);
});

it('validates the content and allows twenty sub-tasks', function () {
    [$retro, $item, $user] = subtaskBoardItem();
    $route = route('retros.action-items.subtasks.store', [$retro, $item]);

    $this->actingAs($user)->postJson($route, ['content' => ''])->assertUnprocessable()->assertJsonValidationErrors('content');
    $this->actingAs($user)->postJson($route, ['content' => str_repeat('a', 201)])->assertUnprocessable()->assertJsonValidationErrors('content');

    ActionItemSubtask::factory()->count(20)
        ->state(new Sequence(fn (Sequence $sequence) => ['position' => $sequence->index]))
        ->create(['action_item_id' => $item->id]);

    $this->actingAs($user)
        ->postJson($route, ['content' => 'One too many'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.content.0', 'An action item can have at most 20 sub-tasks.');
});

it('follows the board phase and lock rules', function () {
    [$votingRetro, $votingItem, $votingUser] = subtaskBoardItem(RetroPhase::Voting);
    [$lockedRetro, $lockedItem, $lockedUser] = subtaskBoardItem(RetroPhase::Discussing, ['is_locked' => true]);

    $this->actingAs($votingUser)
        ->postJson(route('retros.action-items.subtasks.store', [$votingRetro, $votingItem]), ['content' => 'Too early'])
        ->assertForbidden();
    $this->actingAs($lockedUser)
        ->postJson(route('retros.action-items.subtasks.store', [$lockedRetro, $lockedItem]), ['content' => 'Locked'])
        ->assertStatus(423);
});

it('changes sub-tasks from the workspace in any phase', function () {
    [$retro, $item, $user] = subtaskBoardItem(RetroPhase::Completed);
    $workspace = $retro->team->workspace;

    $id = $this->actingAs($user)
        ->postJson(route('workspaces.actionItemSubtasks.store', ['workspace' => $workspace, 'actionItem' => $item]), ['content' => 'Follow up'])
        ->assertCreated()
        ->json('actionItem.subtasks.0.id');

    $this->actingAs($user)
        ->patchJson(route('workspaces.actionItemSubtasks.update', ['workspace' => $workspace, 'actionItemSubtask' => $id]), ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.isCompleted', true);
    $this->actingAs($user)
        ->deleteJson(route('workspaces.actionItemSubtasks.destroy', ['workspace' => $workspace, 'actionItemSubtask' => $id]))
        ->assertOk()
        ->assertJsonCount(0, 'actionItem.subtasks');
});

it('returns 404 for sub-tasks of other items or invisible teams', function () {
    [$retro, $item, $user] = subtaskBoardItem();
    $foreign = ActionItemSubtask::factory()->create();
    $own = ActionItemSubtask::factory()->create(['action_item_id' => $item->id]);
    $outsider = teamMember(Team::factory()->create(['workspace_id' => $retro->team->workspace_id]));

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.subtasks.update', [$retro, $foreign]), ['status' => 'completed'])
        ->assertNotFound();
    $this->actingAs($outsider)
        ->patchJson(route('workspaces.actionItemSubtasks.update', ['workspace' => $retro->team->workspace, 'actionItemSubtask' => $own]), ['status' => 'completed'])
        ->assertNotFound();
});

it('leaves sub-tasks alone when the item is completed and deletes them with it', function () {
    [$retro, $item, $user] = subtaskBoardItem();
    ActionItemSubtask::factory()->count(2)
        ->state(new Sequence(fn (Sequence $sequence) => ['position' => $sequence->index]))
        ->create(['action_item_id' => $item->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $item]), ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.isCompleted', false)
        ->assertJsonPath('actionItem.subtasks.1.isCompleted', false);

    $item->delete();

    expect(ActionItemSubtask::count())->toBe(0);
});

it('keeps sub-task structure to managers on the workspace and lets an assignee tick', function () {
    [$retro, $item] = subtaskBoardItem(RetroPhase::Completed);
    $workspace = $retro->team->workspace;
    $assignee = teamMember($retro->team);
    $item->update(['assignee_user_id' => $assignee->id]);
    $subtask = ActionItemSubtask::factory()->create(['action_item_id' => $item->id]);

    $this->actingAs($assignee)
        ->postJson(route('workspaces.actionItemSubtasks.store', ['workspace' => $workspace, 'actionItem' => $item]), ['content' => 'Mine'])
        ->assertForbidden();
    $this->actingAs($assignee)
        ->patchJson(route('workspaces.actionItemSubtasks.update', ['workspace' => $workspace, 'actionItemSubtask' => $subtask]), ['content' => 'Renamed'])
        ->assertForbidden();
    $this->actingAs($assignee)
        ->deleteJson(route('workspaces.actionItemSubtasks.destroy', ['workspace' => $workspace, 'actionItemSubtask' => $subtask]))
        ->assertForbidden();
    $this->actingAs($assignee)
        ->patchJson(route('workspaces.actionItemSubtasks.update', ['workspace' => $workspace, 'actionItemSubtask' => $subtask]), ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.isCompleted', true);
});

it('returns 423 for workspace sub-task changes on a locked running retro', function () {
    [$retro, $item, $user] = subtaskBoardItem(RetroPhase::Voting, ['is_locked' => true]);
    $workspace = $retro->team->workspace;
    $subtask = ActionItemSubtask::factory()->create(['action_item_id' => $item->id]);

    $this->actingAs($user)
        ->postJson(route('workspaces.actionItemSubtasks.store', ['workspace' => $workspace, 'actionItem' => $item]), ['content' => 'Locked'])
        ->assertStatus(423);
    $this->actingAs($user)
        ->patchJson(route('workspaces.actionItemSubtasks.update', ['workspace' => $workspace, 'actionItemSubtask' => $subtask]), ['status' => 'completed'])
        ->assertStatus(423);
    $this->actingAs($user)
        ->deleteJson(route('workspaces.actionItemSubtasks.destroy', ['workspace' => $workspace, 'actionItemSubtask' => $subtask]))
        ->assertStatus(423);
});
