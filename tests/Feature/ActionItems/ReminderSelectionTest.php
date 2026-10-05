<?php

use App\Actions\ActionItems\SendActionItemReminders;
use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Notifications\ActionItemReminderDigestNotification;
use App\Notifications\ActionItemReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Testing\Fakes\NotificationFake;

beforeEach(function () {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00'));
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: ActionItem, 1: User, 2: Team}
 */
function assignedReminderItem(array $attributes = []): array
{
    $team = Team::factory()->create();
    $assignee = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->assignedTo($assignee)
        ->create(['due_on' => '2026-10-10', ...$attributes]);

    return [$item, $assignee, $team];
}

/**
 * @return array{reminders: int, users: int}
 */
function sendDueReminders(): array
{
    return resolve(SendActionItemReminders::class)->handle();
}

it('reminds of items due today or tomorrow and of items overdue within a week', function (string $dueOn, string $kind) {
    [$item, $assignee, $team] = assignedReminderItem(['due_on' => $dueOn]);

    expect(sendDueReminders())->toBe(['reminders' => 1, 'users' => 1]);

    Notification::assertSentTo(
        $assignee,
        ActionItemReminderDigestNotification::class,
        fn (ActionItemReminderDigestNotification $notification) => $notification->reminders === [['actionItemId' => $item->id, 'kind' => $kind]],
    );
    Notification::assertSentTo(
        $assignee,
        ActionItemReminderNotification::class,
        fn (ActionItemReminderNotification $notification) => $notification->toArray($assignee) === [
            'kind' => $kind,
            'actionItemId' => $item->id,
            'workspaceId' => $team->workspace_id,
            'dueOn' => $dueOn,
        ],
    );
    expect(ActionItemReminder::query()->sole()->only(['action_item_id', 'user_id']))
        ->toBe(['action_item_id' => $item->id, 'user_id' => $assignee->id]);
})->with([
    'due today' => ['2026-10-10', 'due_soon'],
    'due tomorrow' => ['2026-10-11', 'due_soon'],
    'due yesterday' => ['2026-10-09', 'overdue'],
    'due a week ago' => ['2026-10-03', 'overdue'],
]);

it('skips items that must not be reminded', function (Closure $prepare) {
    [$item, $assignee, $team] = assignedReminderItem();
    $prepare($item, $assignee, $team);

    expect(sendDueReminders())->toBe(['reminders' => 0, 'users' => 0]);

    Notification::assertNothingSent();
    expect(ActionItemReminder::count())->toBe(0);
})->with([
    'due in two days' => [fn (ActionItem $item) => $item->update(['due_on' => '2026-10-12'])],
    'due eight days ago' => [fn (ActionItem $item) => $item->update(['due_on' => '2026-10-02'])],
    'completed' => [fn (ActionItem $item) => $item->update(['completed_at' => now()])],
    'unassigned' => [fn (ActionItem $item) => $item->update(['assignee_user_id' => null])],
    'assigned to a guest' => [function (ActionItem $item, User $assignee, Team $team) {
        $retro = Retro::factory()->create(['team_id' => $team->id]);
        $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
        $item->update(['retro_id' => $retro->id, 'assignee_user_id' => null, 'assignee_participant_id' => $guest->id]);
    }],
    'assignee left the team' => [fn (ActionItem $item, User $assignee, Team $team) => $team->members()->detach($assignee)],
    'unverified email' => [fn (ActionItem $item, User $assignee) => $assignee->forceFill(['email_verified_at' => null])->save()],
    'deactivated assignee' => [fn (ActionItem $item, User $assignee) => $assignee->forceFill(['deactivated_at' => now()])->save()],
]);

it('sends each reminder once', function () {
    [, $assignee] = assignedReminderItem();

    sendDueReminders();
    sendDueReminders();

    Notification::assertSentToTimes($assignee, ActionItemReminderDigestNotification::class, 1);
    Notification::assertSentToTimes($assignee, ActionItemReminderNotification::class, 1);
});

it('reminds again after the due date moves or the item is reassigned', function () {
    [$item, $assignee, $team] = assignedReminderItem();

    sendDueReminders();
    $item->update(['due_on' => '2026-10-11']);
    sendDueReminders();
    $colleague = teamMember($team);
    $item->update(['assignee_user_id' => $colleague->id]);
    sendDueReminders();

    Notification::assertSentToTimes($assignee, ActionItemReminderDigestNotification::class, 2);
    Notification::assertSentToTimes($colleague, ActionItemReminderDigestNotification::class, 1);
    expect(ActionItemReminder::count())->toBe(3);
});

it('respects the email and in-app preferences', function (bool $byEmail, bool $inApp) {
    [, $assignee] = assignedReminderItem();
    $assignee->forceFill(['action_item_reminders_by_email' => $byEmail, 'action_item_reminders_in_app' => $inApp])->save();

    sendDueReminders();

    Notification::assertSentToTimes($assignee, ActionItemReminderDigestNotification::class, $byEmail ? 1 : 0);
    Notification::assertSentToTimes($assignee, ActionItemReminderNotification::class, $inApp ? 1 : 0);
    expect(ActionItemReminder::count())->toBe($byEmail || $inApp ? 1 : 0);
})->with([
    'email only' => [true, false],
    'bell only' => [false, true],
    'neither' => [false, false],
]);

it('reminds of a new item on a second run the same day, without repeating the one already sent', function () {
    [, $assignee, $team] = assignedReminderItem();
    sendDueReminders();
    $added = ActionItem::factory()->withoutRetro($team, $assignee)->assignedTo($assignee)->create(['due_on' => '2026-10-10']);

    expect(sendDueReminders())->toBe(['reminders' => 1, 'users' => 1]);

    Notification::assertSentTo(
        $assignee,
        ActionItemReminderDigestNotification::class,
        fn (ActionItemReminderDigestNotification $notification) => $notification->reminders === [['actionItemId' => $added->id, 'kind' => 'due_soon']],
    );
    expect(ActionItemReminder::count())->toBe(2);
});

it('sends one digest per user with all their items', function () {
    [$first, $assignee, $team] = assignedReminderItem(['due_on' => '2026-10-08']);
    ActionItem::factory()->count(2)->withoutRetro($team, $assignee)->assignedTo($assignee)->create(['due_on' => '2026-10-11']);
    [, $other] = assignedReminderItem();
    $progress = [];

    $totals = resolve(SendActionItemReminders::class)->handle(function (User $user, int $count) use (&$progress): void {
        $progress[$user->id] = $count;
    });

    expect($totals)->toBe(['reminders' => 4, 'users' => 2])
        ->and($progress)->toBe([$assignee->id => 3, $other->id => 1]);
    Notification::assertSentToTimes($assignee, ActionItemReminderDigestNotification::class, 1);
    Notification::assertSentTo(
        $assignee,
        ActionItemReminderDigestNotification::class,
        fn (ActionItemReminderDigestNotification $notification) => count($notification->reminders) === 3
            && $notification->reminders[0] === ['actionItemId' => $first->id, 'kind' => 'overdue'],
    );
    Notification::assertSentToTimes($assignee, ActionItemReminderNotification::class, 3);
});

it('keeps reminding other users when one delivery fails', function () {
    [, $first] = assignedReminderItem();
    [, $second] = assignedReminderItem();
    $failing = new class extends NotificationFake
    {
        public bool $failed = false;

        public function send($notifiables, $notification): void
        {
            if (! $this->failed) {
                $this->failed = true;

                throw new RuntimeException('mail down');
            }

            parent::send($notifiables, $notification);
        }
    };
    Notification::swap($failing);

    sendDueReminders();

    $delivered = collect([$first, $second])
        ->filter(fn (User $user) => $failing->sent($user, ActionItemReminderDigestNotification::class)->isNotEmpty());

    expect($delivered)->toHaveCount(1)
        ->and(ActionItemReminder::query()->count())->toBe(2);

    sendDueReminders();

    expect(collect([$first, $second])->sum(fn (User $user): int => $failing->sent($user, ActionItemReminderDigestNotification::class)->count()))->toBe(1);
});
