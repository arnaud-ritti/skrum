<?php

use App\Enums\InstanceSettingKey;
use App\Models\InstanceSetting;
use App\Support\InstanceSettings;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

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

it('ships g as the default gif rating of the configuration', function () {
    $services = file_get_contents(config_path('services.php'));

    expect($services)->toContain("env('SKRUM_GIF_RATING', 'g')");
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

it('reads every setting from one cached query', function () {
    InstanceSetting::factory()->keyed(InstanceSettingKey::DisplayName, 'Acme Retros')->create();
    freshInstanceSettings()->displayName();

    DB::enableQueryLog();
    $settings = freshInstanceSettings();
    $settings->displayName();
    $settings->brandColor();
    $settings->all();

    expect(DB::getQueryLog())->toBeEmpty()
        ->and(Cache::has(InstanceSettings::CacheKey))->toBeTrue();
});

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
