<?php

use App\Enums\ActionItemRecurrence;
use App\Enums\ActionItemStatus;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\ActionItemProgressChanged;
use App\Events\Retros\ActionItemSaved;
use App\Mcp\Tools\Retro\CompleteAction;
use App\Mcp\Tools\Retro\CreateAction;
use App\Mcp\Tools\Retro\UpdateAction;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([ActionItemCreated::class, ActionItemSaved::class]);
});

it('creates an action item on a board that takes action items as the user\'s participant', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    $user = teamMember($retro->team);

    $item = mcpStructured(mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Pair on reviews'])->assertOk());

    $participant = Participant::query()->where('retro_id', $retro->id)->where('user_id', $user->id)->sole();
    $stored = ActionItem::query()->sole();

    expect($item['boardId'])->toBe($retro->id)
        ->and($item['content'])->toBe('Pair on reviews')
        ->and($stored->created_by_participant_id)->toBe($participant->id);

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Second'])->assertOk();

    expect(Participant::query()->where('retro_id', $retro->id)->where('user_id', $user->id)->count())->toBe(1);

    Event::assertDispatched(ActionItemCreated::class);
    Event::assertDispatched(ActionItemSaved::class);
})->with([RetroPhase::Discussing, RetroPhase::Actions, RetroPhase::Roti]);

it('refuses boards outside Discussing without creating a participant', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    $user = teamMember($retro->team);

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Too early'])
        ->assertHasErrors(['This action is not available in the current phase.']);

    expect(ActionItem::query()->count())->toBe(0)
        ->and(Participant::query()->where('user_id', $user->id)->exists())->toBeFalse();
})->with([RetroPhase::Writing, RetroPhase::Voting, RetroPhase::Completed]);

it('refuses locked boards', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['is_locked' => true]);

    mcpWriter(teamMember($retro->team))->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Locked'])
        ->assertHasErrors(['The board is closed for editing.']);

    expect(ActionItem::query()->count())->toBe(0);
});

it('refuses when the board left Discussing or locked under the lock', function (array $change, string $message) {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    $flipped = false;

    Retro::retrieved(function (Retro $loaded) use (&$flipped, $retro, $change): void {
        if ($flipped || $loaded->id !== $retro->id) {
            return;
        }

        $flipped = true;
        DB::table('retros')->where('id', $retro->id)->update($change);
    });

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Racing'])->assertHasErrors([$message]);

    expect(ActionItem::query()->count())->toBe(0);
})->with([
    'moved on' => [['phase' => RetroPhase::Completed->value], 'This action is not available in the current phase.'],
    'locked' => [['is_locked' => true], 'The board is closed for editing.'],
]);

it('assigns guests of the board and refuses guests of another board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $strangerGuest = Participant::factory()->guest()->create();

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Guest task', 'assignee_participant_id' => $guest->id])->assertOk();

    expect(ActionItem::query()->sole()->assignee_participant_id)->toBe($guest->id);

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Wrong guest', 'assignee_participant_id' => $strangerGuest->id])
        ->assertHasErrors(['The assignee must be a participant of this retrospective.']);
});

it('stores member participants as their user', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    [$colleague, $colleagueParticipant] = retroMember($retro);

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Member task', 'assignee_participant_id' => $colleagueParticipant->id])->assertOk();

    $item = ActionItem::query()->sole();

    expect($item->assignee_user_id)->toBe($colleague->id)
        ->and($item->assignee_participant_id)->toBeNull();
});

it('creates items outside a retro for team members in any board phase', function () {
    $team = Team::factory()->create();
    Retro::factory()->inPhase(RetroPhase::Writing)->create(['team_id' => $team->id]);
    $user = teamMember($team);

    $item = mcpStructured(mcpWriter($user)->tool(CreateAction::class, ['team_id' => $team->id, 'content' => 'Team chore', 'assignee_user_id' => $user->id])->assertOk());

    expect($item['boardId'])->toBeNull()
        ->and($item['source'])->toBeNull()
        ->and(ActionItem::query()->sole()->created_by_user_id)->toBe($user->id)
        ->and(Participant::query()->where('user_id', $user->id)->exists())->toBeFalse();
});

it('refuses admins who are not team members', function () {
    $team = Team::factory()->create();

    mcpWriter(workspaceManager($team->workspace))->tool(CreateAction::class, ['team_id' => $team->id, 'content' => 'Not mine'])
        ->assertHasErrors(['Only team members can add action items to this team.']);

    expect(ActionItem::query()->count())->toBe(0);
});

it('refuses guest assignees outside a retro', function () {
    $team = Team::factory()->create();
    $guest = Participant::factory()->guest()->create();

    mcpWriter(teamMember($team))->tool(CreateAction::class, ['team_id' => $team->id, 'content' => 'Guest', 'assignee_participant_id' => $guest->id])
        ->assertHasErrors(['Guests can only be assigned from their own retrospective.']);

    expect(ActionItem::query()->count())->toBe(0);
});

it('requires exactly one of board_id or team_id', function (array $ids) {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    $arguments = collect($ids)->map(fn (string $key): string => $key === 'board_id' ? $retro->id : $retro->team_id)->all();

    mcpWriter($user)->tool(CreateAction::class, [...$arguments, 'content' => 'Ambiguous'])->assertHasErrors();

    expect(ActionItem::query()->count())->toBe(0);
})->with([
    'both' => [['board_id' => 'board_id', 'team_id' => 'team_id']],
    'neither' => [[]],
]);

it('reports boards of other teams as not found', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $outsider = teamMember(Team::factory()->create());

    mcpWriter($outsider)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Sneaky'])->assertHasErrors(['Not found.']);
    mcpWriter($outsider)->tool(CreateAction::class, ['team_id' => $retro->team_id, 'content' => 'Sneaky'])->assertHasErrors(['Not found.']);
});

it('updates items on the workspace surface and refuses locked running boards', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$author, $participant] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id, 'created_by_user_id' => $author->id]);

    mcpWriter($author)->tool(UpdateAction::class, ['action_id' => $item->id, 'content' => 'Reworded'])->assertOk();

    expect($item->fresh()->content)->toBe('Reworded');

    $retro->update(['is_locked' => true]);

    mcpWriter($author)->tool(UpdateAction::class, ['action_id' => $item->id, 'content' => 'Again'])
        ->assertHasErrors(['The board is closed for editing.']);

    $retro->update(['phase' => RetroPhase::Completed]);

    mcpWriter($author)->tool(UpdateAction::class, ['action_id' => $item->id, 'content' => 'After the retro'])->assertOk();
});

it('refuses updates by non-managers', function () {
    $item = ActionItem::factory()->create();

    mcpWriter(teamMember($item->team))->tool(UpdateAction::class, ['action_id' => $item->id, 'content' => 'Hijack'])
        ->assertHasErrors(['Only the author, the facilitator or an admin can change this action item.']);
});

it('assigns guests only while the board is discussing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$author, $participant] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id, 'created_by_user_id' => $author->id]);

    mcpWriter($author)->tool(UpdateAction::class, ['action_id' => $item->id, 'assignee_participant_id' => $guest->id])
        ->assertHasErrors(['This action is not available in the current phase.']);

    $retro->update(['phase' => RetroPhase::Discussing]);

    mcpWriter($author)->tool(UpdateAction::class, ['action_id' => $item->id, 'assignee_participant_id' => $guest->id])->assertOk();

    expect($item->fresh()->assignee_participant_id)->toBe($guest->id);
});

it('refuses guest assignees for items without a board', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();
    $guest = Participant::factory()->guest()->create();

    mcpWriter($user)->tool(UpdateAction::class, ['action_id' => $item->id, 'assignee_participant_id' => $guest->id])
        ->assertHasErrors(['Guests can only be assigned from their own retrospective.']);
});

it('sets and clears the recurrence for managers', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['due_on' => now()->addWeek()->toDateString()]);

    mcpWriter($user)->tool(UpdateAction::class, ['action_id' => $item->id, 'recurrence' => ActionItemRecurrence::Weekly->value])->assertOk();

    expect($item->fresh()->recurrence)->toBe(ActionItemRecurrence::Weekly);

    mcpWriter($user)->tool(UpdateAction::class, ['action_id' => $item->id, 'due_on' => null])
        ->assertHasErrors(['A recurring action item needs a due date.']);

    mcpWriter($user)->tool(UpdateAction::class, ['action_id' => $item->id, 'recurrence' => null])->assertOk();

    expect($item->fresh()->recurrence)->toBeNull();
});

it('lets the assignee complete and reopen an item idempotently', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $assignee = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $author)->assignedTo($assignee)->create();

    mcpWriter($assignee)->tool(CompleteAction::class, ['action_id' => $item->id])->assertOk();
    mcpWriter($assignee)->tool(CompleteAction::class, ['action_id' => $item->id, 'completed' => true])->assertOk();

    expect($item->fresh()->completed_at)->not->toBeNull();

    mcpWriter($assignee)->tool(CompleteAction::class, ['action_id' => $item->id, 'completed' => false])->assertOk();

    expect($item->fresh()->completed_at)->toBeNull();
});

it('leaves a started item in progress when it is not completed', function () {
    Event::fake([ActionItemProgressChanged::class]);
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->started()->create();

    mcpWriter($user)->tool(CompleteAction::class, ['action_id' => $item->id, 'completed' => false])->assertOk();

    expect($item->fresh()->currentStatus())->toBe(ActionItemStatus::Doing);
    Event::assertNotDispatched(ActionItemProgressChanged::class);
});

it('refuses completion by someone who is neither manager nor assignee', function () {
    $item = ActionItem::factory()->create();

    mcpWriter(teamMember($item->team))->tool(CompleteAction::class, ['action_id' => $item->id])
        ->assertHasErrors(['Only the assignee or a manager can complete this action item.']);
});

it('creates the next occurrence when completing a recurring item', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->recurring(ActionItemRecurrence::Weekly)->create();

    mcpWriter($user)->tool(CompleteAction::class, ['action_id' => $item->id])->assertOk();

    expect(ActionItem::query()->where('previous_occurrence_id', $item->id)->exists())->toBeTrue();
});

it('hides action item tools from read-only tokens', function () {
    $user = teamMember(Team::factory()->create());

    $actionTools = ['retro.actions.create', 'retro.actions.update', 'retro.actions.complete'];

    expect(array_intersect(mcpToolNames(actingAsMcp($user)), $actionTools))->toBeEmpty()
        ->and(mcpToolNames(mcpWriter($user)))->toContain(...$actionTools);
});

it('refuses a status argument on update and points to the complete tool', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();

    mcpWriter($user)->tool(UpdateAction::class, ['action_id' => $item->id, 'status' => 'completed'])
        ->assertHasErrors(['Use retro.actions.complete to complete or reopen an action item.']);

    expect($item->fresh()->completed_at)->toBeNull();
});

it('lets the facilitator of a completed retrospective complete an item', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$facilitator] = retroFacilitator($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id]);

    mcpWriter($facilitator)->tool(CompleteAction::class, ['action_id' => $item->id])->assertOk();

    expect($item->fresh()->completed_at)->not->toBeNull();
});

it('refuses completion on a locked running board even for a manager', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['is_locked' => true]);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id]);

    mcpWriter(workspaceManager($retro->team->workspace))->tool(CompleteAction::class, ['action_id' => $item->id])
        ->assertHasErrors(['The board is closed for editing.']);

    expect($item->fresh()->completed_at)->toBeNull();
});
