<?php

namespace App\Support\Branding;

use App\Enums\InstanceSettingKey;
use App\Exceptions\InvalidBrandAsset;
use App\Support\InstanceSettings;
use finfo;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

class BrandAssets
{
    public const string Disk = 'local';

    public const string Directory = 'branding';

    public const int MaxBytes = 512 * 1024;

    /** @var array<int, string> */
    public const array Names = ['logo-light', 'logo-dark', 'favicon'];

    /** @var array<string, string> */
    public const array MimeTypes = [
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
    ];

    /** @var array<int, string> */
    private const array RasterMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];

    /** @var array<int, string> */
    private const array MarkupMimeTypes = ['image/svg+xml', 'text/xml', 'application/xml', 'text/plain', 'text/html'];

    private const string StoredPathPattern = '/^branding\/[a-z0-9]{40}\.(png|jpg|webp|svg)$/D';

    private const string SvgPattern = '/^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--.*?-->\s*)*(?:<!DOCTYPE[^>\[]*>\s*)?(?:<!--.*?-->\s*)*<svg[\s>\/]/is';

    public function __construct(private InstanceSettings $settings) {}

    /**
     * @throws InvalidBrandAsset
     */
    public function store(string $asset, UploadedFile $file): void
    {
        $key = $this->key($asset);
        $extension = array_search($this->contentType($file), self::MimeTypes, true);
        $previousPath = $this->storedPath($key);
        $name = Str::lower(Str::random(40)).".{$extension}";

        throw_if(
            $this->disk()->putFileAs(self::Directory, $file, $name) === false,
            RuntimeException::class,
            "The brand asset [{$asset}] could not be written.",
        );

        $this->settings->set($key->value, self::Directory."/{$name}");

        $this->delete($previousPath);
    }

    public function remove(string $asset): void
    {
        $key = $this->key($asset);
        $path = $this->storedPath($key);

        $this->settings->forget($key->value);

        $this->delete($path);
    }

    public function url(string $asset): ?string
    {
        $path = $this->existingPath($asset);

        if ($path === null) {
            return null;
        }

        return route('brand.show', ['asset' => $asset, 'v' => substr(hash('sha256', $path), 0, 16)], absolute: false);
    }

    public function mime(string $asset): ?string
    {
        $path = $this->existingPath($asset);

        if ($path === null) {
            return null;
        }

        return self::MimeTypes[pathinfo($path, PATHINFO_EXTENSION)];
    }

    /**
     * @return array{
     *     contents: string,
     *     mime: string
     * }|null
     */
    public function read(string $asset): ?array
    {
        $path = $this->existingPath($asset);

        if ($path === null) {
            return null;
        }

        $contents = $this->disk()->get($path);

        if ($contents === null) {
            return null;
        }

        return [
            'contents' => $contents,
            'mime' => self::MimeTypes[pathinfo($path, PATHINFO_EXTENSION)],
        ];
    }

    private function key(string $asset): InstanceSettingKey
    {
        return match ($asset) {
            'logo-light' => InstanceSettingKey::LogoLight,
            'logo-dark' => InstanceSettingKey::LogoDark,
            'favicon' => InstanceSettingKey::Favicon,
            default => throw new InvalidArgumentException("Unknown brand asset [{$asset}]."),
        };
    }

    /**
     * The setting is trusted only when it has the shape this class writes: a tampered row never names another file.
     */
    private function storedPath(InstanceSettingKey $key): ?string
    {
        $path = match ($key) {
            InstanceSettingKey::LogoLight => $this->settings->logoLight(),
            InstanceSettingKey::LogoDark => $this->settings->logoDark(),
            default => $this->settings->favicon(),
        };

        if ($path === null) {
            return null;
        }

        return preg_match(self::StoredPathPattern, $path) === 1 ? $path : null;
    }

    private function existingPath(string $asset): ?string
    {
        $path = $this->storedPath($this->key($asset));

        if ($path === null) {
            return null;
        }

        return $this->disk()->exists($path) ? $path : null;
    }

    private function delete(?string $path): void
    {
        if ($path === null) {
            return;
        }

        $this->disk()->delete($path);
    }

    /**
     * The type is read from the bytes: the client name and the client type are never looked at.
     *
     * @throws InvalidBrandAsset
     */
    private function contentType(UploadedFile $file): string
    {
        $path = $file->getRealPath();

        if ($path === false || ! $file->isValid()) {
            throw InvalidBrandAsset::unsupportedType();
        }

        if (filesize($path) > self::MaxBytes) {
            throw InvalidBrandAsset::tooLarge();
        }

        $sniffed = (new finfo(FILEINFO_MIME_TYPE))->file($path);

        if (in_array($sniffed, self::RasterMimeTypes, true)) {
            return $sniffed;
        }

        if (! in_array($sniffed, self::MarkupMimeTypes, true)) {
            throw InvalidBrandAsset::unsupportedType();
        }

        if (! $this->isSvg((string) file_get_contents($path))) {
            throw InvalidBrandAsset::unsupportedType();
        }

        return 'image/svg+xml';
    }

    private function isSvg(string $contents): bool
    {
        if (str_starts_with($contents, "\xEF\xBB\xBF")) {
            $contents = substr($contents, 3);
        }

        return preg_match(self::SvgPattern, $contents) === 1;
    }

    private function disk(): Filesystem
    {
        return Storage::disk(self::Disk);
    }
}
