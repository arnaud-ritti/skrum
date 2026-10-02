<?php

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

it('turns both reminder channels on by default', function () {
    $user = User::factory()->create()->fresh();

    expect($user->action_item_reminders_by_email)->toBeTrue()
        ->and($user->action_item_reminders_in_app)->toBeTrue()
        ->and($user->recap_in_app)->toBeTrue();
});

it('shows the notification preferences', function () {
    $user = User::factory()->create();
    $user->forceFill(['action_item_reminders_in_app' => false])->save();

    $this->actingAs($user)
        ->get(route('notificationPreferences.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/notifications', false)
            ->where('preferences', ['action_item_reminders_by_email' => true, 'action_item_reminders_in_app' => false, 'recap_emails' => true, 'recap_in_app' => true])
            ->where('reminderTime', '08:00')
            ->where('remindersEnabled', true));
});

it('saves the notification preferences', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('notificationPreferences.edit'))
        ->patch(route('notificationPreferences.update'), [
            'action_item_reminders_by_email' => false,
            'action_item_reminders_in_app' => true,
            'recap_emails' => true,
            'recap_in_app' => false,
        ])
        ->assertRedirect(route('notificationPreferences.edit'));

    expect($user->fresh()->only(['action_item_reminders_by_email', 'action_item_reminders_in_app', 'recap_emails', 'recap_in_app']))
        ->toBe(['action_item_reminders_by_email' => false, 'action_item_reminders_in_app' => true, 'recap_emails' => true, 'recap_in_app' => false]);
});

it('validates the preferences as booleans', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('notificationPreferences.update'), ['action_item_reminders_by_email' => 'maybe'])
        ->assertSessionHasErrors(['action_item_reminders_by_email', 'action_item_reminders_in_app', 'recap_emails', 'recap_in_app']);
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
