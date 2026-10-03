<?php

namespace App\Support;

use App\Enums\InstanceSettingKey;
use App\Models\InstanceSetting;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use SensitiveParameter;

class InstanceSettings
{
    public const string CacheKey = 'skrum.instance-settings';

    public const int MinRadius = 0;

    public const int MaxRadius = 16;

    public const string DefaultGifRating = 'g';

    public const bool DefaultPoweredBy = true;

    public const bool DefaultAvatarMemberChoice = false;

    public const bool DefaultProfilePhotos = false;

    public const bool DefaultSsoRequired = false;

    /** Without a provider and a key GIFs stay off whatever this switch says. */
    public const bool DefaultGifEnabled = true;

    /** @var array<int, string> */
    public const array GifRatings = ['g', 'pg', 'pg-13', 'r'];

    /** @var array<int, string> */
    public const array GifProviders = ['giphy', 'tenor'];

    private const string DefaultAvatarStyle = 'thumbs';

    private const int CacheTtlSeconds = 300;

    /** @var ?array<string, mixed> */
    private ?array $stored = null;

    private bool $hasUncommittedWrite = false;

    public function brandColor(): ?string
    {
        $color = $this->storedString(InstanceSettingKey::BrandColor);

        if ($color === null) {
            return null;
        }

        if (preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/D', $color) !== 1) {
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
        return $this->storedDisplayName() ?? $this->defaultDisplayName();
    }

    public function storedDisplayName(): ?string
    {
        return $this->storedString(InstanceSettingKey::DisplayName);
    }

    public function defaultDisplayName(): string
    {
        return (string) config('app.name');
    }

    public function poweredBy(): bool
    {
        return $this->storedPoweredBy() ?? self::DefaultPoweredBy;
    }

    public function storedPoweredBy(): ?bool
    {
        return $this->storedBool(InstanceSettingKey::PoweredBy);
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

    public function logoMail(): ?string
    {
        return $this->storedString(InstanceSettingKey::LogoMail);
    }

    public function avatarStyle(): string
    {
        return $this->storedAvatarStyle() ?? $this->defaultAvatarStyle();
    }

    public function storedAvatarStyle(): ?string
    {
        return $this->avatarStyleFrom($this->stored(InstanceSettingKey::AvatarStyle));
    }

    public function defaultAvatarStyle(): string
    {
        return $this->avatarStyleFrom(config('skrum.avatar_style')) ?? self::DefaultAvatarStyle;
    }

    public function avatarMemberChoice(): bool
    {
        return $this->storedAvatarMemberChoice() ?? self::DefaultAvatarMemberChoice;
    }

    public function storedAvatarMemberChoice(): ?bool
    {
        return $this->storedBool(InstanceSettingKey::AvatarMemberChoice);
    }

    public function profilePhotos(): bool
    {
        return $this->storedProfilePhotos() ?? self::DefaultProfilePhotos;
    }

    public function storedProfilePhotos(): ?bool
    {
        return $this->storedBool(InstanceSettingKey::ProfilePhotos);
    }

    public function gifProvider(): ?string
    {
        return $this->storedGifProvider() ?? $this->defaultGifProvider();
    }

    public function storedGifProvider(): ?string
    {
        return $this->oneOf($this->stored(InstanceSettingKey::GifProvider), self::GifProviders);
    }

    public function defaultGifProvider(): ?string
    {
        return $this->oneOf(config('services.gifs.provider'), self::GifProviders);
    }

    public function gifEnabled(): bool
    {
        if ($this->gifProvider() === null) {
            return false;
        }

        if (! $this->hasGifKey()) {
            return false;
        }

        return $this->storedGifEnabled() ?? self::DefaultGifEnabled;
    }

    public function storedGifEnabled(): ?bool
    {
        return $this->storedBool(InstanceSettingKey::GifEnabled);
    }

    public function gifRating(): string
    {
        return $this->storedGifRating() ?? $this->defaultGifRating();
    }

    public function storedGifRating(): ?string
    {
        return $this->oneOf($this->stored(InstanceSettingKey::GifRating), self::GifRatings);
    }

    public function defaultGifRating(): string
    {
        return $this->oneOf(config('services.gifs.rating'), self::GifRatings) ?? self::DefaultGifRating;
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

    public function set(string $key, #[SensitiveParameter] mixed $value): void
    {
        $this->setMany([$key => $value]);
    }

    /** @param array<string, mixed> $values */
    public function setMany(#[SensitiveParameter] array $values): void
    {
        $normalised = [];

        foreach ($values as $key => $value) {
            $setting = $this->key($key);
            $normalised[$setting->value] = $this->normalise($setting, $value);
        }

        DB::transaction(function () use ($normalised): void {
            foreach ($normalised as $key => $value) {
                $this->write($key, $value);
            }
        });

        $this->invalidateAfterCommit();
    }

    public function forget(string $key): void
    {
        $this->write($this->key($key)->value, null);

        $this->invalidateAfterCommit();
    }

    public function ssoRequired(): bool
    {
        return $this->storedBool(InstanceSettingKey::SsoRequired) ?? self::DefaultSsoRequired;
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
     *     profile_photos: bool,
     *     gif_provider: ?string,
     *     gif_enabled: bool,
     *     gif_rating: string,
     *     has_gif_key: bool,
     *     sso_required: bool
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
            InstanceSettingKey::ProfilePhotos->value => $this->profilePhotos(),
            InstanceSettingKey::GifProvider->value => $this->gifProvider(),
            InstanceSettingKey::GifEnabled->value => $this->gifEnabled(),
            InstanceSettingKey::GifRating->value => $this->gifRating(),
            'has_gif_key' => $this->hasGifKey(),
            InstanceSettingKey::SsoRequired->value => $this->ssoRequired(),
        ];
    }

    private function key(string $key): InstanceSettingKey
    {
        return InstanceSettingKey::tryFrom($key)
            ?? throw new InvalidArgumentException("Unknown instance setting [{$key}].");
    }

    private function write(string $key, #[SensitiveParameter] mixed $value): void
    {
        if ($value === null) {
            InstanceSetting::query()->where('key', $key)->delete();

            return;
        }

        InstanceSetting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }

    private function normalise(InstanceSettingKey $key, #[SensitiveParameter] mixed $value): mixed
    {
        if (is_string($value)) {
            $value = trim($value);
        }

        if ($value === null || $value === '') {
            return null;
        }

        return match ($key) {
            InstanceSettingKey::PoweredBy,
            InstanceSettingKey::AvatarMemberChoice,
            InstanceSettingKey::ProfilePhotos,
            InstanceSettingKey::GifEnabled,
            InstanceSettingKey::SsoRequired => $this->booleanFrom($key, $value),
            InstanceSettingKey::BrandRadius => $this->integerFrom($key, $value),
            InstanceSettingKey::GifKey => Crypt::encryptString($this->stringFrom($key, $value)),
            default => $value,
        };
    }

    private function booleanFrom(InstanceSettingKey $key, mixed $value): bool
    {
        $boolean = is_scalar($value)
            ? filter_var($value, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
            : null;

        return $boolean ?? throw new InvalidArgumentException("Instance setting [{$key->value}] expects a boolean.");
    }

    private function integerFrom(InstanceSettingKey $key, mixed $value): int
    {
        if (! is_numeric($value)) {
            throw new InvalidArgumentException("Instance setting [{$key->value}] expects a number.");
        }

        return (int) $value;
    }

    private function stringFrom(InstanceSettingKey $key, #[SensitiveParameter] mixed $value): string
    {
        if (! is_string($value)) {
            throw new InvalidArgumentException("Instance setting [{$key->value}] expects a string.");
        }

        return $value;
    }

    /**
     * Until the write is committed this instance reads the table directly, so uncommitted rows never reach the cache.
     */
    private function invalidateAfterCommit(): void
    {
        $this->hasUncommittedWrite = true;
        $this->stored = null;

        DB::afterCommit(function (): void {
            Cache::forget(self::CacheKey);

            $this->hasUncommittedWrite = false;
            $this->stored = null;
        });
    }

    private function stored(InstanceSettingKey $key): mixed
    {
        if ($this->hasUncommittedWrite) {
            return $this->rows()[$key->value] ?? null;
        }

        $this->stored ??= $this->load() ?? [];

        return $this->stored[$key->value] ?? null;
    }

    /** @return ?array<string, mixed> */
    private function load(): ?array
    {
        $cached = Cache::get(self::CacheKey);

        if (is_array($cached)) {
            return $cached;
        }

        $rows = $this->rows();

        if ($rows === null) {
            return null;
        }

        Cache::put(self::CacheKey, $rows, self::CacheTtlSeconds);

        return $rows;
    }

    /**
     * Null when the table cannot be read, as between a deploy and its migration.
     * Inside a transaction the read runs under a savepoint: PostgreSQL aborts
     * the whole transaction on a failed query, and the caller's must survive.
     *
     * @return ?array<string, mixed>
     */
    private function rows(): ?array
    {
        $connection = InstanceSetting::query()->getConnection();
        $read = fn (): array => InstanceSetting::query()->get()->pluck('value', 'key')->all();

        try {
            return $connection->transactionLevel() > 0 ? $connection->transaction($read) : $read();
        } catch (QueryException) {
            return null;
        }
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

        return preg_match('/^[a-z0-9-]+$/D', $value) === 1 ? $value : null;
    }
}
