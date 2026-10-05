<?php

use App\Models\User;
use App\Support\Avatars\PresenceColor;
use App\Support\Mail\MailBrand;

it('derives the presence colour of a user who never chose one, as mail does', function () {
    $user = User::factory()->create();

    expect($user->presence_color)->toBeNull()
        ->and($user->presenceColor())->toBe(PresenceColor::forSeed($user->avatarSeed()))
        ->and($user->presenceColor())->toBe(MailBrand::presence($user->avatarSeed()));
});

it('uses the colour the user chose', function () {
    $user = User::factory()->create(['presence_color' => 7]);

    expect($user->presenceColor())->toBe(7);
});

it('starts with animations on and a known password, and hides the photo path and the password date', function () {
    $user = User::factory()->create();
    $user->forceFill(['avatar_photo_path' => 'avatars/'.str_repeat('a', 40).'.jpg'])->save();

    expect($user->fresh()->reduce_motion)->toBeFalse()
        ->and($user->fresh()->password_set_at)->not->toBeNull()
        ->and($user->fresh()->toArray())->not->toHaveKeys(['avatar_photo_path', 'password_set_at']);
});
