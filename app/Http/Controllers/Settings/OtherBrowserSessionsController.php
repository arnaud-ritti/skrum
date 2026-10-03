<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\Settings\BrowserSessions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OtherBrowserSessionsController extends Controller
{
    public function destroy(Request $request, BrowserSessions $sessions): RedirectResponse
    {
        abort_unless($sessions->available(), 404);

        $sessions->signOutOthers($request->user(), $request->session()->getId());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Other sessions signed out.')]);

        return back();
    }
}
