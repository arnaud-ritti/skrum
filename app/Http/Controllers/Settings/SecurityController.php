<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\RevokeLoginSecrets;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class SecurityController extends Controller
{
    /**
     * Update the user's password.
     */
    public function update(PasswordUpdateRequest $request, RevokeLoginSecrets $revoke): RedirectResponse
    {
        $request->user()->forceFill([
            'password' => $request->password,
            'password_set_at' => now(),
        ])->save();

        $revoke->handle($request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Password updated.')]);

        return back();
    }
}
