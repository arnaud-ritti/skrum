<?php

namespace App\Support;

use App\Enums\InstanceSettingKey;
use App\Models\InstanceSetting;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use InvalidArgumentException;

class InstanceSettings
{
    public const string CacheKey = 'skrum.instance-settings';

    public const int MinRadius = 0;

    public const int MaxRadius = 16;

    public const string DefaultGifRating = 'g';

    /** @var array<int, string> */
    public const array GifRatings = ['g', 'pg', 'pg-13', 'r'];

    /** @var array<int, string> */
    public const array GifProviders = ['giphy', 'tenor'];

    private const string DefaultAvatarStyle = 'thumbs';

    /** @var ?array<string, mixed> */
    private ?array $stored = null;

    public function brandColor(): ?string
    {
        $color = $this->storedString(InstanceSettingKey::BrandColor);

        if ($color === null) {
            return null;
        }

        if (preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $color) !== 1) {
            return null;
        }

        return $color;
    }

    public function brandRadius(): ?int
    {
        $radius = $this->stored(InstanceSettingKey::BrandRadius);

        if (! is_numeric($radius)) {
            return null;
        }

        return max(self::MinRadius, min(self::MaxRadius, (int) $radius));
    }

    public function displayName(): string
    {
        return $this->storedString(InstanceSettingKey::DisplayName) ?? (string) config('app.name');
    }

    public function poweredBy(): bool
    {
        return $this->storedBool(InstanceSettingKey::PoweredBy) ?? true;
    }

    public function logoLight(): ?string
    {
        return $this->storedString(InstanceSettingKey::LogoLight);
    }

    public function logoDark(): ?string
    {
        return $this->storedString(InstanceSettingKey::LogoDark);
    }

    public function favicon(): ?string
    {
        return $this->storedString(InstanceSettingKey::Favicon);
    }

    public function avatarStyle(): string
    {
        return $this->avatarStyleFrom($this->stored(InstanceSettingKey::AvatarStyle))
            ?? $this->avatarStyleFrom(config('skrum.avatar_style'))
            ?? self::DefaultAvatarStyle;
    }

    public function avatarMemberChoice(): bool
    {
        return $this->storedBool(InstanceSettingKey::AvatarMemberChoice) ?? false;
    }

    public function gifProvider(): ?string
    {
        return $this->oneOf($this->stored(InstanceSettingKey::GifProvider), self::GifProviders)
            ?? $this->oneOf(config('services.gifs.provider'), self::GifProviders);
    }

    public function gifEnabled(): bool
    {
        if ($this->gifProvider() === null) {
            return false;
        }

        if (! $this->hasGifKey()) {
            return false;
        }

        return $this->storedBool(InstanceSettingKey::GifEnabled) ?? true;
    }

    public function gifRating(): string
    {
        return $this->oneOf($this->stored(InstanceSettingKey::GifRating), self::GifRatings)
            ?? $this->oneOf(config('services.gifs.rating'), self::GifRatings)
            ?? self::DefaultGifRating;
    }

    public function gifKey(): ?string
    {
        $encrypted = $this->storedString(InstanceSettingKey::GifKey);

        if ($encrypted === null) {
            return $this->filled(config('services.gifs.key'));
        }

        try {
            return $this->filled(Crypt::decryptString($encrypted));
        } catch (DecryptException) {
            return null;
        }
    }

    public function hasGifKey(): bool
    {
        return $this->gifKey() !== null;
    }

    public function set(string $key, mixed $value): void
    {
        $setting = $this->key($key);

        if ($value === null || $value === '') {
            $this->forget($key);

            return;
        }

        if ($setting === InstanceSettingKey::GifKey) {
            $value = Crypt::encryptString((string) $value);
        }

        InstanceSetting::query()->updateOrCreate(['key' => $setting->value], ['value' => $value]);

        $this->flush();
    }

    public function forget(string $key): void
    {
        InstanceSetting::query()->where('key', $this->key($key)->value)->delete();

        $this->flush();
    }

    /**
     * @return array{
     *     brand_color: ?string,
     *     brand_radius: ?int,
     *     display_name: string,
     *     powered_by: bool,
     *     logo_light: ?string,
     *     logo_dark: ?string,
     *     favicon: ?string,
     *     avatar_style: string,
     *     avatar_member_choice: bool,
     *     gif_provider: ?string,
     *     gif_enabled: bool,
     *     gif_rating: string,
     *     has_gif_key: bool
     * }
     */
    public function all(): array
    {
        return [
            InstanceSettingKey::BrandColor->value => $this->brandColor(),
            InstanceSettingKey::BrandRadius->value => $this->brandRadius(),
            InstanceSettingKey::DisplayName->value => $this->displayName(),
            InstanceSettingKey::PoweredBy->value => $this->poweredBy(),
            InstanceSettingKey::LogoLight->value => $this->logoLight(),
            InstanceSettingKey::LogoDark->value => $this->logoDark(),
            InstanceSettingKey::Favicon->value => $this->favicon(),
            InstanceSettingKey::AvatarStyle->value => $this->avatarStyle(),
            InstanceSettingKey::AvatarMemberChoice->value => $this->avatarMemberChoice(),
            InstanceSettingKey::GifProvider->value => $this->gifProvider(),
            InstanceSettingKey::GifEnabled->value => $this->gifEnabled(),
            InstanceSettingKey::GifRating->value => $this->gifRating(),
            'has_gif_key' => $this->hasGifKey(),
        ];
    }

    private function key(string $key): InstanceSettingKey
    {
        return InstanceSettingKey::tryFrom($key)
            ?? throw new InvalidArgumentException("Unknown instance setting [{$key}].");
    }

    private function flush(): void
    {
        Cache::forget(self::CacheKey);

        $this->stored = null;
    }

    private function stored(InstanceSettingKey $key): mixed
    {
        $this->stored ??= $this->load();

        return $this->stored[$key->value] ?? null;
    }

    /** @return array<string, mixed> */
    private function load(): array
    {
        return Cache::rememberForever(
            self::CacheKey,
            fn (): array => InstanceSetting::query()->get()->pluck('value', 'key')->all(),
        );
    }

    private function storedString(InstanceSettingKey $key): ?string
    {
        return $this->filled($this->stored($key));
    }

    private function storedBool(InstanceSettingKey $key): ?bool
    {
        $value = $this->stored($key);

        return is_bool($value) ? $value : null;
    }

    private function filled(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        return trim($value) === '' ? null : $value;
    }

    /** @param array<int, string> $allowed */
    private function oneOf(mixed $value, array $allowed): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        return in_array($value, $allowed, true) ? $value : null;
    }

    private function avatarStyleFrom(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        return preg_match('/^[a-z0-9-]+$/', $value) === 1 ? $value : null;
    }
}
