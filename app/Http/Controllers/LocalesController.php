<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LocalesController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'locale' => ['required', 'string', Rule::in(config('skrum.locales'))],
        ]);

        $request->user()?->update(['locale' => $validated['locale']]);

        return back()->withCookie(cookie()->forever('locale', $validated['locale']));
    }
}
