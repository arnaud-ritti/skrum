<?php

use App\Enums\InstanceSettingKey;
use App\Models\InstanceSetting;
use App\Support\InstanceSettings;
use Illuminate\Cache\Events\KeyForgotten;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Support\MissingTables;

function freshInstanceSettings(): InstanceSettings
{
    app()->forgetScopedInstances();

    return resolve(InstanceSettings::class);
}

beforeEach(function () {
    config([
        'app.name' => 'Configured Name',
        'skrum.avatar_style' => 'thumbs',
        'services.gifs' => ['provider' => 'giphy', 'key' => 'config-gif-key', 'rating' => 'pg'],
    ]);
});

it('falls back to the configuration when nothing is stored', function () {
    $settings = resolve(InstanceSettings::class);

    expect($settings->displayName())->toBe('Configured Name')
        ->and($settings->avatarStyle())->toBe('thumbs')
        ->and($settings->gifProvider())->toBe('giphy')
        ->and($settings->gifRating())->toBe('pg')
        ->and($settings->gifKey())->toBe('config-gif-key')
        ->and($settings->hasGifKey())->toBeTrue()
        ->and($settings->gifEnabled())->toBeTrue();
});

it('uses the built-in defaults when nothing is stored', function () {
    $settings = resolve(InstanceSettings::class);

    expect($settings->brandColor())->toBeNull()
        ->and($settings->brandRadius())->toBeNull()
        ->and($settings->poweredBy())->toBeTrue()
        ->and($settings->logoLight())->toBeNull()
        ->and($settings->logoDark())->toBeNull()
        ->and($settings->favicon())->toBeNull()
        ->and($settings->avatarMemberChoice())->toBeFalse();
});

it('rates gifs g when neither a setting nor the configuration gives a rating', function () {
    config(['services.gifs.rating' => null]);

    expect(resolve(InstanceSettings::class)->gifRating())->toBe('g');
});

it('has no gif provider, no key and no gifs when the configuration is empty', function () {
    config(['services.gifs' => ['provider' => null, 'key' => '', 'rating' => 'pg']]);

    $settings = resolve(InstanceSettings::class);

    expect($settings->gifProvider())->toBeNull()
        ->and($settings->gifKey())->toBeNull()
        ->and($settings->hasGifKey())->toBeFalse()
        ->and($settings->gifEnabled())->toBeFalse();
});

it('prefers the stored value over the configuration', function (InstanceSettingKey $key, mixed $value, string $getter, mixed $expected) {
    InstanceSetting::factory()->keyed($key, $value)->create();

    expect(resolve(InstanceSettings::class)->{$getter}())->toBe($expected);
})->with([
    'brand colour' => [InstanceSettingKey::BrandColor, '#2B63B0', 'brandColor', '#2B63B0'],
    'brand radius' => [InstanceSettingKey::BrandRadius, 12, 'brandRadius', 12],
    'display name' => [InstanceSettingKey::DisplayName, 'Acme Retros', 'displayName', 'Acme Retros'],
    'powered by' => [InstanceSettingKey::PoweredBy, false, 'poweredBy', false],
    'light logo' => [InstanceSettingKey::LogoLight, 'branding/light.png', 'logoLight', 'branding/light.png'],
    'dark logo' => [InstanceSettingKey::LogoDark, 'branding/dark.png', 'logoDark', 'branding/dark.png'],
    'favicon' => [InstanceSettingKey::Favicon, 'branding/favicon.png', 'favicon', 'branding/favicon.png'],
    'avatar style' => [InstanceSettingKey::AvatarStyle, 'bottts', 'avatarStyle', 'bottts'],
    'avatar member choice' => [InstanceSettingKey::AvatarMemberChoice, true, 'avatarMemberChoice', true],
    'gif provider' => [InstanceSettingKey::GifProvider, 'tenor', 'gifProvider', 'tenor'],
    'gif enabled' => [InstanceSettingKey::GifEnabled, false, 'gifEnabled', false],
    'gif rating' => [InstanceSettingKey::GifRating, 'pg-13', 'gifRating', 'pg-13'],
]);

it('stores a value through set and reads it back', function () {
    $settings = resolve(InstanceSettings::class);

    $settings->set('display_name', 'Acme Retros');

    expect($settings->displayName())->toBe('Acme Retros')
        ->and(InstanceSetting::query()->where('key', 'display_name')->count())->toBe(1);
});

it('replaces the stored value when the same key is set twice', function () {
    $settings = resolve(InstanceSettings::class);

    $settings->set('display_name', 'First');
    $settings->set('display_name', 'Second');

    expect($settings->displayName())->toBe('Second')
        ->and(InstanceSetting::query()->count())->toBe(1);
});

it('returns to the default after forget', function () {
    $settings = resolve(InstanceSettings::class);
    $settings->set('display_name', 'Acme Retros');
    $settings->set('gif_rating', 'r');
    $settings->set('powered_by', false);

    $settings->forget('display_name');
    $settings->forget('gif_rating');
    $settings->forget('powered_by');

    expect($settings->displayName())->toBe('Configured Name')
        ->and($settings->gifRating())->toBe('pg')
        ->and($settings->poweredBy())->toBeTrue()
        ->and(InstanceSetting::query()->count())->toBe(0);
});

it('returns to the default when a setting is set to null', function () {
    $settings = resolve(InstanceSettings::class);
    $settings->set('display_name', 'Acme Retros');

    $settings->set('display_name', null);

    expect($settings->displayName())->toBe('Configured Name');
});

it('refuses a key it does not know', function () {
    expect(fn () => resolve(InstanceSettings::class)->set('unknown_key', 'value'))
        ->toThrow(InvalidArgumentException::class)
        ->and(fn () => resolve(InstanceSettings::class)->forget('unknown_key'))
        ->toThrow(InvalidArgumentException::class);
});

it('runs one query for a cold read across several getters and none once the cache is warm', function () {
    InstanceSetting::factory()->keyed(InstanceSettingKey::DisplayName, 'Acme Retros')->create();
    Cache::forget(InstanceSettings::CacheKey);

    DB::enableQueryLog();
    $cold = freshInstanceSettings();
    $cold->displayName();
    $cold->brandColor();
    $cold->all();

    expect(DB::getQueryLog())->toHaveCount(1);

    DB::flushQueryLog();
    $warm = freshInstanceSettings();
    $warm->displayName();
    $warm->brandColor();
    $warm->all();

    expect(DB::getQueryLog())->toBeEmpty();
});

it('caches the settings for five minutes, which bounds a stale re-cache', function () {
    freshInstanceSettings()->displayName();

    $this->travel(299)->seconds();

    expect(Cache::has(InstanceSettings::CacheKey))->toBeTrue();

    $this->travel(2)->seconds();

    expect(Cache::has(InstanceSettings::CacheKey))->toBeFalse();
});

it('answers with the defaults and caches nothing while the table is missing', function () {
    $settings = MissingTables::during(function (): InstanceSettings {
        $settings = freshInstanceSettings();

        expect($settings->displayName())->toBe('Configured Name')
            ->and($settings->brandColor())->toBeNull()
            ->and($settings->gifKey())->toBe('config-gif-key')
            ->and($settings->all()['gif_rating'])->toBe('pg')
            ->and(Cache::has(InstanceSettings::CacheKey))->toBeFalse();

        return $settings;
    });

    $settings->set('display_name', 'Acme Retros');

    expect($settings->displayName())->toBe('Acme Retros')
        ->and(freshInstanceSettings()->displayName())->toBe('Acme Retros');
});

it('writes several settings at once and invalidates the cache once', function () {
    $settings = resolve(InstanceSettings::class);
    $settings->set('favicon', 'branding/favicon.png');
    $settings->displayName();
    $forgotten = 0;
    Event::listen(function (KeyForgotten $event) use (&$forgotten) {
        $forgotten += (int) ($event->key === InstanceSettings::CacheKey);
    });

    $settings->setMany([
        'display_name' => 'Acme Retros',
        'brand_radius' => 8,
        'powered_by' => false,
        'favicon' => null,
        'gif_key' => 'stored-secret-key',
    ]);

    expect($forgotten)->toBe(1)
        ->and($settings->displayName())->toBe('Acme Retros')
        ->and($settings->brandRadius())->toBe(8)
        ->and($settings->poweredBy())->toBeFalse()
        ->and($settings->favicon())->toBeNull()
        ->and($settings->gifKey())->toBe('stored-secret-key')
        ->and(InstanceSetting::query()->count())->toBe(4);
});

it('writes nothing when one of several settings is refused', function () {
    $settings = resolve(InstanceSettings::class);

    expect(fn () => $settings->setMany(['display_name' => 'Acme Retros', 'powered_by' => 'perhaps']))
        ->toThrow(InvalidArgumentException::class)
        ->and(InstanceSetting::query()->count())->toBe(0)
        ->and($settings->displayName())->toBe('Configured Name');
});

it('leaves no new value in the cache when the surrounding transaction rolls back', function () {
    $settings = resolve(InstanceSettings::class);
    $settings->set('display_name', 'Before');
    $settings->displayName();

    expect(fn () => DB::transaction(function () use ($settings): never {
        $settings->set('display_name', 'Rolled Back');

        expect($settings->displayName())->toBe('Rolled Back')
            ->and(Cache::get(InstanceSettings::CacheKey))->toBe(['display_name' => 'Before']);

        throw new RuntimeException('abort');
    }))->toThrow(RuntimeException::class)
        ->and(Cache::get(InstanceSettings::CacheKey, []))->not->toContain('Rolled Back')
        ->and($settings->displayName())->toBe('Before')
        ->and(freshInstanceSettings()->displayName())->toBe('Before');
});

it('does not cache rows read inside a transaction that has uncommitted writes', function () {
    $settings = resolve(InstanceSettings::class);

    expect(fn () => DB::transaction(function () use ($settings): never {
        $settings->set('display_name', 'Rolled Back');
        $settings->displayName();

        throw new RuntimeException('abort');
    }))->toThrow(RuntimeException::class)
        ->and(Cache::has(InstanceSettings::CacheKey))->toBeFalse()
        ->and(freshInstanceSettings()->displayName())->toBe('Configured Name');
});

it('invalidates the cache only once the surrounding transaction commits', function () {
    $settings = resolve(InstanceSettings::class);
    $settings->set('display_name', 'Before');
    $settings->displayName();

    DB::transaction(function () use ($settings) {
        $settings->set('display_name', 'After');

        expect(Cache::get(InstanceSettings::CacheKey))->toBe(['display_name' => 'Before']);
    });

    expect($settings->displayName())->toBe('After')
        ->and(freshInstanceSettings()->displayName())->toBe('After')
        ->and(Cache::get(InstanceSettings::CacheKey))->toBe(['display_name' => 'After']);
});

it('normalises boolean settings on write', function (string $key, string $getter, mixed $input, bool $expected) {
    $settings = resolve(InstanceSettings::class);

    $settings->set($key, $input);

    expect($settings->{$getter}())->toBe($expected)
        ->and(InstanceSetting::query()->where('key', $key)->sole()->value)->toBe($expected);
})->with([
    'powered by "0"' => ['powered_by', 'poweredBy', '0', false],
    'powered by "off"' => ['powered_by', 'poweredBy', 'off', false],
    'member choice "1"' => ['avatar_member_choice', 'avatarMemberChoice', '1', true],
    'member choice "on"' => ['avatar_member_choice', 'avatarMemberChoice', 'on', true],
    'gif enabled "false"' => ['gif_enabled', 'gifEnabled', 'false', false],
    'gif enabled 0' => ['gif_enabled', 'gifEnabled', 0, false],
]);

it('refuses a value that does not fit the setting', function (string $key, mixed $value) {
    expect(fn () => resolve(InstanceSettings::class)->set($key, $value))
        ->toThrow(InvalidArgumentException::class)
        ->and(InstanceSetting::query()->count())->toBe(0);
})->with([
    'powered by that is not a boolean' => ['powered_by', 'perhaps'],
    'member choice as an array' => ['avatar_member_choice', [true]],
    'gif switch as a number' => ['gif_enabled', 7],
    'radius that is not a number' => ['brand_radius', 'large'],
    'gif key as an array' => ['gif_key', ['secret']],
]);

it('stores the radius as an integer', function () {
    resolve(InstanceSettings::class)->set('brand_radius', '12');

    expect(InstanceSetting::query()->where('key', 'brand_radius')->sole()->value)->toBe(12);
});

it('trims a string before storing it', function () {
    $settings = resolve(InstanceSettings::class);

    $settings->set('display_name', '  Acme Retros  ');

    expect($settings->displayName())->toBe('Acme Retros');
});

it('deletes the stored gif key when a whitespace-only key is set', function () {
    $settings = resolve(InstanceSettings::class);
    $settings->set('gif_key', 'stored-secret-key');

    $settings->set('gif_key', "  \n ");

    expect($settings->gifKey())->toBe('config-gif-key')
        ->and(InstanceSetting::query()->where('key', 'gif_key')->exists())->toBeFalse();
});

it('hides the plaintext value of a write from stack traces', function (string $method) {
    $parameter = collect((new ReflectionMethod(InstanceSettings::class, $method))->getParameters())->last();

    expect($parameter->getAttributes(SensitiveParameter::class))->toHaveCount(1);
})->with(['set', 'setMany']);

it('shows a write to the next read of the same instance', function () {
    $settings = resolve(InstanceSettings::class);

    expect($settings->displayName())->toBe('Configured Name');

    $settings->set('display_name', 'Acme Retros');

    expect($settings->displayName())->toBe('Acme Retros');

    $settings->forget('display_name');

    expect($settings->displayName())->toBe('Configured Name');
});

it('shows a write to a service resolved for a later request', function () {
    expect(freshInstanceSettings()->displayName())->toBe('Configured Name');

    resolve(InstanceSettings::class)->set('display_name', 'Acme Retros');

    expect(freshInstanceSettings()->displayName())->toBe('Acme Retros');

    resolve(InstanceSettings::class)->forget('display_name');

    expect(freshInstanceSettings()->displayName())->toBe('Configured Name');
});

it('is resolved once per request and again for the next one', function () {
    $first = resolve(InstanceSettings::class);

    expect(resolve(InstanceSettings::class))->toBe($first)
        ->and(freshInstanceSettings())->not->toBe($first);
});

it('clamps a stored radius to 0–16 on read', function (mixed $stored, ?int $expected) {
    InstanceSetting::factory()->keyed(InstanceSettingKey::BrandRadius, $stored)->create();

    expect(resolve(InstanceSettings::class)->brandRadius())->toBe($expected);
})->with([
    'above the maximum' => [40, 16],
    'below the minimum' => [-3, 0],
    'at the maximum' => [16, 16],
    'zero' => [0, 0],
    'numeric string' => ['8', 8],
    'not a number' => ['large', null],
]);

it('ignores a stored value of the wrong shape', function (InstanceSettingKey $key, mixed $value, string $getter, mixed $expected) {
    InstanceSetting::factory()->keyed($key, $value)->create();

    expect(resolve(InstanceSettings::class)->{$getter}())->toBe($expected);
})->with([
    'colour that is not a hex' => [InstanceSettingKey::BrandColor, 'red; } body { display: none', 'brandColor', null],
    'unknown gif rating' => [InstanceSettingKey::GifRating, 'x', 'gifRating', 'pg'],
    'unknown gif provider' => [InstanceSettingKey::GifProvider, 'imgur', 'gifProvider', 'giphy'],
    'avatar style with a path' => [InstanceSettingKey::AvatarStyle, '../../etc', 'avatarStyle', 'thumbs'],
    'blank display name' => [InstanceSettingKey::DisplayName, '   ', 'displayName', 'Configured Name'],
    'array as display name' => [InstanceSettingKey::DisplayName, ['a'], 'displayName', 'Configured Name'],
    'colour with a trailing newline' => [InstanceSettingKey::BrandColor, "#fff\n", 'brandColor', null],
    'avatar style with a trailing newline' => [InstanceSettingKey::AvatarStyle, "thumbs\n", 'avatarStyle', 'thumbs'],
]);

it('disables gifs when they are switched on without a provider and a key', function () {
    config(['services.gifs' => ['provider' => null, 'key' => null, 'rating' => 'pg']]);
    InstanceSetting::factory()->keyed(InstanceSettingKey::GifEnabled, true)->create();

    expect(resolve(InstanceSettings::class)->gifEnabled())->toBeFalse();
});

it('stores the gif key encrypted and reads it back', function () {
    $settings = resolve(InstanceSettings::class);

    $settings->set('gif_key', 'stored-secret-key');

    $raw = DB::table('instance_settings')->where('key', 'gif_key')->value('value');

    expect($raw)->not->toContain('stored-secret-key')
        ->and(json_encode(Cache::get(InstanceSettings::CacheKey)))->not->toContain('stored-secret-key')
        ->and($settings->gifKey())->toBe('stored-secret-key')
        ->and(freshInstanceSettings()->gifKey())->toBe('stored-secret-key')
        ->and($settings->hasGifKey())->toBeTrue();
});

it('returns to the configured gif key when the stored one is forgotten or emptied', function (?string $empty) {
    $settings = resolve(InstanceSettings::class);
    $settings->set('gif_key', 'stored-secret-key');

    $settings->set('gif_key', $empty);

    expect($settings->gifKey())->toBe('config-gif-key')
        ->and(InstanceSetting::query()->where('key', 'gif_key')->exists())->toBeFalse();
})->with([null, '']);

it('never includes the gif key in all', function () {
    $settings = resolve(InstanceSettings::class);
    $settings->set('gif_key', 'stored-secret-key');

    $all = $settings->all();

    expect($all)->not->toHaveKey('gif_key')
        ->and($all['has_gif_key'])->toBeTrue()
        ->and(json_encode($all))->not->toContain('stored-secret-key')
        ->and(json_encode($all))->not->toContain('config-gif-key')
        ->and(json_encode($all))->not->toContain(
            (string) DB::table('instance_settings')->where('key', 'gif_key')->value('value'),
        );
});

it('lists every setting with its effective value', function () {
    $settings = resolve(InstanceSettings::class);
    $settings->set('brand_color', '#2B63B0');
    $settings->set('brand_radius', 99);

    expect($settings->all())->toBe([
        'brand_color' => '#2B63B0',
        'brand_radius' => 16,
        'display_name' => 'Configured Name',
        'powered_by' => true,
        'logo_light' => null,
        'logo_dark' => null,
        'favicon' => null,
        'avatar_style' => 'thumbs',
        'avatar_member_choice' => false,
        'gif_provider' => 'giphy',
        'gif_enabled' => true,
        'gif_rating' => 'pg',
        'has_gif_key' => true,
    ]);
});

it('treats a stored gif key it cannot decrypt as no key', function () {
    $otherKey = new Encrypter(random_bytes(32), 'aes-256-cbc');
    InstanceSetting::factory()
        ->keyed(InstanceSettingKey::GifKey, $otherKey->encryptString('stored-secret-key'))
        ->create();

    $settings = resolve(InstanceSettings::class);

    expect($settings->gifKey())->toBeNull()
        ->and($settings->hasGifKey())->toBeFalse()
        ->and($settings->gifEnabled())->toBeFalse()
        ->and($settings->all()['has_gif_key'])->toBeFalse();
});

it('treats a stored gif key that is not a ciphertext as no key', function () {
    InstanceSetting::factory()->keyed(InstanceSettingKey::GifKey, 'plain-text')->create();

    expect(resolve(InstanceSettings::class)->gifKey())->toBeNull();
});
