<?php

use App\Models\InstanceSetting;
use App\Models\Team;
use App\Models\User;
use App\Support\Branding\BrandAssets;
use App\Support\Branding\BrandPalette;
use App\Support\InstanceSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

const BrandingColorInput = '[data-slot="color-field"] [data-slot="text-field"] input';

const BrandingUnsavedBar = 'header [data-slot="unsaved-bar"]';

const BrandingUploader = '[data-slot="asset-uploader"]';

const BrandingSidebarAdminLink = '[data-sidebar="footer"] nav[aria-label="Administration"] a[aria-label="Administration"]';

function brandingMember(string $name, bool $admin = false): User
{
    $team = Team::query()->firstWhere('name', 'Demo Team') ?? Team::factory()->create(['name' => 'Demo Team']);
    $user = teamMember($team);

    $user->forceFill(['name' => $name, 'is_instance_admin' => $admin])->save();

    return $user;
}

/**
 * @return array<string, mixed>
 */
function brandingStoredSettings(): array
{
    return InstanceSetting::query()->orderBy('key')->pluck('value', 'key')->all();
}

function brandingSave(mixed $page): mixed
{
    return $page->click(BrandingUnsavedBar.' button[type="submit"]:has-text("Save")')
        ->assertSeeIn(BrandingUnsavedBar.' [role="status"]', 'No unsaved changes');
}

beforeEach(function () {
    config([
        'app.name' => 'Skrum',
        'skrum.avatar_style' => 'thumbs',
        'services.gifs.provider' => null,
        'services.gifs.key' => null,
    ]);
});

it('lets an instance admin open Administration from the sidebar, change the colour with its contrast guard rail, and applies the brand after a reload', function () {
    $admin = brandingMember('Fran Facilitator', admin: true);

    $page = $this->signIn($admin, '/about');

    $page->assertPresent('[data-slot="about"]')
        ->assertNotPresent(BrandingSidebarAdminLink.'[aria-current="page"]')
        ->click(BrandingSidebarAdminLink);

    passwordConfirmedPage($page, '/admin/general')
        ->click('[data-slot="admin-shell"] nav[aria-label="Administration"] a:has-text("Branding")')
        ->assertPathIs('/admin/branding')
        ->assertPresent(BrandingSidebarAdminLink.'[aria-current="page"]')
        ->assertPresent('[data-slot="admin-shell"] nav[aria-label="Administration"] a[aria-current="page"]:has-text("Branding")')
        ->assertSeeIn(BrandingUnsavedBar.' [role="status"]', 'No unsaved changes')
        ->assertPresent(BrandingUnsavedBar.' button:has-text("Cancel")')
        ->assertSeeIn('[data-slot="color-entered"]', 'Default');

    expect($page->script('() => document.getElementById("skrum-brand") === null'))->toBeTrue();

    $page->fill(BrandingColorInput, '#FFD600')
        ->assertPresent('[data-slot="color-entered"] code:text-is("#ffd600")')
        ->assertPresent('[data-slot="color-applied-light"] code:text-is("#887100")')
        ->assertPresent('[data-slot="color-applied-light"] [data-slot="contrast-badge"][data-level="AA"]:has-text("AA 4.6:1")')
        ->assertPresent('[data-slot="color-applied-dark"] [data-slot="contrast-badge"][data-level="AAA"]:has-text("AAA 9.8:1")')
        ->assertSeeIn('[data-slot="palette-warnings"]', 'Too light to carry text: lightness adjusted from 88 % to 55 % in the light theme.')
        ->assertSeeIn(BrandingUnsavedBar.' [role="status"]', '1 unsaved change');

    expect($page->script('() => document.querySelector(\'[data-slot="brand-preview-stage"]\').style.getPropertyValue("--primary")'))->toBe('#887100')
        ->and(brandingStoredSettings())->toBeEmpty();

    brandingSave($page)->assertSee('Branding saved.');

    expect(brandingStoredSettings())->toBe(['brand_color' => '#ffd600']);

    $page->navigate('/admin/branding')
        ->assertPresent('[data-slot="color-applied-light"] code:text-is("#887100")');

    $css = BrandPalette::derive('#ffd600', 10)->css();
    $applied = json_decode((string) $page->script(<<<'SCRIPT'
        () => {
            const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
            const rgb = (color) => {
                canvas.clearRect(0, 0, 1, 1);
                canvas.fillStyle = color;
                canvas.fillRect(0, 0, 1, 1);

                return [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3);
            };
            const button = document.querySelector('[data-slot="unsaved-bar"] button[type="submit"]');

            return JSON.stringify({
                css: document.getElementById('skrum-brand')?.textContent ?? null,
                primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
                field: document.querySelector('[data-slot="color-field"] [data-slot="text-field"] input').value,
                expected: rgb('#887100'),
                button: rgb(getComputedStyle(button).backgroundColor),
            });
        }
        SCRIPT), true, flags: JSON_THROW_ON_ERROR);

    expect($applied['css'])->toBe($css)
        ->and(max(array_map(fn (int $channel, int $expected): int => abs($channel - $expected), $applied['button'], $applied['expected'])))->toBeLessThanOrEqual(2)
        ->and($applied['primary'])->not->toBe('')
        ->and($css)->toContain("--primary: {$applied['primary']}")
        ->and($applied['field'])->toBe('#ffd600');
});

it('answers 403 to a signed-in member who is not an instance admin and shows them no Administration entry', function () {
    $member = brandingMember('Mia Member');

    $page = $this->signIn($member, '/about');

    $page->assertPresent('[data-slot="about"]')
        ->assertNotPresent(BrandingSidebarAdminLink)
        ->assertDontSee('Administration');

    $statuses = json_decode((string) $page->script(<<<'SCRIPT'
        () => Promise.all(['/admin', '/admin/branding', '/admin/admins', '/admin/branding/preview?color=ffd600', '/admin/admins/candidates?query=mia']
            .map((path) => fetch(path, { headers: { Accept: 'application/json' } }).then((response) => response.status)))
            .then((statuses) => JSON.stringify(statuses))
        SCRIPT), true, flags: JSON_THROW_ON_ERROR);

    expect($statuses)->toBe([403, 403, 403, 403, 403]);

    $page->navigate('/admin/branding')
        ->assertSee('403')
        ->assertNotPresent('[data-slot="branding-form"]');

    expect(brandingStoredSettings())->toBeEmpty();
});

it('shows an uploaded PNG logo in the sidebar brand and on the branding page, and removes it on Save after a confirmation', function () {
    Storage::fake(BrandAssets::Disk);

    $admin = brandingMember('Fran Facilitator', admin: true);

    resolve(BrandAssets::class)->store(
        'logo-light',
        UploadedFile::fake()->createWithContent('logo.png', (string) base64_decode(WhiteboardPng, true)),
    );
    app()->forgetScopedInstances();

    expect(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toHaveCount(1);

    $page = $this->signIn($admin, '/admin/branding');

    $sidebarLogo = '[data-slot="sidebar"] a[aria-label="Skrum"] img[src*="/brand/logo-light"]';

    passwordConfirmedPage($page, '/admin/branding')
        ->assertCount(BrandingUploader, 1)
        ->assertPresent('[role="radiogroup"][aria-label="Logo"] [role="radio"][aria-checked="true"]:has-text("Light logo")')
        ->assertPresent($sidebarLogo)
        ->assertPresent(BrandingUploader.' [data-slot="asset-preview"] img[src*="/brand/logo-light"]')
        ->assertScript("Array.from(document.querySelectorAll('img[src*=\"/brand/logo-light\"]')).every((image) => image.complete && image.naturalWidth === 1)", true);

    $page->click(BrandingUploader.' button:has-text("Remove")')
        ->assertSeeIn('[role="alertdialog"]', 'Remove this image?');

    $page->click('[role="alertdialog"] button:has-text("Remove")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSeeIn(BrandingUploader, 'No image')
        ->assertSeeIn(BrandingUnsavedBar.' [role="status"]', '1 unsaved change')
        ->assertPresent($sidebarLogo);

    expect(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toHaveCount(1);

    brandingSave($page)
        ->assertNotPresent('img[src*="/brand/logo-light"]')
        ->assertPresent('[data-slot="sidebar"] a[aria-label="Skrum"] svg');

    expect(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toBeEmpty()
        ->and(brandingStoredSettings())->toBeEmpty();
});

it('shows a staged logo in the live preview before Save and on the login page after Save', function () {
    Storage::fake(BrandAssets::Disk);
    $this->acceptUploads();

    $admin = brandingMember('Fran Facilitator', admin: true);
    $file = $this->temporaryFile('staged-logo.png', (string) base64_decode(WhiteboardPng, true));

    $page = $this->signIn($admin, '/admin/branding');

    passwordConfirmedPage($page, '/admin/branding')
        ->assertNotPresent('[data-slot="brand-preview-logo"]')
        ->click('[role="radiogroup"][aria-label="Logo"] [role="radio"]:has-text("Light logo")')
        ->attach(BrandingUploader.' input[type="file"]', $file)
        ->assertPresent('[data-slot="brand-preview-logo"][src^="blob:"]')
        ->assertPresent(BrandingUploader.' [data-slot="asset-preview"] img[src^="blob:"]')
        ->assertSeeIn(BrandingUploader, 'staged-logo.png')
        ->assertSeeIn(BrandingUploader, 'Not saved')
        ->assertSeeIn(BrandingUnsavedBar.' [role="status"]', '1 unsaved change')
        ->assertNotPresent('img[src*="/brand/logo-light"]');

    expect(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toBeEmpty();

    brandingSave($page)
        ->assertPresent('[data-slot="brand-preview-logo"][src*="/brand/logo-light"]')
        ->assertPresent('[data-slot="sidebar"] a[aria-label="Skrum"] img[src*="/brand/logo-light"]')
        ->assertNotPresent('[data-slot="asset-staged"]');

    expect(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toHaveCount(1)
        ->and($this->sendFromPage($page, 'POST', '/logout')['status'])->toBeLessThan(400);

    $page->navigate('/login')->assertPathIs('/login');

    $logo = json_decode((string) $page->script(<<<'JAVASCRIPT'
        () => {
            const holder = document.querySelector('script[data-page]') ?? document.querySelector('[data-page]');
            const data = JSON.parse(holder.tagName === 'SCRIPT' ? holder.textContent : holder.dataset.page);
            const url = data.props.brand.logoLightUrl;

            return new Promise((resolve) => {
                const image = new Image();

                image.onload = () => resolve(JSON.stringify({ url, width: image.naturalWidth }));
                image.onerror = () => resolve(JSON.stringify({ url, width: 0 }));
                image.src = url ?? 'about:blank';
            });
        }
        JAVASCRIPT), true, flags: JSON_THROW_ON_ERROR);

    expect($logo['url'])->toContain('/brand/logo-light')
        ->and($logo['width'])->toBe(1);
});

it('shows the exact value of a stored radius outside the segments and undoes each staged image on its own', function () {
    Storage::fake(BrandAssets::Disk);

    $admin = brandingMember('Fran Facilitator', admin: true);
    $file = $this->temporaryFile('undo-favicon.png', (string) base64_decode(WhiteboardPng, true));

    resolve(BrandAssets::class)->store(
        'logo-light',
        UploadedFile::fake()->createWithContent('logo.png', (string) base64_decode(WhiteboardPng, true)),
    );
    resolve(InstanceSettings::class)->setMany(['brand_radius' => 6]);
    app()->forgetScopedInstances();

    $page = $this->signIn($admin, '/admin/branding');

    $radius = '[role="radiogroup"][aria-label="Corner radius"]';
    $images = '[role="radiogroup"][aria-label="Logo"]';

    passwordConfirmedPage($page, '/admin/branding')
        ->assertNotPresent($radius.' [role="radio"][aria-checked="true"]')
        ->assertValue('input[aria-label="Exact radius in pixels"]', '6')
        ->assertSeeIn(BrandingUnsavedBar.' [role="status"]', 'No unsaved changes')
        ->assertNotPresent('[data-slot="asset-undo"]');

    $page->click(BrandingUploader.' button:has-text("Remove")')
        ->click('[role="alertdialog"] button:has-text("Remove")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSeeIn(BrandingUploader, 'No image')
        ->click($images.' [role="radio"]:has-text("Favicon")')
        ->attach(BrandingUploader.' input[type="file"]', $file)
        ->assertSeeIn(BrandingUploader, 'undo-favicon.png')
        ->assertSeeIn(BrandingUnsavedBar.' [role="status"]', '2 unsaved changes');

    $page->click($images.' [role="radio"]:has-text("Light logo")')
        ->click(BrandingUploader.' button:has-text("Undo")')
        ->assertPresent(BrandingUploader.' [data-slot="asset-preview"] img[src*="/brand/logo-light"]')
        ->assertNotPresent('[data-slot="asset-undo"]')
        ->assertSeeIn(BrandingUnsavedBar.' [role="status"]', '1 unsaved change');

    $page->click($images.' [role="radio"]:has-text("Favicon")')
        ->assertSeeIn(BrandingUploader, 'undo-favicon.png')
        ->click(BrandingUploader.' button:has-text("Undo")')
        ->assertSeeIn(BrandingUploader, 'No image')
        ->assertSeeIn(BrandingUnsavedBar.' [role="status"]', 'No unsaved changes');

    $page->click($radius.' [role="radio"]:has-text("Soft")')
        ->assertValue('input[aria-label="Exact radius in pixels"]', '4')
        ->assertSeeIn(BrandingUnsavedBar.' [role="status"]', '1 unsaved change');

    brandingSave($page);

    expect(brandingStoredSettings())->toHaveKey('logo_light')
        ->and(brandingStoredSettings()['brand_radius'])->toBe(4)
        ->and(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toHaveCount(1);
});

it('grants admin rights through the search, revokes them, and keeps the dialog open with the server message when the last admin would go', function () {
    $admin = brandingMember('Fran Facilitator', admin: true);
    $hedy = brandingMember('Hedy Lamarr');

    $page = $this->signIn($admin, '/admin/admins');

    passwordConfirmedPage($page, '/admin/admins')
        ->assertPresent('[data-slot="admin-shell"] nav[aria-label="Administration"] a[aria-current="page"]:has-text("Admins")')
        ->assertCount('[data-slot="admin-row"]', 1)
        ->assertDisabled('button[aria-label="Revoke admin rights of Fran Facilitator"]')
        ->assertSeeIn('[data-slot="admin-revoke-reason"]', 'An instance needs at least one admin.')
        ->assertDisabled('button:has-text("Grant admin rights")');

    $page->click('[data-slot="candidate-combobox"] [role="combobox"]')
        ->assertSee('Type at least 2 characters to search.')
        ->fill('[data-slot="command-input"]', 'hed')
        ->click('[role="option"]:has-text("Hedy Lamarr")')
        ->assertSeeIn('[data-slot="candidate-combobox"] [role="combobox"]', 'Hedy Lamarr');

    expect($hedy->fresh()->is_instance_admin)->toBeFalse();

    $page->click('button:has-text("Grant admin rights")')
        ->assertPresent('[data-slot="admin-row"]:has-text("Hedy Lamarr")')
        ->assertCount('[data-slot="admin-row"]', 2)
        ->assertEnabled('button[aria-label="Revoke admin rights of Fran Facilitator"]');

    expect($hedy->fresh()->is_instance_admin)->toBeTrue();

    $page->click('button[aria-label="Revoke admin rights of Hedy Lamarr"]')
        ->assertSeeIn('[role="alertdialog"]', 'Revoke admin rights of Hedy Lamarr?');

    expect($hedy->fresh()->is_instance_admin)->toBeTrue();

    $page->click('[role="alertdialog"] button:has-text("Revoke")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertNotPresent('[data-slot="admin-row"]:has-text("Hedy Lamarr")')
        ->assertDisabled('button[aria-label="Revoke admin rights of Fran Facilitator"]');

    expect($hedy->fresh()->is_instance_admin)->toBeFalse();

    User::query()->whereKey($hedy->id)->update(['is_instance_admin' => true]);

    $page->navigate('/admin/admins')
        ->assertCount('[data-slot="admin-row"]', 2)
        ->click('button[aria-label="Revoke admin rights of Fran Facilitator"]')
        ->assertSeeIn('[role="alertdialog"]', 'Revoke your own admin rights?');

    User::query()->whereKey($hedy->id)->update(['is_instance_admin' => false]);

    $page->click('[role="alertdialog"] button:has-text("Revoke")')
        ->assertSeeIn('[role="alertdialog"] [data-slot="dialog-error"]', 'An instance needs at least one admin.')
        ->assertPresent('[role="alertdialog"]')
        ->assertPathIs('/admin/admins');

    expect($admin->fresh()->is_instance_admin)->toBeTrue();
});

it('lists the attribution of a CC BY avatar style on the About page once the admin has selected it', function () {
    $admin = brandingMember('Fran Facilitator', admin: true);

    $page = $this->signIn($admin, '/about');

    $page->assertSeeIn('[data-slot="about-attributions-empty"]', 'The avatar style in use needs no attribution.')
        ->assertNotPresent('[data-slot="about-attribution"]');

    $page->navigate('/admin/branding');

    passwordConfirmedPage($page, '/admin/branding')
        ->assertPresent('[data-slot="avatar-style-default"]')
        ->assertPresent('[data-slot="avatar-style-tile"][aria-checked="true"]:has-text("Thumbs")')
        ->click('[data-slot="avatar-style-tile"]:has(span:text-is("Fun Emoji"))')
        ->assertPresent('[data-slot="avatar-style-tile"][aria-checked="true"]:has-text("Fun Emoji")')
        ->assertNotPresent('[data-slot="avatar-style-default"]')
        ->assertSeeIn('[data-slot="avatar-attribution"]', 'This style requires attribution, shown on the About page: Fun Emoji Set by Davis Uche, CC BY 4.0');

    brandingSave($page);

    expect(brandingStoredSettings())->toBe(['avatar_style' => 'fun-emoji']);

    $page->navigate('/about')
        ->assertNotPresent('[data-slot="about-attributions-empty"]')
        ->assertCount('[data-slot="about-attribution"]', 1)
        ->assertSeeIn('[data-slot="about-attribution"]', 'Fun Emoji Set by Davis Uche')
        ->assertPresent('[data-slot="about-attribution"] [data-slot="badge"]:has-text("CC BY 4.0")')
        ->assertPresent('[data-slot="about-attribution"] a[target="_blank"][rel="noreferrer noopener"][aria-label="Source of Fun Emoji (opens in a new tab)"]');
});

it('lets a member pick their own avatar style when the instance allows it, which changes the address of their avatar', function () {
    resolve(InstanceSettings::class)->set('avatar_member_choice', true);
    app()->forgetScopedInstances();

    $member = brandingMember('Mia Member');
    $before = $member->avatarUrl();

    $page = $this->signIn($member, '/settings/profile');

    $card = '[data-slot="avatar-style-card"]';

    $page->assertPresent("{$card} [data-slot=\"avatar-style-tile\"][aria-checked=\"true\"]:has-text(\"Thumbs\")")
        ->assertNotPresent("{$card} [role=\"switch\"]")
        ->assertDisabled('@update-avatar-style-button')
        ->assertNotPresent("{$card} button:has-text(\"Use the instance style\")")
        ->click("{$card} [data-slot=\"avatar-style-tile\"]:has(span:text-is(\"Lorelei\"))")
        ->assertEnabled('@update-avatar-style-button')
        ->click('@update-avatar-style-button')
        ->assertPresent("{$card} button:has-text(\"Use the instance style\")")
        ->assertPresent('img[src*="/avatars/lorelei/"]');

    app()->forgetScopedInstances();
    $after = $member->fresh()->avatarUrl();

    expect($member->fresh()->avatar_style)->toBe('lorelei')
        ->and($before)->not->toContain('/avatars/lorelei/')
        ->and($after)->toContain('/avatars/lorelei/')
        ->and($after)->not->toBe($before);
});
