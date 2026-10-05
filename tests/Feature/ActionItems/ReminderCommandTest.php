<?php

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Models\Team;
use App\Models\User;
use App\Notifications\ActionItemReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\QueryException;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * @param  array<string, mixed>  $attributes
 */
function storedReminderNotification(User $user, ActionItem $item, array $attributes = []): DatabaseNotification
{
    return $user->notifications()->create([
        'id' => (string) Str::uuid(),
        'type' => ActionItemReminderNotification::class,
        'data' => ['kind' => 'overdue', 'actionItemId' => $item->id, 'workspaceId' => $item->team->workspace_id, 'dueOn' => '2026-10-01'],
        ...$attributes,
    ]);
}

it('sends the reminders and reports progress', function () {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00'));
    $team = Team::factory()->create();
    $assignee = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $assignee)->assignedTo($assignee)->create(['due_on' => '2026-10-10']);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput("Reminding user `{$assignee->id}` about 1 item…")
        ->expectsOutput('Sent 1 reminder to 1 user.')
        ->assertSuccessful();
});

it('does nothing when reminders are turned off', function () {
    Notification::fake();
    config(['skrum.action_item_reminders.enabled' => false]);
    $team = Team::factory()->create();
    $assignee = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $assignee)->assignedTo($assignee)->create(['due_on' => now()->toDateString()]);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Action item reminders are turned off.')
        ->assertSuccessful();

    Notification::assertNothingSent();
    expect(ActionItemReminder::count())->toBe(0);
});

it('runs every day at the configured time in the instance time zone', function () {
    $event = collect(resolve(Schedule::class)->events())
        ->first(fn (ScheduledEvent $event) => str_contains((string) $event->command, 'action-items:send-reminders'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('0 8 * * *')
        ->and($event->timezone)->toBe(config('app.timezone'))
        ->and($event->withoutOverlapping)->toBeTrue()
        ->and($event->onOneServer)->toBeTrue();
});

it('prunes orphaned, read and old notifications and old reminder records', function () {
    Notification::fake();
    $user = User::factory()->create();
    $item = ActionItem::factory()->create();
    $gone = ActionItem::factory()->create();
    $kept = storedReminderNotification($user, $item);
    storedReminderNotification($user, $gone);
    storedReminderNotification($user, $item, ['read_at' => now()->subDays(31), 'created_at' => now()->subDays(31)]);
    $recentlyRead = storedReminderNotification($user, $item, ['read_at' => now()->subDays(2), 'created_at' => now()->subDays(2)]);
    storedReminderNotification($user, $item, ['created_at' => now()->subDays(91)]);
    $gone->delete();
    $reminder = ['action_item_id' => $item->id, 'user_id' => $user->id, 'kind' => ActionItemReminderKind::Overdue];
    ActionItemReminder::query()->create([...$reminder, 'due_on' => '2026-01-01', 'sent_at' => now()->subDays(91)]);
    ActionItemReminder::query()->create([...$reminder, 'due_on' => '2026-10-01', 'sent_at' => now()]);

    $this->artisan('action-items:send-reminders')->assertSuccessful();

    expect($user->notifications()->pluck('id')->sort()->values()->all())
        ->toBe(collect([$kept->id, $recentlyRead->id])->sort()->values()->all())
        ->and(ActionItemReminder::count())->toBe(1);
});

it('logs a reminder once per item, user, kind and due date', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-10']);
    $user = User::factory()->create();
    $row = [
        'action_item_id' => $item->id,
        'user_id' => $user->id,
        'kind' => ActionItemReminderKind::Overdue,
        'due_on' => '2026-10-10',
        'sent_at' => now(),
    ];

    ActionItemReminder::query()->create($row);

    expect(fn () => DB::transaction(fn () => ActionItemReminder::query()->create($row)))->toThrow(QueryException::class)
        ->and(ActionItemReminder::query()->create([...$row, 'due_on' => '2026-10-11'])->exists)->toBeTrue();
});
