<?php

namespace App\Support\Avatars;

use App\Exceptions\InvalidAvatarPhoto;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Photos are stored under a random name that changes with every upload, so
 * an address can be cached for good and says nothing about its owner.
 */
class AvatarPhotos
{
    public const string Disk = 'local';

    public const string Directory = 'avatars';

    public const string FilePattern = '[a-z0-9]{40}\.(jpg|png)';

    /** @var array<string, string> */
    private const array Extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png'];

    /** @var array<string, string> */
    private const array MimeTypes = ['jpg' => 'image/jpeg', 'png' => 'image/png'];

    /**
     * The previous path is read from the locked row, so two uploads at once
     * never leave a file that nothing points to.
     *
     * @throws InvalidAvatarPhoto
     */
    public function store(User $user, UploadedFile $file): void
    {
        $mime = (string) $file->getMimeType();
        $extension = self::Extensions[$mime] ?? throw InvalidAvatarPhoto::unreadable();
        $clean = ImageMetadata::strip((string) $file->get(), $mime) ?? throw InvalidAvatarPhoto::unreadable();
        $path = self::Directory.'/'.Str::lower(Str::random(40)).".{$extension}";

        throw_if($this->disk()->put($path, $clean) === false, RuntimeException::class, 'The avatar photo could not be written.');

        $previous = DB::transaction(function () use ($user, $path): ?string {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $previous = $locked->avatar_photo_path;

            $locked->forceFill(['avatar_photo_path' => $path])->save();

            return $previous;
        });

        $user->forceFill(['avatar_photo_path' => $path])->syncOriginalAttribute('avatar_photo_path');

        $this->delete($previous);
    }

    public function delete(?string $path): void
    {
        if ($path === null) {
            return;
        }

        if (preg_match('#^'.self::Directory.'/'.self::FilePattern.'$#D', $path) !== 1) {
            return;
        }

        $this->disk()->delete($path);
    }

    /**
     * @return array{
     *     contents: string,
     *     mime: string
     * }|null
     */
    public function read(string $file): ?array
    {
        if (preg_match('#^'.self::FilePattern.'$#D', $file) !== 1) {
            return null;
        }

        $contents = $this->disk()->get(self::Directory."/{$file}");

        if ($contents === null) {
            return null;
        }

        return ['contents' => $contents, 'mime' => self::MimeTypes[Str::afterLast($file, '.')]];
    }

    public function url(string $path): string
    {
        return route('avatarPhotos.show', basename($path), absolute: false);
    }

    private function disk(): Filesystem
    {
        return Storage::disk(self::Disk);
    }
}
