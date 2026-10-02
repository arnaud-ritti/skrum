<?php

use App\Models\InstanceSetting;
use App\Models\Team;
use App\Models\User;
use App\Support\Branding\BrandAssets;
use App\Support\Branding\BrandPalette;
use App\Support\InstanceSettings;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

const P18dColorInput = '[data-slot="color-field"] [data-slot="text-field"] input';

const P18dUnsavedBar = 'header [data-slot="unsaved-bar"]';

const P18dUploader = '[data-slot="asset-uploader"]';

const P18dSidebarAdminLink = 'nav[aria-label="Team and administration"] a[aria-label="Administration"]';

function p18dMember(string $name, bool $admin = false): User
{
    $team = Team::query()->firstWhere('name', 'Demo Team') ?? Team::factory()->create(['name' => 'Demo Team']);
    $user = teamMember($team);

    $user->forceFill(['name' => $name, 'is_instance_admin' => $admin])->save();

    return $user;
}

function p18dConfirmPassword(mixed $page, string $path): mixed
{
    return $page->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs($path);
}

/**
 * @return array<string, mixed>
 */
function p18dStoredSettings(): array
{
    return InstanceSetting::query()->orderBy('key')->pluck('value', 'key')->all();
}

/**
 * The HTTP server of the browser plugin hands no uploaded file to Laravel: the
 * multipart body is read here, so that a real upload reaches the controller.
 */
function p18eAcceptUploads(): void
{
    resolve(HttpKernel::class)->prependMiddleware(function (Request $request, Closure $next): mixed {
        $contentType = (string) $request->headers->get('content-type');

        if (preg_match('/^multipart\/form-data;.*boundary=("?)([^";]+)\1/i', $contentType, $boundary) !== 1) {
            return $next($request);
        }

        foreach (explode('--'.$boundary[2], (string) $request->getContent()) as $part) {
            if (preg_match('/name="([^"]+)"; filename="([^"]+)"/', $part, $names) !== 1) {
                continue;
            }

            $path = (string) tempnam(sys_get_temp_dir(), 'p18e');

            file_put_contents($path, substr(explode("\r\n\r\n", $part, 2)[1], 0, -2));

            $request->files->set($names[1], new UploadedFile($path, $names[2], test: true));
        }

        return $next($request);
    });
}

function p18dSave(mixed $page): mixed
{
    return $page->click(P18dUnsavedBar.' button[type="submit"]:has-text("Save")')
        ->assertSeeIn(P18dUnsavedBar.' [role="status"]', 'No unsaved changes');
}

beforeEach(function () {
    config([
        'app.name' => 'Skrum',
        'skrum.avatar_style' => 'thumbs',
        'services.gifs.provider' => null,
        'services.gifs.key' => null,
    ]);
});

it('[P18d-01] lets an instance admin open Administration from the sidebar, change the colour with its contrast guard rail, and applies the brand after a reload', function () {
    $admin = p18dMember('Fran Facilitator', admin: true);

    $page = $this->signIn($admin, '/about');

    $page->assertPresent('[data-slot="about"]')
        ->assertNotPresent(P18dSidebarAdminLink.'[aria-current="page"]')
        ->click(P18dSidebarAdminLink);

    p18dConfirmPassword($page, '/admin/branding')
        ->assertPresent(P18dSidebarAdminLink.'[aria-current="page"]')
        ->assertPresent('nav[aria-label="Administration"] a[aria-current="page"]:has-text("Branding")')
        ->assertSeeIn(P18dUnsavedBar.' [role="status"]', 'No unsaved changes')
        ->assertPresent(P18dUnsavedBar.' button:has-text("Cancel")')
        ->assertSeeIn('[data-slot="color-entered"]', 'Skrüm default');

    expect($page->script('() => document.getElementById("skrum-brand") === null'))->toBeTrue();

    $page->fill(P18dColorInput, '#FFD600')
        ->assertPresent('[data-slot="color-entered"] code:text-is("#ffd600")')
        ->assertPresent('[data-slot="color-applied-light"] code:text-is("#8a7300")')
        ->assertPresent('[data-slot="color-applied-light"] [data-slot="contrast-badge"][data-level="AA"]:has-text("AA 4.5:1")')
        ->assertPresent('[data-slot="color-applied-dark"] [data-slot="contrast-badge"][data-level="AAA"]:has-text("AAA 9.8:1")')
        ->assertSeeIn('[data-slot="palette-warnings"]', 'Too light to carry text: lightness adjusted from 88 % to 56 % in the light theme.')
        ->assertSeeIn(P18dUnsavedBar.' [role="status"]', '1 unsaved change');

    expect($page->script('() => document.querySelector(\'[data-slot="brand-preview-stage"]\').style.getPropertyValue("--primary")'))->toBe('#8a7300')
        ->and(p18dStoredSettings())->toBeEmpty();

    p18dSave($page)->assertSee('Branding saved.');

    expect(p18dStoredSettings())->toBe(['brand_color' => '#ffd600']);

    $page->navigate('/admin/branding')
        ->assertPresent('[data-slot="color-applied-light"] code:text-is("#8a7300")');

    $css = BrandPalette::derive('#ffd600', 10)->css();
    $applied = json_decode((string) $page->script(<<<'SCRIPT'
        () => {
            const probe = document.createElement('span');
            probe.style.color = '#8a7300';
            document.body.appendChild(probe);
            const expected = getComputedStyle(probe).color;
            probe.remove();
            const button = document.querySelector('[data-slot="unsaved-bar"] button[type="submit"]');

            return JSON.stringify({
                css: document.getElementById('skrum-brand')?.textContent ?? null,
                primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
                field: document.querySelector('[data-slot="color-field"] [data-slot="text-field"] input').value,
                expected,
                button: getComputedStyle(button).backgroundColor,
            });
        }
        SCRIPT), true, flags: JSON_THROW_ON_ERROR);

    expect($applied['css'])->toBe($css)
        ->and($applied['primary'])->not->toBe('')
        ->and($css)->toContain("--primary: {$applied['primary']}")
        ->and($applied['field'])->toBe('#ffd600');
});

it('[P18d-02] answers 403 to a signed-in member who is not an instance admin and shows them no Administration entry', function () {
    $member = p18dMember('Mia Member');

    $page = $this->signIn($member, '/about');

    $page->assertPresent('[data-slot="about"]')
        ->assertNotPresent(P18dSidebarAdminLink)
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

    expect(p18dStoredSettings())->toBeEmpty();
});

it('[P18d-03] shows an uploaded PNG logo in the sidebar brand and on the branding page, and removes it on Save after a confirmation', function () {
    Storage::fake(BrandAssets::Disk);

    $admin = p18dMember('Fran Facilitator', admin: true);

    resolve(BrandAssets::class)->store(
        'logo-light',
        UploadedFile::fake()->createWithContent('logo.png', (string) base64_decode(WhiteboardPng, true)),
    );
    app()->forgetScopedInstances();

    expect(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toHaveCount(1);

    $page = $this->signIn($admin, '/admin/branding');

    $sidebarLogo = '[data-slot="sidebar"] a[aria-label="Skrum"] img[src*="/brand/logo-light"]';

    p18dConfirmPassword($page, '/admin/branding')
        ->assertCount(P18dUploader, 1)
        ->assertPresent('[role="radiogroup"][aria-label="Image"] [role="radio"][aria-checked="true"]:has-text("Light logo")')
        ->assertPresent($sidebarLogo)
        ->assertPresent(P18dUploader.' img[alt="Current image: Light logo"][src*="/brand/logo-light"]')
        ->assertScript("Array.from(document.querySelectorAll('img[src*=\"/brand/logo-light\"]')).every((image) => image.complete && image.naturalWidth === 1)", true);

    $page->click(P18dUploader.' button:has-text("Remove")')
        ->assertSeeIn('[role="alertdialog"]', 'Remove this image?');

    $page->click('[role="alertdialog"] button:has-text("Remove")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSeeIn(P18dUploader, 'No image')
        ->assertSeeIn(P18dUnsavedBar.' [role="status"]', '1 unsaved change')
        ->assertPresent($sidebarLogo);

    expect(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toHaveCount(1);

    p18dSave($page)
        ->assertNotPresent('img[src*="/brand/logo-light"]')
        ->assertPresent('[data-slot="sidebar"] a[aria-label="Skrum"] svg');

    expect(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toBeEmpty()
        ->and(p18dStoredSettings())->toBeEmpty();
});

it('[P18e-00-01] shows a staged logo in the live preview before Save and on the login page after Save', function () {
    Storage::fake(BrandAssets::Disk);
    p18eAcceptUploads();

    $admin = p18dMember('Fran Facilitator', admin: true);
    $file = sys_get_temp_dir().'/p18e-staged-logo.png';

    file_put_contents($file, (string) base64_decode(WhiteboardPng, true));

    $page = $this->signIn($admin, '/admin/branding');

    p18dConfirmPassword($page, '/admin/branding')
        ->assertNotPresent('[data-slot="brand-preview-logo"]')
        ->click('[role="radiogroup"][aria-label="Image"] [role="radio"]:has-text("Light logo")')
        ->attach(P18dUploader.' input[type="file"]', $file)
        ->assertPresent('[data-slot="brand-preview-logo"][src^="blob:"]')
        ->assertPresent(P18dUploader.' img[alt="Current image: Light logo"][src^="blob:"]')
        ->assertSeeIn(P18dUploader, 'p18e-staged-logo.png')
        ->assertSeeIn(P18dUploader, 'Not saved')
        ->assertSeeIn(P18dUnsavedBar.' [role="status"]', '1 unsaved change')
        ->assertNotPresent('img[src*="/brand/logo-light"]');

    expect(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toBeEmpty();

    p18dSave($page)
        ->assertPresent('[data-slot="brand-preview-logo"][src*="/brand/logo-light"]')
        ->assertPresent('[data-slot="sidebar"] a[aria-label="Skrum"] img[src*="/brand/logo-light"]')
        ->assertNotPresent('[data-slot="asset-staged"]');

    expect(Storage::disk(BrandAssets::Disk)->allFiles(BrandAssets::Directory))->toHaveCount(1);

    $status = $page->script(<<<'JS'
        () => {
            const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN=')).slice('XSRF-TOKEN='.length);

            return fetch('/logout', {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) },
            }).then((response) => response.status);
        }
        JS);

    expect($status)->toBeLessThan(400);

    $page->navigate('/login')->assertPathIs('/login');

    $logo = json_decode((string) $page->script(<<<'JS'
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
        JS), true, flags: JSON_THROW_ON_ERROR);

    expect($logo['url'])->toContain('/brand/logo-light')
        ->and($logo['width'])->toBe(1);

    unlink($file);
});

it('[P18d-04] grants admin rights through the search, revokes them, and keeps the dialog open with the server message when the last admin would go', function () {
    $admin = p18dMember('Fran Facilitator', admin: true);
    $hedy = p18dMember('Hedy Lamarr');

    $page = $this->signIn($admin, '/admin/admins');

    p18dConfirmPassword($page, '/admin/admins')
        ->assertPresent('nav[aria-label="Administration"] a[aria-current="page"]:has-text("Admins")')
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

it('[P18d-05] lists the attribution of a CC BY avatar style on the About page once the admin has selected it', function () {
    $admin = p18dMember('Fran Facilitator', admin: true);

    $page = $this->signIn($admin, '/about');

    $page->assertSeeIn('[data-slot="about-attributions-empty"]', 'The avatar style in use needs no attribution.')
        ->assertNotPresent('[data-slot="about-attribution"]');

    $page->navigate('/admin/branding');

    p18dConfirmPassword($page, '/admin/branding')
        ->assertPresent('[data-slot="avatar-style-default"]')
        ->assertPresent('[data-slot="avatar-style-tile"][aria-checked="true"]:has-text("Thumbs")')
        ->click('[data-slot="avatar-style-tile"]:has(span:text-is("Fun Emoji"))')
        ->assertPresent('[data-slot="avatar-style-tile"][aria-checked="true"]:has-text("Fun Emoji")')
        ->assertNotPresent('[data-slot="avatar-style-default"]')
        ->assertSeeIn('[data-slot="avatar-attribution"]', 'This style requires attribution, shown on the About page: Fun Emoji Set by Davis Uche, CC BY 4.0');

    p18dSave($page);

    expect(p18dStoredSettings())->toBe(['avatar_style' => 'fun-emoji']);

    $page->navigate('/about')
        ->assertNotPresent('[data-slot="about-attributions-empty"]')
        ->assertCount('[data-slot="about-attribution"]', 1)
        ->assertSeeIn('[data-slot="about-attribution"]', 'Fun Emoji Set by Davis Uche')
        ->assertPresent('[data-slot="about-attribution"] [data-slot="badge"]:has-text("CC BY 4.0")')
        ->assertPresent('[data-slot="about-attribution"] a[target="_blank"][rel="noreferrer noopener"][aria-label="Source of Fun Emoji (opens in a new tab)"]');
});

it('[P18d-06] lets a member pick their own avatar style when the instance allows it, which changes the address of their avatar', function () {
    resolve(InstanceSettings::class)->set('avatar_member_choice', true);
    app()->forgetScopedInstances();

    $member = p18dMember('Mia Member');
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
