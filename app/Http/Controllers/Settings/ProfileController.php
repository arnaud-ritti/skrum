<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\RevokeLoginSecrets;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Auth\LoginAddress;
use App\Support\Auth\PasswordConfirmation;
use App\Support\Avatars\AvatarPhotos;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ProfileController extends Controller
{
    /**
     * Update the user's profile information. A new login address asks for a
     * recent password confirmation, as the `password.confirm` middleware of
     * the other account settings does: whoever holds the session could
     * otherwise move the account to their own address and reset its password.
     */
    public function update(ProfileUpdateRequest $request, RevokeLoginSecrets $revoke, PasswordConfirmation $confirmation): RedirectResponse|JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $emailChanged = LoginAddress::normalise($validated['email']) !== LoginAddress::normalise($user->email);

        if ($emailChanged && ! $confirmation->isSatisfied($request)) {
            return $request->expectsJson()
                ? response()->json(['message' => 'Password confirmation required.'], 423)
                : redirect()->guest(route('password.confirm'));
        }

        $user->fill($emailChanged ? $validated : Arr::except($validated, 'email'));

        if ($emailChanged) {
            $user->email_verified_at = null;
        }

        $user->save();

        if ($emailChanged) {
            $revoke->handle($user, turnEmailFactorOff: true);
            $user->sendEmailVerificationNotification();
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

            $workspaces = $user->workspaces()->orderBy('workspaces.id')->lockForUpdate()->get();

            $this->ensureNoSharedWorkspaceIsLeftWithoutOwner($user, $workspaces);

            $workspaces
                ->filter(fn (Workspace $workspace): bool => $workspace->members()->count() === 1)
                ->each->delete();

            $user->tokens()->delete();

            $user->delete();
        });

        Auth::logoutCurrentDevice();

        $photos->delete($photoPath);

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * The request checked this already; it is checked again under the workspace locks, so an owner
     * demoted or leaving at the same time cannot leave a shared workspace with no owner.
     *
     * @param  Collection<int, Workspace>  $workspaces
     */
    private function ensureNoSharedWorkspaceIsLeftWithoutOwner(User $user, Collection $workspaces): void
    {
        $isSoleOwnerOfSharedWorkspace = $workspaces->contains(fn (Workspace $workspace): bool => $workspace->owners()->pluck('users.id')->all() === [$user->id]
            && $workspace->members()->count() > 1);

        if (! $isSoleOwnerOfSharedWorkspace) {
            return;
        }

        throw ValidationException::withMessages([
            'password' => __('Transfer ownership of your workspaces before deleting your account.'),
        ]);
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
