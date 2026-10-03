<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\DeactivateUser;
use App\Actions\Admin\ReactivateUser;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class UserDeactivationsController extends Controller
{
    public function store(Request $request, User $user, DeactivateUser $deactivateUser): RedirectResponse
    {
        if (! $deactivateUser->handle($request->user(), $user)) {
            throw ValidationException::withMessages([
                'user' => __('You cannot deactivate your own account or the last active admin.'),
            ]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Account deactivated.')]);

        return back();
    }

    public function destroy(Request $request, User $user, ReactivateUser $reactivateUser): RedirectResponse
    {
        $reactivateUser->handle($request->user(), $user);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Account reactivated.')]);

        return back();
    }
}
