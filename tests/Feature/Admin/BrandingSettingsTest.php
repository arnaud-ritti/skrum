<?php

use App\Actions\Admin\RecordAuditEvent;
use App\Models\InstanceSetting;
use App\Models\User;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\Branding\BrandAssets;
use App\Support\Branding\BrandPalette;
use App\Support\InstanceSettings;
use Illuminate\Cache\Events\KeyForgotten;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

const BrandingGifKey = 'gif-secret-key-9f8e7d6c5b4a';

function brandingAdmin(mixed $test): User
{
    $admin = User::factory()->instanceAdmin()->create();

    $test->actingAs($admin)->withSession(['auth.password_confirmed_at' => time()]);

    return $admin;
}

function brandingPayload(array $overrides = []): array
{
    return [
        'brand_color' => null,
        'brand_radius' => null,
        'display_name' => null,
        'powered_by' => null,
        'avatar_style' => null,
        'avatar_member_choice' => null,
        'profile_photos' => null,
        'gif_provider' => null,
        'gif_enabled' => null,
        'gif_rating' => null,
        ...$overrides,
    ];
}

function storedBrandingSettings(): InstanceSettings
{
    app()->forgetScopedInstances();

    return resolve(InstanceSettings::class);
}

beforeEach(function () {
    Storage::fake('local');
    config([
        'app.name' => 'Configured Name',
        'skrum.avatar_style' => 'thumbs',
        'services.gifs.provider' => null,
        'services.gifs.key' => null,
        'services.gifs.rating' => 'g',
    ]);
});

it('shows no stored value and the effective defaults when nothing is stored', function () {
    $admin = brandingAdmin($this);

    $this->get(route('admin.branding.edit'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('admin/branding')
            ->where('brandColor', null)
            ->where('brandRadius', null)
            ->where('displayName', null)
            ->where('poweredBy', null)
            ->where('avatarStyle', null)
            ->where('avatarMemberChoice', null)
            ->where('profilePhotos', null)
            ->where('gifProvider', null)
            ->where('gifEnabled', null)
            ->where('gifRating', null)
            ->where('hasGifKey', false)
            ->where('defaults', [
                'brandColor' => '#bb4d2a',
                'brandRadius' => 10,
                'displayName' => 'Configured Name',
                'poweredBy' => true,
                'avatarStyle' => 'thumbs',
                'avatarMemberChoice' => false,
                'profilePhotos' => false,
                'gifProvider' => null,
                'gifEnabled' => true,
                'gifRating' => 'g',
            ])
            ->where('assets', ['logoLightUrl' => null, 'logoDarkUrl' => null, 'faviconUrl' => null, 'logoMailUrl' => null, 'mailShowsName' => false])
            ->where('palette', null)
            ->has('avatarStyles', count(resolve(AvatarStyleCatalogue::class)->selectable()))
            ->where('avatarStyles', fn ($styles) => collect($styles)->firstWhere('value', 'fun-emoji') == [
                'value' => 'fun-emoji',
                'name' => 'Fun Emoji',
                'license' => 'CC BY 4.0',
                'attribution' => 'Fun Emoji Set by Davis Uche, CC BY 4.0',
                'attributionRequired' => true,
                'sampleUrls' => [
                    "/admin/avatar-previews/fun-emoji/{$admin->avatarSeed()}.svg",
                    '/admin/avatar-previews/fun-emoji/5f2b8c1e9a4d47f0b3c6d8e1a7f90214.svg',
                    '/admin/avatar-previews/fun-emoji/c41d7e02b96a4f35a8e0d3b7f1c5926e.svg',
                ],
            ])
            ->missing('gifKey')
            ->missing('gif_key'));
});

it('stores every field and shows it on the page', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload([
        'brand_color' => '#2b63b0',
        'brand_radius' => 6,
        'display_name' => 'Acme Retros',
        'powered_by' => false,
        'avatar_style' => 'notionists',
        'avatar_member_choice' => true,
        'gif_provider' => 'tenor',
        'gif_enabled' => true,
        'gif_rating' => 'pg-13',
        'gif_key' => BrandingGifKey,
    ]))
        ->assertRedirect(route('admin.branding.edit'))
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.type', 'success');

    $settings = storedBrandingSettings();

    expect($settings->brandColor())->toBe('#2b63b0')
        ->and($settings->brandRadius())->toBe(6)
        ->and($settings->displayName())->toBe('Acme Retros')
        ->and($settings->poweredBy())->toBeFalse()
        ->and($settings->avatarStyle())->toBe('notionists')
        ->and($settings->avatarMemberChoice())->toBeTrue()
        ->and($settings->gifProvider())->toBe('tenor')
        ->and($settings->gifEnabled())->toBeTrue()
        ->and($settings->gifRating())->toBe('pg-13')
        ->and($settings->gifKey())->toBe(BrandingGifKey);

    $palette = BrandPalette::derive('#2b63b0', 6);

    $this->get(route('admin.branding.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('brandColor', '#2b63b0')
            ->where('brandRadius', 6)
            ->where('displayName', 'Acme Retros')
            ->where('poweredBy', false)
            ->where('avatarStyle', 'notionists')
            ->where('avatarMemberChoice', true)
            ->where('gifProvider', 'tenor')
            ->where('gifEnabled', true)
            ->where('gifRating', 'pg-13')
            ->where('hasGifKey', true)
            ->where('palette.light', $palette->toHex()['light'])
            ->where('palette.dark', $palette->toHex()['dark'])
            ->where('palette.warnings', [])
            ->where('palette.ratios.light.onPrimary', 5.8)
            ->where('palette.ratios.dark.onPrimary', 6.39)
            ->has('palette.ratios.light.primaryOnSurface')
            ->has('palette.ratios.dark.primaryOnSurface')
            ->missing('palette.css'));
});

it('saves the whole form in one write that invalidates the cache once', function () {
    brandingAdmin($this);
    storedBrandingSettings()->displayName();
    app()->forgetScopedInstances();
    $invalidations = 0;

    Event::listen(function (KeyForgotten $event) use (&$invalidations): void {
        if ($event->key === InstanceSettings::CacheKey) {
            $invalidations++;
        }
    });

    $this->put(route('admin.branding.update'), brandingPayload([
        'brand_color' => '#2b63b0',
        'brand_radius' => 6,
        'display_name' => 'Acme Retros',
        'gif_key' => BrandingGifKey,
    ]))->assertSessionHasNoErrors();

    expect($invalidations)->toBe(1);
});

it('writes nothing when one field of the form is refused', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['brand_color' => '#2b63b0', 'brand_radius' => 99]))
        ->assertSessionHasErrors('brand_radius');

    $this->assertDatabaseCount('instance_settings', 0);
});

it('shows the new brand to another user on the request that follows the save', function () {
    $member = User::factory()->create();

    $before = $this->actingAs($member)->get(route('settings.edit'))->assertOk()->getContent();

    expect($before)->not->toContain('skrum-brand');

    brandingAdmin($this);
    app()->forgetScopedInstances();
    $this->put(route('admin.branding.update'), brandingPayload(['brand_color' => '2B63B0', 'display_name' => 'Acme Retros']))
        ->assertRedirect();
    app()->forgetScopedInstances();

    $after = $this->actingAs($member)->get(route('settings.edit'))->assertOk();

    expect($after->getContent())
        ->toContain('<style id="skrum-brand">'.BrandPalette::derive('#2b63b0', 10)->css().'</style>')
        ->toContain('>Acme Retros</title>');

    $after->assertInertia(fn (AssertableInertia $page) => $page
        ->where('name', 'Acme Retros')
        ->where('brand.name', 'Acme Retros')
        ->where('adminUrl', null));
});

it('normalises the colour to a lowercase six-digit hex', function (string $typed, string $stored) {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['brand_color' => $typed]))->assertSessionHasNoErrors();

    expect(InstanceSetting::query()->where('key', 'brand_color')->value('value'))->toBe($stored);
})->with([
    'no hash, upper case' => ['2B63B0', '#2b63b0'],
    'three digits' => ['#fff', '#ffffff'],
    'three digits without hash' => ['A1c', '#aa11cc'],
    'surrounding spaces' => [' #2b63b0 ', '#2b63b0'],
    'upper case with hash' => ['#FFD600', '#ffd600'],
]);

it('refuses a colour that is not a hex value', function (mixed $color) {
    brandingAdmin($this);
    storedBrandingSettings()->set('brand_color', '#112233');

    $this->putJson(route('admin.branding.update'), brandingPayload(['brand_color' => $color]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('brand_color');

    expect(storedBrandingSettings()->brandColor())->toBe('#112233');
})->with([
    'name' => ['red'],
    'four digits' => ['#ffff'],
    'eight digits' => ['#2b63b0ff'],
    'not hex digits' => ['#gggggg'],
    'double hash' => ['##2b63b0'],
    'css injection' => ['#fff;}</style><script>alert(1)</script>'],
    'trailing newline inside' => ["#2b63b0\n;"],
    'array' => [['#2b63b0']],
]);

it('forgets the colour when the field is emptied', function () {
    brandingAdmin($this);
    storedBrandingSettings()->set('brand_color', '#112233');

    $this->put(route('admin.branding.update'), brandingPayload(['brand_color' => '']))->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->brandColor())->toBeNull();
    $this->assertDatabaseMissing('instance_settings', ['key' => 'brand_color']);
});

it('accepts a radius from 0 to 16', function (int $radius) {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['brand_radius' => $radius]))->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->brandRadius())->toBe($radius);
})->with([0, 10, 16]);

it('refuses a radius outside 0 to 16 or not an integer', function (mixed $radius) {
    brandingAdmin($this);

    $this->putJson(route('admin.branding.update'), brandingPayload(['brand_radius' => $radius]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('brand_radius');

    $this->assertDatabaseCount('instance_settings', 0);
})->with([-1, 17, 400, '1.5', 'large']);

it('stores a hostile display name as typed and renders it escaped', function () {
    brandingAdmin($this);
    $hostile = '</title><script>alert(1)</script>';

    $this->put(route('admin.branding.update'), brandingPayload(['display_name' => $hostile]))->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->displayName())->toBe($hostile);

    app()->forgetScopedInstances();
    $html = $this->get(route('admin.branding.edit'))->assertOk()->getContent();

    expect($html)->toContain('&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>')
        ->not->toContain($hostile)
        ->not->toContain('<script>alert(1)</script>');
});

it('trims the display name and strips control characters', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['display_name' => "  Acme\u{0000}\r\n\tRetros\u{001B}  "]))
        ->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->displayName())->toBe('AcmeRetros');
});

it('returns to the configured name when the name is emptied or only control characters', function (string $name) {
    brandingAdmin($this);
    storedBrandingSettings()->set('display_name', 'Acme');

    $this->put(route('admin.branding.update'), brandingPayload(['display_name' => $name]))->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->displayName())->toBe('Configured Name');
})->with(['', '   ', "\u{0007}\u{0000}"]);

it('refuses a display name longer than 60 characters', function () {
    brandingAdmin($this);

    $this->putJson(route('admin.branding.update'), brandingPayload(['display_name' => str_repeat('é', 61)]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('display_name');

    $this->put(route('admin.branding.update'), brandingPayload(['display_name' => str_repeat('é', 60)]))
        ->assertSessionHasNoErrors();
});

it('never sends the GIF key back to the browser', function () {
    brandingAdmin($this);

    $update = $this->put(route('admin.branding.update'), brandingPayload([
        'gif_provider' => 'giphy',
        'gif_enabled' => true,
        'gif_key' => BrandingGifKey,
    ]));

    expect($update->getContent())->not->toContain(BrandingGifKey)
        ->and(json_encode(session()->all()))->not->toContain(BrandingGifKey);

    app()->forgetScopedInstances();
    $page = $this->get(route('admin.branding.edit'))->assertOk();

    expect($page->getContent())->not->toContain(BrandingGifKey);

    $page->assertInertia(fn (AssertableInertia $page) => $page
        ->where('hasGifKey', true)
        ->missing('gifKey')
        ->missing('gif_key'));

    app()->forgetScopedInstances();
    $partial = $this->get(route('admin.branding.edit'), ['X-Inertia' => 'true', 'X-Inertia-Version' => hash('xxh128', 'x')]);

    expect($partial->getContent())->not->toContain(BrandingGifKey)
        ->and(InstanceSetting::query()->where('key', 'gif_key')->value('value'))->not->toContain(BrandingGifKey);
});

it('does not keep the GIF key in the session when the form is refused', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['brand_color' => 'nope', 'gif_key' => BrandingGifKey]))
        ->assertSessionHasErrors('brand_color');

    expect(json_encode(session()->all()))->not->toContain(BrandingGifKey);
});

it('keeps the stored GIF key when the field is empty or absent', function (array $fields) {
    brandingAdmin($this);
    storedBrandingSettings()->set('gif_key', BrandingGifKey);

    $this->put(route('admin.branding.update'), brandingPayload($fields))->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->gifKey())->toBe(BrandingGifKey);
})->with([
    'absent' => [[]],
    'empty' => [['gif_key' => '']],
    'null' => [['gif_key' => null]],
    'spaces' => [['gif_key' => '   ']],
    'clear switch off' => [['gif_key' => '', 'gif_key_clear' => false]],
]);

it('removes the stored GIF key when asked to clear it', function () {
    brandingAdmin($this);
    storedBrandingSettings()->set('gif_key', BrandingGifKey);

    $this->put(route('admin.branding.update'), brandingPayload(['gif_key_clear' => true]))->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->gifKey())->toBeNull()
        ->and(storedBrandingSettings()->hasGifKey())->toBeFalse();
    $this->assertDatabaseMissing('instance_settings', ['key' => 'gif_key']);
});

it('replaces the GIF key when a new one is typed', function () {
    brandingAdmin($this);
    storedBrandingSettings()->set('gif_key', 'old-key');

    $this->put(route('admin.branding.update'), brandingPayload(['gif_key' => BrandingGifKey, 'gif_key_clear' => true]))
        ->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->gifKey())->toBe(BrandingGifKey);
});

it('refuses unknown values for the avatar style, the GIF provider and the rating', function (string $field, mixed $value) {
    brandingAdmin($this);

    $this->putJson(route('admin.branding.update'), brandingPayload([$field => $value]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    $this->assertDatabaseCount('instance_settings', 0);
})->with([
    'unknown style' => ['avatar_style', 'no-such-style'],
    'style with a path' => ['avatar_style', '../../composer'],
    'camel case style' => ['avatar_style', 'funEmoji'],
    'style without licence data' => ['avatar_style', 'blobs'],
    'unknown provider' => ['gif_provider', 'imgur'],
    'unknown rating' => ['gif_rating', 'x'],
    'powered by not boolean' => ['powered_by', 'maybe'],
    'member choice not boolean' => ['avatar_member_choice', 'perhaps'],
    'gif switch not boolean' => ['gif_enabled', 'sometimes'],
    'key too long' => ['gif_key', str_repeat('k', 256)],
]);

it('accepts the initials style and every style on disk', function (string $style) {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['avatar_style' => $style]))->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->avatarStyle())->toBe($style);
})->with(['initials', 'fun-emoji', 'notionists']);

it('returns the palette, the ratios and the warnings of a typed colour', function () {
    brandingAdmin($this);
    $palette = BrandPalette::derive('#FFD600', 16);

    $this->getJson(route('admin.brandingPreview.show', ['color' => '#FFD600', 'radius' => 16]))
        ->assertOk()
        ->assertJsonPath('light', $palette->toHex()['light'])
        ->assertJsonPath('dark', $palette->toHex()['dark'])
        ->assertJsonPath('ratios.light.onPrimary', 4.51)
        ->assertJsonPath('ratios.dark.onPrimary', 9.89)
        ->assertJsonPath('warnings.0.key', 'Too light to carry text: lightness adjusted from :from % to :to % in the light theme.')
        ->assertJsonPath('warnings.0.replace.to', 56)
        ->assertJsonPath('css', $palette->css())
        ->assertJsonStructure(['light', 'dark', 'ratios' => ['light' => ['onPrimary', 'primaryOnSurface'], 'dark' => ['onPrimary', 'primaryOnSurface']], 'warnings', 'css']);
});

it('previews with the default radius and accepts a colour without hash', function () {
    brandingAdmin($this);

    $this->getJson(route('admin.brandingPreview.show', ['color' => '2b63b0']))
        ->assertOk()
        ->assertJsonPath('css', BrandPalette::derive('#2b63b0', 10)->css())
        ->assertJsonPath('warnings', []);
});

it('refuses a preview of something that is not a colour or a radius out of range', function (array $query, string $field) {
    brandingAdmin($this);

    $this->getJson(route('admin.brandingPreview.show', $query))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'garbage' => [['color' => 'garbage'], 'color'],
    'missing' => [[], 'color'],
    'css injection' => [['color' => '#fff;}</style>'], 'color'],
    'array' => [['color' => ['#fff']], 'color'],
    'radius too large' => [['color' => '#fff', 'radius' => 40], 'radius'],
]);

it('stores nothing when a colour is previewed', function () {
    brandingAdmin($this);

    $this->getJson(route('admin.brandingPreview.show', ['color' => '#FFD600']))->assertOk();

    $this->assertDatabaseCount('instance_settings', 0);
});

it('keeps the preview away from non-admins', function () {
    $this->getJson(route('admin.brandingPreview.show', ['color' => '#FFD600']))->assertUnauthorized();

    $this->actingAs(User::factory()->create())
        ->getJson(route('admin.brandingPreview.show', ['color' => '#FFD600']))
        ->assertForbidden()
        ->assertJsonMissingPath('css');
});

it('resets every setting and removes the images', function () {
    brandingAdmin($this);
    $assets = resolve(BrandAssets::class);
    $svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    $assets->store('logo-light', UploadedFile::fake()->createWithContent('logo.svg', $svg));
    $assets->store('logo-dark', UploadedFile::fake()->createWithContent('logo.svg', $svg));
    $assets->store('favicon', UploadedFile::fake()->createWithContent('logo.svg', $svg));
    storedBrandingSettings()->setMany([
        'brand_color' => '#2b63b0',
        'brand_radius' => 4,
        'display_name' => 'Acme',
        'powered_by' => false,
        'avatar_style' => 'rings',
        'avatar_member_choice' => true,
        'gif_provider' => 'giphy',
        'gif_enabled' => true,
        'gif_rating' => 'r',
        'gif_key' => BrandingGifKey,
    ]);

    expect(Storage::disk('local')->allFiles('branding'))->toHaveCount(3);

    app()->forgetScopedInstances();
    $this->delete(route('admin.branding.destroy'))
        ->assertRedirect(route('admin.branding.edit'))
        ->assertInertiaFlash('toast.type', 'success');

    $this->assertDatabaseCount('instance_settings', 0);

    expect(Storage::disk('local')->allFiles('branding'))->toBeEmpty();

    app()->forgetScopedInstances();
    $html = $this->get(route('admin.branding.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('brandColor', null)
            ->where('displayName', null)
            ->where('defaults.displayName', 'Configured Name')
            ->where('hasGifKey', false)
            ->where('assets', ['logoLightUrl' => null, 'logoDarkUrl' => null, 'faviconUrl' => null, 'logoMailUrl' => null, 'mailShowsName' => false])
            ->where('palette', null))
        ->getContent();

    expect($html)->not->toContain('skrum-brand');
});

it('keeps the images when the reset of the settings fails', function () {
    brandingAdmin($this);
    resolve(BrandAssets::class)->store('favicon', UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>'));
    storedBrandingSettings()->setMany(['display_name' => 'Acme']);
    $this->mock(RecordAuditEvent::class)->shouldReceive('handle')->andThrow(new RuntimeException('Audit store down'));

    $this->delete(route('admin.branding.destroy'))->assertServerError();

    expect(Storage::disk('local')->allFiles('branding'))->toHaveCount(1)
        ->and(storedBrandingSettings()->displayName())->toBe('Acme');
});

it('strips bidirectional controls, the zero-width space and the byte-order mark from the display name', function (string $typed) {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['display_name' => $typed]))
        ->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->displayName())->toBe('Skrüm');
})->with([
    'right-to-left override and zero-width space' => ["Skr\u{202E}üm\u{200B}"],
    'left-to-right and right-to-left marks' => ["\u{200E}Skr\u{200F}üm"],
    'embeddings and pop' => ["\u{202A}Skr\u{202B}ü\u{202C}m\u{202D}"],
    'isolates' => ["\u{2066}Skr\u{2067}ü\u{2068}m\u{2069}"],
    'byte-order mark' => ["\u{FEFF}Skrüm"],
    'arabic letter mark' => ["Skr\u{061C}üm"],
]);

it('keeps the joiners of a display name', function (string $typed) {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['display_name' => $typed]))
        ->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->displayName())->toBe($typed);
})->with([
    'family emoji joined by zero-width joiners' => ["Team \u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}"],
    'persian word with a zero-width non-joiner' => ["می\u{200C}خواهم"],
]);

it('removes a right-to-left override next to a joined emoji and keeps the emoji whole', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['display_name' => "\u{202E}Acme \u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}"]))
        ->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->displayName())->toBe("Acme \u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}");
});

it('returns to the configured name when the name holds nothing but joiners', function () {
    brandingAdmin($this);
    storedBrandingSettings()->set('display_name', 'Acme');

    $this->put(route('admin.branding.update'), brandingPayload(['display_name' => " \u{200D}\u{200C} "]))
        ->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->displayName())->toBe('Configured Name');
});

it('returns to the configured name when the name holds no visible character', function (string $typed) {
    brandingAdmin($this);
    storedBrandingSettings()->set('display_name', 'Acme');

    $this->put(route('admin.branding.update'), brandingPayload(['display_name' => $typed]))
        ->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->displayName())->toBe('Configured Name');
})->with([
    'word joiner' => ["\u{2060}\u{2060}"],
    'soft hyphen' => ["\u{00AD}"],
    'hangul filler' => ["\u{3164}"],
    'tag characters' => ["\u{E0041}\u{E0042}"],
    'arabic letter mark alone' => ["\u{061C}"],
    'joiners next to a word joiner' => ["\u{200D}\u{2060}"],
]);

it('refuses an update that omits fields instead of deleting them', function () {
    brandingAdmin($this);
    storedBrandingSettings()->setMany(['display_name' => 'Acme', 'brand_radius' => 8]);

    $this->putJson(route('admin.branding.update'), ['brand_color' => '#2b63b0'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['brand_radius', 'display_name', 'powered_by', 'avatar_style', 'avatar_member_choice', 'gif_provider', 'gif_enabled', 'gif_rating'])
        ->assertJsonMissingValidationErrors('brand_color');

    $settings = storedBrandingSettings();
    expect($settings->displayName())->toBe('Acme');
    $this->assertDatabaseMissing('instance_settings', ['key' => 'brand_color']);
    $this->assertDatabaseHas('instance_settings', ['key' => 'brand_radius']);
});

it('stores nothing when the untouched form of a fresh instance is saved', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload())
        ->assertRedirect(route('admin.branding.edit'))
        ->assertSessionHasNoErrors();

    $this->assertDatabaseCount('instance_settings', 0);
});

it('stores only the colour when only the colour changed', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['brand_color' => '#FFD600']))
        ->assertSessionHasNoErrors();

    expect(InstanceSetting::query()->pluck('value', 'key')->all())->toBe(['brand_color' => '#ffd600']);
});

it('keeps following the environment after a save that left the avatar style and the GIF settings alone', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['brand_color' => '#2b63b0']))
        ->assertSessionHasNoErrors();

    config([
        'skrum.avatar_style' => 'lorelei',
        'services.gifs.provider' => 'giphy',
        'services.gifs.key' => 'environment-key',
        'services.gifs.rating' => 'pg',
    ]);

    $settings = storedBrandingSettings();

    expect($settings->avatarStyle())->toBe('lorelei')
        ->and($settings->gifProvider())->toBe('giphy')
        ->and($settings->gifRating())->toBe('pg')
        ->and($settings->gifEnabled())->toBeTrue();

    $this->get(route('admin.branding.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('avatarStyle', null)
            ->where('gifProvider', null)
            ->where('gifRating', null)
            ->where('gifEnabled', null)
            ->where('defaults.avatarStyle', 'lorelei')
            ->where('defaults.gifProvider', 'giphy')
            ->where('defaults.gifRating', 'pg')
            ->where('defaults.gifEnabled', true));
});

it('clears a stored switch when the form sends it back empty', function (string $field) {
    brandingAdmin($this);
    storedBrandingSettings()->setMany(['powered_by' => false, 'avatar_member_choice' => true, 'gif_enabled' => false]);
    app()->forgetScopedInstances();

    $this->put(route('admin.branding.update'), brandingPayload([
        'powered_by' => false,
        'avatar_member_choice' => true,
        'gif_enabled' => false,
        $field => null,
    ]))->assertSessionHasNoErrors();

    $this->assertDatabaseMissing('instance_settings', ['key' => $field]);
    $this->assertDatabaseCount('instance_settings', 2);
})->with(['powered_by', 'avatar_member_choice', 'gif_enabled']);

it('keeps the toast of a save for the page when a helper request of that page reaches the server first', function (Closure $helperUrl) {
    $admin = brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['brand_color' => '#2b63b0']))
        ->assertRedirect(route('admin.branding.edit'))
        ->assertInertiaFlash('toast.message', 'Branding saved.');

    $this->get($helperUrl($admin))->assertOk();

    $this->get(route('admin.branding.edit'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->hasFlash('toast.message', 'Branding saved.'));
})->with([
    'colour preview' => [fn (User $admin): string => route('admin.brandingPreview.show', ['color' => 'ffd600'])],
    'avatar preview' => [fn (User $admin): string => route('admin.avatarPreviews.show', ['style' => 'thumbs', 'seed' => $admin->avatarSeed()])],
    'candidate search' => [fn (User $admin): string => route('admin.adminCandidates.index', ['query' => 'ada'])],
]);

it('drops the toast of a save on the request after the page that showed it', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['brand_color' => '#2b63b0']))
        ->assertInertiaFlash('toast.message', 'Branding saved.');

    $this->get(route('admin.branding.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page->hasFlash('toast.message', 'Branding saved.'));

    $this->get(route('admin.branding.edit'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->missingFlash('toast'));
});

it('words the licence and the attribution of a style in the language of the viewer', function () {
    app()->setLocale('fr');

    $style = resolve(AvatarStyleCatalogue::class)->style('avataaars');

    expect($style['license'])->toBe('Gratuit pour un usage personnel et commercial')
        ->and($style['attribution'])->toBe('Avataaars par Pablo Stanley, Gratuit pour un usage personnel et commercial');
});

it('turns profile photos on and off, and the reset turns them back off', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['profile_photos' => true]))->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->profilePhotos())->toBeTrue();

    $this->get(route('admin.branding.edit'))->assertInertia(fn (AssertableInertia $page) => $page
        ->where('profilePhotos', true)
        ->where('defaults.profilePhotos', false));

    $this->delete(route('admin.branding.destroy'));

    expect(storedBrandingSettings()->storedProfilePhotos())->toBeNull()
        ->and(storedBrandingSettings()->profilePhotos())->toBeFalse();
});

it('keeps the profile photos switch when the form does not send it', function () {
    brandingAdmin($this);
    resolve(InstanceSettings::class)->set('profile_photos', true);
    $payload = collect(brandingPayload(['display_name' => 'Acme']))->except('profile_photos')->all();

    $this->put(route('admin.branding.update'), $payload)->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->storedProfilePhotos())->toBeTrue()
        ->and(storedBrandingSettings()->displayName())->toBe('Acme');
});

it('refuses a profile photos value that is not a boolean', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['profile_photos' => 'sometimes']))->assertSessionHasErrors('profile_photos');
});
