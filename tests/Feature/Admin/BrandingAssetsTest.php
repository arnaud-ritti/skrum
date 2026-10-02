<?php

use App\Models\User;
use App\Support\Branding\BrandAssets;
use App\Support\InstanceSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

const AdminAssetPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const AdminAssetHostileSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="1" height="1"/></svg>';

function adminAssetUpload(string $name, string $contents): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, $contents);
}

function adminAssetSettings(): InstanceSettings
{
    app()->forgetScopedInstances();

    return resolve(InstanceSettings::class);
}

beforeEach(function () {
    Storage::fake('local');

    $this->actingAs(User::factory()->instanceAdmin()->create())
        ->withSession(['auth.password_confirmed_at' => time()]);
});

it('stores an uploaded png which the brand route then serves', function (string $asset, string $getter) {
    $png = base64_decode(AdminAssetPng);

    $this->post(route('admin.brandingAssets.store', $asset), ['file' => adminAssetUpload('logo.png', $png)])
        ->assertRedirect(route('admin.branding.edit'))
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.type', 'success');

    expect(adminAssetSettings()->{$getter}())->toMatch('/^branding\/[a-z0-9]{40}\.png$/');

    app()->forgetScopedInstances();
    $served = $this->get(route('brand.show', $asset))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/png')
        ->assertHeader('X-Content-Type-Options', 'nosniff');

    expect($served->getContent())->toBe($png);
})->with([
    'light logo' => ['logo-light', 'logoLight'],
    'dark logo' => ['logo-dark', 'logoDark'],
    'favicon' => ['favicon', 'favicon'],
]);

it('shows the uploaded images on the branding page', function () {
    $this->post(route('admin.brandingAssets.store', 'logo-light'), ['file' => adminAssetUpload('logo.png', base64_decode(AdminAssetPng))]);

    app()->forgetScopedInstances();
    $url = resolve(BrandAssets::class)->url('logo-light');

    $this->get(route('admin.branding.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('assets.logoLightUrl', $url)
            ->where('assets.logoDarkUrl', null)
            ->where('assets.faviconUrl', null)
            ->where('brand.logoLightUrl', $url));

    expect($url)->toStartWith('/brand/logo-light?v=');
});

it('refuses a 600 KB image with an error on the file field', function () {
    $this->postJson(route('admin.brandingAssets.store', 'logo-light'), ['file' => UploadedFile::fake()->create('logo.png', 600, 'image/png')])
        ->assertUnprocessable()
        ->assertJsonPath('errors.file.0', 'The image must not be larger than 512 KB.');

    expect(adminAssetSettings()->logoLight())->toBeNull()
        ->and(Storage::disk('local')->allFiles())->toBeEmpty();
});

it('refuses a file whose content is not an image whatever its name', function (string $name, string $contents) {
    $this->postJson(route('admin.brandingAssets.store', 'logo-light'), ['file' => adminAssetUpload($name, $contents)])
        ->assertUnprocessable()
        ->assertJsonPath('errors.file.0', 'The image must be a PNG, JPEG, WebP or SVG file.');

    expect(adminAssetSettings()->logoLight())->toBeNull()
        ->and(Storage::disk('local')->allFiles())->toBeEmpty();
})->with([
    'php renamed png' => ['logo.png', '<?php echo shell_exec($_GET["c"]);'],
    'php renamed svg' => ['logo.svg', '<?php echo 1; ?><svg xmlns="http://www.w3.org/2000/svg"/>'],
    'html page' => ['logo.svg', '<html><body><script>alert(1)</script></body></html>'],
    'gif' => ['logo.gif', "GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"],
]);

it('reports the refusal as a form error to an Inertia visit', function () {
    $this->from(route('admin.branding.edit'))
        ->post(route('admin.brandingAssets.store', 'logo-light'), ['file' => adminAssetUpload('logo.png', '<?php echo 1;')])
        ->assertRedirect(route('admin.branding.edit'))
        ->assertSessionHasErrors(['file' => 'The image must be a PNG, JPEG, WebP or SVG file.']);
});

it('refuses a request without a file or with a plain string', function (mixed $file) {
    $this->postJson(route('admin.brandingAssets.store', 'logo-light'), ['file' => $file])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('file');
})->with([null, 'logo.png']);

it('accepts an svg with a script and serves it inert', function () {
    $this->post(route('admin.brandingAssets.store', 'logo-dark'), ['file' => adminAssetUpload('logo.svg', AdminAssetHostileSvg)])
        ->assertSessionHasNoErrors();

    app()->forgetScopedInstances();
    $this->get(route('brand.show', 'logo-dark'))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/svg+xml')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");

    app()->forgetScopedInstances();
    $html = $this->get(route('admin.branding.edit'))->assertOk()->getContent();

    expect($html)->not->toContain('<script>alert(1)</script>')
        ->not->toContain('onload="alert(1)"');
});

it('keeps the current image when its replacement is refused', function () {
    $this->post(route('admin.brandingAssets.store', 'logo-light'), ['file' => adminAssetUpload('logo.png', base64_decode(AdminAssetPng))]);
    $path = adminAssetSettings()->logoLight();

    $this->postJson(route('admin.brandingAssets.store', 'logo-light'), ['file' => adminAssetUpload('logo.png', '<?php echo 1;')])
        ->assertUnprocessable();

    expect(adminAssetSettings()->logoLight())->toBe($path)
        ->and(Storage::disk('local')->exists($path))->toBeTrue();
});

it('removes the file and the setting of one image only', function () {
    $png = base64_decode(AdminAssetPng);
    $this->post(route('admin.brandingAssets.store', 'logo-light'), ['file' => adminAssetUpload('logo.png', $png)]);
    $this->post(route('admin.brandingAssets.store', 'favicon'), ['file' => adminAssetUpload('favicon.png', $png)]);
    $path = adminAssetSettings()->logoLight();
    $faviconPath = adminAssetSettings()->favicon();

    $this->delete(route('admin.brandingAssets.destroy', 'logo-light'))
        ->assertRedirect(route('admin.branding.edit'))
        ->assertInertiaFlash('toast.type', 'success');

    expect(adminAssetSettings()->logoLight())->toBeNull()
        ->and(adminAssetSettings()->favicon())->toBe($faviconPath)
        ->and(Storage::disk('local')->exists($path))->toBeFalse()
        ->and(Storage::disk('local')->exists($faviconPath))->toBeTrue();

    app()->forgetScopedInstances();
    $this->get(route('brand.show', 'logo-light'))->assertNotFound();
});

it('does not route an unknown asset name', function (string $method) {
    $this->{$method}('/admin/branding/assets/banner', ['file' => adminAssetUpload('logo.png', base64_decode(AdminAssetPng))])
        ->assertNotFound();
})->with(['post', 'delete']);
