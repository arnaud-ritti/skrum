<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;

class RecapUnsubscribesController extends Controller
{
    public function show(User $user): Response
    {
        return Inertia::render('auth/recap-unsubscribe', [
            'unsubscribed' => ! $user->recap_emails,
            'confirmUrl' => URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]),
        ]);
    }

    public function store(Request $request, User $user): RedirectResponse|HttpResponse
    {
        $user->forceFill(['recap_emails' => false])->save();

        if ($request->input('List-Unsubscribe') === 'One-Click') {
            return response()->noContent();
        }

        return redirect(URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]));
    }
}
