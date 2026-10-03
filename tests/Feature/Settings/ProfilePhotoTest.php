<?php

use App\Models\Retro;
use App\Models\User;
use App\Support\Avatars\AvatarPhotos;
use App\Support\InstanceSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('local');
    resolve(InstanceSettings::class)->set('profile_photos', true);
    resolve(InstanceSettings::class)->set('avatar_member_choice', true);
});

function photoUpload(string $bytes, string $name = 'me.jpg'): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, $bytes);
}

it('stores a photo without its metadata and shows it as the avatar', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.edit'));

    $path = $user->fresh()->avatar_photo_path;

    expect($path)->toMatch('#^avatars/[a-z0-9]{40}\.jpg$#')
        ->and(Storage::disk('local')->get($path))->toBe(jpegBytes(withExif: false))
        ->and($user->fresh()->avatarUrl())->toBe(route('avatarPhotos.show', basename($path), absolute: false));
});

it('serves the photo, cached for good and inert', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(pngBytes(), 'me.png')]);
    auth()->logout();

    $this->get($user->fresh()->avatarUrl())
        ->assertOk()
        ->assertHeader('Content-Type', 'image/png')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public')
        ->assertHeader('X-Content-Type-Options', 'nosniff');
});

it('shows the photo of a member in a retro', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);

    expect($participant->fresh()->avatarUrl())->toBe($user->fresh()->avatarUrl())
        ->and($participant->fresh()->avatarUrl())->toStartWith('/avatar-photos/');
});

it('refuses what is not a small JPEG or PNG', function (Closure $file) {
    $this->actingAs(User::factory()->create())
        ->post(route('profilePhotos.store'), ['photo' => $file()])
        ->assertSessionHasErrors('photo');
})->with([
    'gif' => [fn () => photoUpload("GIF89a\x01\0\x01\0\0\0\0;", 'me.gif')],
    'svg' => [fn () => photoUpload('<svg xmlns="http://www.w3.org/2000/svg"/>', 'me.svg')],
    'too heavy' => [fn () => UploadedFile::fake()->create('me.jpg', 1100, 'image/jpeg')],
    'unreadable jpeg' => [fn () => photoUpload("\xFF\xD8\xFF\xE0garbage", 'me.jpg')],
]);

it('replaces the previous photo and deletes its file', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);
    $first = $user->fresh()->avatar_photo_path;

    $this->post(route('profilePhotos.store'), ['photo' => photoUpload(pngBytes(), 'me.png')]);

    Storage::disk('local')->assertMissing($first);
    expect($user->fresh()->avatar_photo_path)->not->toBe($first);
});

it('goes back to initials and deletes the file', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);
    $path = $user->fresh()->avatar_photo_path;

    $this->delete(route('profilePhotos.destroy'), ['initials' => true])->assertRedirect(route('settings.edit'));

    Storage::disk('local')->assertMissing($path);
    expect($user->fresh()->avatar_photo_path)->toBeNull()
        ->and($user->fresh()->avatar_style)->toBe('initials');
});

it('neither offers nor shows photos while the switch "Profile photos" is off, and keeps the file', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);
    $path = $user->fresh()->avatar_photo_path;
    resolve(InstanceSettings::class)->set('profile_photos', false);

    expect($user->fresh()->avatarUrl())->not->toStartWith('/avatar-photos/');
    Storage::disk('local')->assertExists($path);
    $this->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())])->assertForbidden();
    $this->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('profile.photosAllowed', false)
        ->where('profile.hasPhoto', false));
});

it('keeps "Profile photos" off on an instance that never set it', function () {
    resolve(InstanceSettings::class)->set('profile_photos', null);

    expect(resolve(InstanceSettings::class)->profilePhotos())->toBeFalse();
    $this->actingAs(User::factory()->create())
        ->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())])
        ->assertForbidden();
});

it('shows a photo while members cannot choose their style, and removes it without touching the style', function () {
    $user = User::factory()->create(['avatar_style' => 'thumbs']);
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);
    resolve(InstanceSettings::class)->set('avatar_member_choice', false);

    expect($user->fresh()->avatarUrl())->toStartWith('/avatar-photos/');

    $this->delete(route('profilePhotos.destroy'), ['initials' => true])->assertRedirect(route('settings.edit'));

    expect($user->fresh()->avatar_photo_path)->toBeNull()
        ->and($user->fresh()->avatar_style)->toBe('thumbs');
});

it('deletes the photo with the account', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);
    $path = $user->fresh()->avatar_photo_path;

    $this->delete(route('profile.destroy'), ['password' => 'password']);

    Storage::disk('local')->assertMissing($path);
});

it('answers 404 for a file that is not a stored photo', function (string $file) {
    $this->get("/avatar-photos/{$file}")->assertNotFound();
})->with([str_repeat('a', 40).'.jpg', '..%2F.env', 'x.jpg']);

it('deletes the photo stored by an upload that finished in between', function () {
    $user = User::factory()->create();
    $stale = $user->fresh();
    resolve(AvatarPhotos::class)->store($user, photoUpload(jpegBytes()));
    $between = $user->fresh()->avatar_photo_path;

    resolve(AvatarPhotos::class)->store($stale, photoUpload(pngBytes(), 'me.png'));

    expect(Storage::disk('local')->allFiles('avatars'))->toBe([$stale->avatar_photo_path])
        ->and($user->fresh()->avatar_photo_path)->toBe($stale->avatar_photo_path)
        ->and($between)->not->toBe($stale->avatar_photo_path);
});
