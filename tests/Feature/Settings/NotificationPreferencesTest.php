<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('turns both reminder channels on by default', function () {
    $user = User::factory()->create()->fresh();

    expect($user->action_item_reminders_by_email)->toBeTrue()
        ->and($user->action_item_reminders_in_app)->toBeTrue()
        ->and($user->recap_emails)->toBeTrue()
        ->and($user->recap_in_app)->toBeTrue();
});

it('shows the notification preferences', function () {
    $user = User::factory()->create();
    $user->forceFill(['action_item_reminders_in_app' => false])->save();

    $this->actingAs($user)
        ->get(route('settings.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/account')
            ->where('notificationPreferences.preferences', ['action_item_reminders_by_email' => true, 'action_item_reminders_in_app' => false, 'recap_emails' => true, 'recap_in_app' => true])
            ->where('notificationPreferences.reminderTime', '08:00')
            ->where('notificationPreferences.reminderTimezone', config('app.timezone'))
            ->where('notificationPreferences.remindersEnabled', true));
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
