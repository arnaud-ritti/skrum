<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\RevokeLoginSecrets;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Auth\LoginAddress;
use App\Support\Avatars\AvatarPhotos;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ProfileController extends Controller
{
    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request, RevokeLoginSecrets $revoke): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $emailChanged = LoginAddress::normalise($validated['email']) !== LoginAddress::normalise($user->email);

        $user->fill($emailChanged ? $validated : Arr::except($validated, 'email'));

        if ($emailChanged) {
            $user->email_verified_at = null;
        }

        $user->save();

        if ($emailChanged) {
            $revoke->handle($user, turnEmailFactorOff: true);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile updated.')]);

        return to_route('settings.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request, AvatarPhotos $photos): RedirectResponse
    {
        $user = $request->user();
        $photoPath = $user->avatar_photo_path;

        DB::transaction(function () use ($user): void {
            $this->ensureAnotherInstanceAdminRemains($user);

            Auth::logout();

            $user->workspaces()
                ->get()
                ->filter(fn (Workspace $workspace): bool => $workspace->members()->count() === 1)
                ->each->delete();

            $user->tokens()->delete();

            $user->delete();
        });

        $photos->delete($photoPath);

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * Every admin row is locked before the count, so the last two admins cannot both leave at the same time.
     */
    private function ensureAnotherInstanceAdminRemains(User $user): void
    {
        $adminIds = User::query()
            ->where('is_instance_admin', true)
            ->orderBy('id')
            ->lockForUpdate()
            ->pluck('id');

        if ($adminIds->doesntContain($user->id)) {
            return;
        }

        if ($adminIds->count() > 1) {
            return;
        }

        throw ValidationException::withMessages([
            'password' => __('Name another instance admin before deleting your account.'),
        ]);
    }
}
