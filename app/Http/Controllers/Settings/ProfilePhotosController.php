<?php

namespace App\Http\Controllers\Settings;

use App\Exceptions\InvalidAvatarPhoto;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfilePhotoRequest;
use App\Support\Avatars\AvatarPhotos;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\InstanceSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ProfilePhotosController extends Controller
{
    public function store(ProfilePhotoRequest $request, AvatarPhotos $photos): RedirectResponse
    {
        try {
            $photos->store($request->user(), $request->file('photo'));
        } catch (InvalidAvatarPhoto $exception) {
            throw ValidationException::withMessages(['photo' => $exception->getMessage()]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Photo updated.')]);

        return to_route('settings.edit');
    }

    /**
     * Without the member style choice, removing the photo leaves the style alone: the member could not pick it back.
     */
    public function destroy(Request $request, AvatarPhotos $photos, InstanceSettings $settings): RedirectResponse
    {
        $user = $request->user();
        $path = $user->avatar_photo_path;
        $useInitials = $request->boolean('initials') && $settings->avatarMemberChoice();

        $user->forceFill([
            'avatar_photo_path' => null,
            ...($useInitials ? ['avatar_style' => AvatarStyleCatalogue::Initials] : []),
        ])->save();

        $photos->delete($path);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Photo removed.')]);

        return to_route('settings.edit');
    }
}
