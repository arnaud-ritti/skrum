<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;

class ReminderUnsubscribesController extends Controller
{
    public function show(User $user): Response
    {
        return Inertia::render('auth/reminder-unsubscribe', [
            'unsubscribed' => ! $user->action_item_reminders_by_email,
            'confirmUrl' => URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]),
        ]);
    }

    public function store(Request $request, User $user): RedirectResponse|HttpResponse
    {
        $user->forceFill(['action_item_reminders_by_email' => false])->save();

        if ($request->input('List-Unsubscribe') === 'One-Click') {
            return response()->noContent();
        }

        return redirect(URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]));
    }
}
