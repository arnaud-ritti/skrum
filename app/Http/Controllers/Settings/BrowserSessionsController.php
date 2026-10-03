<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\Settings\BrowserSessions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BrowserSessionsController extends Controller
{
    public function destroy(Request $request, string $sessionKey, BrowserSessions $sessions): RedirectResponse
    {
        abort_unless($sessions->available(), 404);

        abort_unless($sessions->signOut($request->user(), $sessionKey, $request->session()->getId()), 404);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Device signed out.')]);

        return back();
    }
}
