<?php

use App\Actions\ActionItems\SendActionItemReminders;
use App\Enums\ActionItemReminderKind;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use App\Notifications\ActionItemReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00'));
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: User, 1: ActionItem, 2: Team}
 */
function notifiedAssignee(array $attributes = []): array
{
    $team = Team::factory()->create(['name' => 'Platform']);
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-08', ...$attributes]);

    return [$user, $item, $team];
}

function remindAbout(User $user, ActionItem $item, ActionItemReminderKind $kind = ActionItemReminderKind::Overdue): DatabaseNotification
{
    $user->notify(new ActionItemReminderNotification($item->id, $kind, $item->team->workspace_id, (string) $item->due_on?->toDateString()));

    return $user->notifications()
        ->where('data->actionItemId', $item->id)
        ->where('data->kind', $kind->value)
        ->firstOrFail();
}

it('lists the latest notifications with live item details', function () {
    [$user, $item, $team] = notifiedAssignee(['content' => 'Rotate the keys']);
    $notification = remindAbout($user, $item);

    $this->actingAs($user)
        ->getJson(route('notifications.index'))
        ->assertOk()
        ->assertJsonPath('unreadCount', 1)
        ->assertJsonPath('notifications.0.id', $notification->id)
        ->assertJsonPath('notifications.0.kind', 'overdue')
        ->assertJsonPath('notifications.0.wording', 'overdue')
        ->assertJsonPath('notifications.0.readAt', null)
        ->assertJsonPath('notifications.0.actionItem', [
            'id' => $item->id,
            'content' => 'Rotate the keys',
            'teamName' => 'Platform',
            'dueOn' => '2026-10-08',
            'isOverdue' => true,
            'url' => route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'item' => $item->id]),
            'ticket' => null,
        ]);
});

it('words due-soon reminders as today or tomorrow', function (string $dueOn, string $wording) {
    [$user, $item] = notifiedAssignee(['due_on' => $dueOn]);
    remindAbout($user, $item, ActionItemReminderKind::DueSoon);

    $this->actingAs($user)
        ->getJson(route('notifications.index'))
        ->assertJsonPath('notifications.0.wording', $wording);
})->with([
    'today' => ['2026-10-10', 'due_today'],
    'tomorrow' => ['2026-10-11', 'due_tomorrow'],
]);

it('drops notifications of deleted or hidden items', function () {
    [$user, $item, $team] = notifiedAssignee();
    $deleted = ActionItem::factory()->withoutRetro($team, $user)->create(['due_on' => '2026-10-08']);
    $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $otherTeam->members()->attach($user);
    $hidden = ActionItem::factory()->withoutRetro($otherTeam, $user)->create(['due_on' => '2026-10-08']);
    $visible = remindAbout($user, $item);
    remindAbout($user, $deleted);
    remindAbout($user, $hidden);
    $deleted->delete();
    $otherTeam->members()->detach($user);

    $this->actingAs($user)
        ->getJson(route('notifications.index'))
        ->assertOk()
        ->assertJsonCount(1, 'notifications')
        ->assertJsonPath('notifications.0.id', $visible->id)
        ->assertJsonPath('unreadCount', 1);

    expect($user->notifications()->count())->toBe(1);
});

it('lists only the own notifications, twenty a page', function () {
    [$user, $item] = notifiedAssignee();
    [$other, $otherItem] = notifiedAssignee();
    remindAbout($other, $otherItem);

    foreach (range(1, 31) as $minute) {
        $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00')->addMinutes($minute));
        remindAbout($user, $item);
    }

    $this->actingAs($user)
        ->getJson(route('notifications.index'))
        ->assertJsonCount(20, 'notifications')
        ->assertJsonPath('hasMore', true)
        ->assertJsonPath('unreadCount', 31);
});

it('marks one or all notifications read', function () {
    [$user, $item] = notifiedAssignee();
    $first = remindAbout($user, $item);
    remindAbout($user, $item, ActionItemReminderKind::DueSoon);

    $this->actingAs($user)
        ->patchJson(route('notifications.update', $first->id), ['read' => true])
        ->assertOk()
        ->assertExactJson(['unreadCount' => 1]);
    $this->actingAs($user)
        ->postJson(route('notifications.readAll'))
        ->assertOk()
        ->assertExactJson(['unreadCount' => 0]);

    expect($user->unreadNotifications()->count())->toBe(0);
});

it('refuses other users notifications', function () {
    [, $item] = notifiedAssignee();
    [$other, $otherItem] = notifiedAssignee();
    $foreign = remindAbout($other, $otherItem);

    $this->actingAs($item->assigneeUser)
        ->patchJson(route('notifications.update', $foreign->id), ['read' => true])
        ->assertNotFound();

    expect($foreign->fresh()->read_at)->toBeNull();
});

it('marks reminders read when the item is completed', function () {
    [$user, $item, $team] = notifiedAssignee();
    $other = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-08']);
    $reminder = remindAbout($user, $item);
    $untouched = remindAbout($user, $other);

    $this->actingAs($user)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $team->workspace, 'actionItem' => $item]), ['status' => 'completed'])
        ->assertOk();

    expect($reminder->fresh()->read_at)->not->toBeNull()
        ->and($untouched->fresh()->read_at)->toBeNull();
});

it('marks the reminders of a former assignee read when the item is completed', function () {
    [$formerAssignee, $item, $team] = notifiedAssignee();
    resolve(SendActionItemReminders::class)->handle();
    $item->update(['assignee_user_id' => teamMember($team)->id]);

    $this->actingAs($formerAssignee)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $team->workspace, 'actionItem' => $item]), ['status' => 'completed'])
        ->assertOk();

    expect($formerAssignee->unreadNotifications()->where('type', ActionItemReminderNotification::class)->count())->toBe(0)
        ->and($formerAssignee->notifications()->where('type', ActionItemReminderNotification::class)->count())->toBe(1);
});

it('shares the unread count and my overdue items of the current workspace', function () {
    [$user, $item, $team] = notifiedAssignee();
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-01']);
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->completed()->create(['due_on' => '2026-10-01']);
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-20']);
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo(teamMember($team))->create(['due_on' => '2026-10-01']);
    $elsewhere = Team::factory()->create();
    $elsewhere->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $elsewhere->members()->attach($user);
    ActionItem::factory()->withoutRetro($elsewhere, $user)->assignedTo($user)->create(['due_on' => '2026-10-01']);
    remindAbout($user, $item);

    $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('notifications.unreadCount', 1)
            ->where('actionItems.overdueAssignedCount', 2));
});
