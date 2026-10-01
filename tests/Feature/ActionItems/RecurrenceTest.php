<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Enums\ActionItemPriority;
use App\Enums\ActionItemRecurrence;
use App\Enums\ActionItemStatus;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\ActionItemSubtask;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-10 09:00:00'));
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Team, 1: User, 2: ActionItem}
 */
function recurringTeamItem(ActionItemRecurrence $recurrence = ActionItemRecurrence::Weekly, array $attributes = []): array
{
    $team = Team::factory()->create();
    $author = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $author)->recurring($recurrence)->create(['due_on' => '2026-10-09', ...$attributes]);

    return [$team, $author, $item];
}

function setStatusFromWorkspace(TestCase $test, User $user, ActionItem $item, string $status): TestResponse
{
    return $test->actingAs($user)->patchJson(
        route('workspaces.actionItems.update', ['workspace' => $item->team->workspace, 'actionItem' => $item]),
        ['status' => $status],
    );
}

it('needs a due date for a recurring item', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $team = $retro->team;

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Weekly sync', 'recurrence' => 'weekly'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.recurrence.0', 'A recurring action item needs a due date.');

    $id = $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Weekly sync', 'recurrence' => 'weekly', 'due_on' => '2026-10-16'])
        ->assertCreated()
        ->assertJsonPath('actionItem.recurrence', 'weekly')
        ->json('actionItem.id');

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $id]), ['due_on' => null])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('due_on');
    $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $team->id, 'content' => 'Monthly report', 'recurrence' => 'monthly'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('recurrence');
    $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $team->id, 'content' => 'Daily', 'recurrence' => 'daily', 'due_on' => '2026-10-16'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('recurrence');
});

it('keeps the recurrence to managers', function () {
    [$team, $author, $item] = recurringTeamItem();
    $assignee = teamMember($team);
    $item->update(['assignee_user_id' => $assignee->id]);
    $route = route('workspaces.actionItems.update', ['workspace' => $team->workspace, 'actionItem' => $item]);

    $this->actingAs($assignee)->patchJson($route, ['recurrence' => 'monthly'])->assertForbidden();
    $this->actingAs($author)->patchJson($route, ['recurrence' => 'monthly'])->assertOk()->assertJsonPath('actionItem.recurrence', 'monthly');
});

it('checks permission before validating the recurrence', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $assignee = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $manager)->create(['due_on' => null, 'assignee_user_id' => $assignee->id]);
    $route = route('workspaces.actionItems.update', ['workspace' => $team->workspace, 'actionItem' => $item]);

    $this->actingAs($assignee)->patchJson($route, ['recurrence' => 'weekly'])->assertForbidden();
    $this->actingAs($manager)->patchJson($route, ['recurrence' => 'weekly'])->assertUnprocessable()->assertJsonValidationErrors('recurrence');
});

it('creates exactly one next occurrence', function () {
    [$team, $author, $item] = recurringTeamItem(ActionItemRecurrence::Weekly, [
        'content' => 'Water the plants',
        'priority' => ActionItemPriority::High,
        'theme_name' => 'Office',
    ]);
    $assignee = teamMember($team);
    $item->update(['assignee_user_id' => $assignee->id]);
    ActionItemSubtask::factory()->completed()->create(['action_item_id' => $item->id, 'content' => 'Kitchen', 'position' => 0]);
    ActionItemSubtask::factory()->create(['action_item_id' => $item->id, 'content' => 'Lobby', 'position' => 1]);
    ActionItemComment::factory()->create(['action_item_id' => $item->id]);

    setStatusFromWorkspace($this, $author, $item, 'completed')->assertOk();
    setStatusFromWorkspace($this, $author, $item, 'open')->assertOk();
    setStatusFromWorkspace($this, $author, $item, 'completed')->assertOk();

    $next = ActionItem::query()->where('previous_occurrence_id', $item->id)->sole();

    expect($next->only(['team_id', 'retro_id', 'content', 'assignee_user_id', 'created_by_user_id', 'theme_name']))->toBe([
        'team_id' => $team->id,
        'retro_id' => null,
        'content' => 'Water the plants',
        'assignee_user_id' => $assignee->id,
        'created_by_user_id' => $author->id,
        'theme_name' => 'Office',
    ])
        ->and($next->priority)->toBe(ActionItemPriority::High)
        ->and($next->recurrence)->toBe(ActionItemRecurrence::Weekly)
        ->and($next->due_on?->toDateString())->toBe('2026-10-16')
        ->and($next->completed_at)->toBeNull()
        ->and($next->subtasks->map(fn (ActionItemSubtask $subtask) => [$subtask->content, $subtask->position, $subtask->completed_at])->all())
        ->toBe([['Kitchen', 0, null], ['Lobby', 1, null]])
        ->and($next->comments()->count())->toBe(0)
        ->and(ActionItem::count())->toBe(2);

    Event::assertDispatched(fn (ActionItemCreated $event) => $event->actionItem->is($next));
    Event::assertDispatched(fn (TeamActionItemSaved $event) => $event->actionItem['id'] === $next->id
        && $event->actionItem['previousOccurrenceId'] === $item->id
        && $event->actionItem['retroId'] === null
        && $event->actionItem['recurrence'] === 'weekly');
});

it('advances the due date until it is not overdue', function (ActionItemRecurrence $recurrence, string $dueOn, string $nextDueOn) {
    [, $author, $item] = recurringTeamItem($recurrence, ['due_on' => $dueOn]);

    setStatusFromWorkspace($this, $author, $item, 'completed')->assertOk();

    expect($item->nextOccurrence()->sole()->due_on?->toDateString())->toBe($nextDueOn);
})->with([
    'weekly, three weeks late' => [ActionItemRecurrence::Weekly, '2026-09-18', '2026-10-16'],
    'every two weeks, late' => [ActionItemRecurrence::EveryTwoWeeks, '2026-09-01', '2026-10-13'],
    'monthly, landing on today' => [ActionItemRecurrence::Monthly, '2026-08-10', '2026-10-10'],
    'weekly, completed early' => [ActionItemRecurrence::Weekly, '2026-10-20', '2026-10-27'],
]);

it('clamps monthly recurrences to the end of the month', function () {
    [, $author, $item] = recurringTeamItem(ActionItemRecurrence::Monthly, ['due_on' => '2027-01-31']);

    setStatusFromWorkspace($this, $author, $item, 'completed')->assertOk();

    expect($item->nextOccurrence()->sole()->due_on?->toDateString())->toBe('2027-02-28');
});

it('drops guest and former member assignees from the next occurrence', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    [, $author] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $guestItem = ActionItem::factory()->assignedToGuest($guest)->recurring(ActionItemRecurrence::Weekly)
        ->create(['created_by_participant_id' => $author->id]);
    [$team, $teamAuthor, $memberItem] = recurringTeamItem();
    $leaver = teamMember($team);
    $memberItem->update(['assignee_user_id' => $leaver->id]);
    $team->members()->detach($leaver);
    $complete = resolve(SetActionItemStatus::class);

    $complete->handle($guestItem, ActionItemActor::forParticipant($author), ActionItemStatus::Completed);
    $complete->handle($memberItem->fresh(), ActionItemActor::forUser($teamAuthor), ActionItemStatus::Completed);

    expect($guestItem->nextOccurrence()->sole()->only(['assignee_user_id', 'assignee_participant_id', 'retro_id', 'created_by_participant_id']))->toBe([
        'assignee_user_id' => null,
        'assignee_participant_id' => null,
        'retro_id' => null,
        'created_by_participant_id' => $author->id,
    ])
        ->and($memberItem->nextOccurrence()->sole()->assignee_user_id)->toBeNull();
});

it('stops the series when the item no longer repeats', function () {
    [$team, $author, $item] = recurringTeamItem();

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $team->workspace, 'actionItem' => $item]), ['recurrence' => null])
        ->assertOk()
        ->assertJsonPath('actionItem.recurrence', null);
    setStatusFromWorkspace($this, $author, $item, 'completed')->assertOk();

    expect(ActionItem::count())->toBe(1);
});

it('regenerates when the external sync completes the item', function () {
    [, , $item] = recurringTeamItem();

    resolve(SetActionItemStatus::class)->handle($item, new ExternalSyncActor('jira', 'PROJ-7'), ActionItemStatus::Completed);

    expect($item->nextOccurrence()->exists())->toBeTrue();
});
