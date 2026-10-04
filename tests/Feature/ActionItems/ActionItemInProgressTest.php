<?php

use App\Enums\ActionItemEventOrigin;
use App\Enums\ActionItemRecurrence;
use App\Enums\ActionItemStatus;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemProgressChanged;
use App\Events\ActionItems\ActionItemReopened;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake([ActionItemCompleted::class, ActionItemReopened::class, ActionItemProgressChanged::class, TeamActionItemSaved::class]);
    $this->travelTo(CarbonImmutable::parse('2026-10-21 09:00:00'));
});

/**
 * @param  array<string, mixed>  $payload
 */
function patchItemStatus(ActionItem $item, User $user, array $payload): TestResponse
{
    return test()->actingAs($user)->patchJson(route('workspaces.actionItems.update', [$item->team->workspace, $item]), $payload);
}

it('starts an open item and puts it back to do, without completion events', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();

    patchItemStatus($item, $user, ['status' => 'doing'])
        ->assertOk()
        ->assertJsonPath('actionItem.status', 'doing')
        ->assertJsonPath('actionItem.startedAt', '2026-10-21T09:00:00+00:00');

    expect($item->fresh()->currentStatus())->toBe(ActionItemStatus::Doing)
        ->and($item->fresh()->completed_at)->toBeNull();

    patchItemStatus($item, $user, ['status' => 'open'])
        ->assertOk()
        ->assertJsonPath('actionItem.status', 'open')
        ->assertJsonPath('actionItem.startedAt', null);

    expect($item->fresh()->started_at)->toBeNull();
    Event::assertNotDispatched(ActionItemCompleted::class);
    Event::assertNotDispatched(ActionItemReopened::class);
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 2);
    Event::assertDispatchedTimes(ActionItemProgressChanged::class, 2);
    Event::assertDispatched(fn (ActionItemProgressChanged $event) => $event->origin === ActionItemEventOrigin::Skrum);
});

it('changes and announces nothing when the item already has the status', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->started('2026-10-20 08:00:00')->create();

    patchItemStatus($item, $user, ['status' => 'doing'])->assertOk()->assertJsonPath('actionItem.startedAt', '2026-10-20T08:00:00+00:00');

    Event::assertNotDispatched(TeamActionItemSaved::class);
    Event::assertNotDispatched(ActionItemProgressChanged::class);
});

it('keeps the start when a started item is completed, and the next occurrence starts to do', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->recurring(ActionItemRecurrence::Weekly)->started('2026-10-20 08:00:00')->create();

    patchItemStatus($item, $user, ['status' => 'completed'])->assertOk()->assertJsonPath('actionItem.status', 'completed');

    $next = ActionItem::query()->where('previous_occurrence_id', $item->id)->sole();

    expect($item->fresh()->started_at?->toDateTimeString())->toBe('2026-10-20 08:00:00')
        ->and($item->fresh()->currentStatus())->toBe(ActionItemStatus::Completed)
        ->and($next->currentStatus())->toBe(ActionItemStatus::Open)
        ->and($next->started_at)->toBeNull();
    Event::assertDispatchedTimes(ActionItemCompleted::class, 1);
    Event::assertNotDispatched(ActionItemProgressChanged::class);
});

it('reopens a completed item to do or in progress', function (string $target, bool $staysStarted) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->completed()->started('2026-10-19 08:00:00')->create(['completed_via_source' => 'jira']);

    patchItemStatus($item, $user, ['status' => $target])->assertOk()->assertJsonPath('actionItem.status', $target);

    $fresh = $item->fresh();
    expect($fresh->completed_at)->toBeNull()
        ->and($fresh->completed_via_source)->toBeNull()
        ->and($fresh->started_at !== null)->toBe($staysStarted);
    Event::assertDispatchedTimes(ActionItemReopened::class, 1);
    Event::assertNotDispatched(ActionItemProgressChanged::class);
})->with([
    'to do' => ['open', false],
    'in progress' => ['doing', true],
]);

it('lets a guest assignee start their item on the board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Actions)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $item = ActionItem::factory()->assignedToGuest($guest)->create();

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->patchJson(route('retros.action-items.update', [$retro, $item]), ['status' => 'doing'])
        ->assertOk()
        ->assertJsonPath('actionItem.status', 'doing');
});

it('refuses to start an item to a member who may not complete it', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $author)->create();

    patchItemStatus($item, teamMember($team), ['status' => 'doing'])->assertForbidden();

    expect($item->fresh()->started_at)->toBeNull();
});

it('keeps two states for sub-tasks', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->withSubtasks(1)->create();
    $subtask = ActionItemSubtask::query()->where('action_item_id', $item->id)->sole();

    $this->actingAs($user)
        ->patchJson(route('workspaces.actionItemSubtasks.update', [$team->workspace, $subtask]), ['status' => 'doing'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});

it('labels the three statuses', function () {
    expect(ActionItemStatus::Open->label())->toBe('To do')
        ->and(ActionItemStatus::Doing->label())->toBe('In progress')
        ->and(ActionItemStatus::Completed->label())->toBe('Done');
});
