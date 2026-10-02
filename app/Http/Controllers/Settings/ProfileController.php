<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\Avatars\AvatarUrl;
use App\Support\InstanceSettings;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request, InstanceSettings $settings, AvatarStyleCatalogue $catalogue, AvatarUrl $avatarUrl): Response
    {
        $user = $request->user();
        $allowsMemberStyles = $settings->avatarMemberChoice();

        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            'avatarMemberChoice' => $allowsMemberStyles,
            'avatarStyle' => $allowsMemberStyles ? $user->avatar_style : null,
            'instanceAvatarStyle' => $avatarUrl->instanceStyle(),
            'avatarStyles' => $allowsMemberStyles ? $this->avatarStyles($catalogue, $avatarUrl, $user) : [],
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile updated.')]);

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

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

    /**
     * @return array<int, array{
     *     value: string,
     *     name: string,
     *     license: string,
     *     attribution: ?string,
     *     attributionRequired: bool,
     *     sampleUrls: array<int, string>
     * }>
     */
    private function avatarStyles(AvatarStyleCatalogue $catalogue, AvatarUrl $avatarUrl, User $user): array
    {
        return array_map(fn (array $style): array => [
            ...$style,
            'sampleUrls' => [$avatarUrl->url($style['value'], $user->avatarSeed(), fn (): string => $user->name)],
        ], $catalogue->styles());
    }
}
