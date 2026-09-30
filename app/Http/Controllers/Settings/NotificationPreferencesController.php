<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationPreferencesController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('settings/notifications', [
            'preferences' => [
                'action_item_reminders_by_email' => $user->action_item_reminders_by_email,
                'action_item_reminders_in_app' => $user->action_item_reminders_in_app,
            ],
            'reminderTime' => (string) config('skrum.action_item_reminders.time'),
            'remindersEnabled' => (bool) config('skrum.action_item_reminders.enabled'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'action_item_reminders_by_email' => ['required', 'boolean'],
            'action_item_reminders_in_app' => ['required', 'boolean'],
        ]);

        $request->user()->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Notification settings saved.')]);

        return back();
    }
}
