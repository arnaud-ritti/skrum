<?php

use App\Models\User;
use App\Support\Branding\BrandAssets;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

const AdminAssetHostileSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="1" height="1"/></svg>';

function adminAssetWidePng(int $width = 128): string
{
    ob_start();
    imagepng(imagecreatetruecolor($width, 28));

    return (string) ob_get_clean();
}

beforeEach(function () {
    Storage::fake('local');

    $this->actingAs(User::factory()->instanceAdmin()->create())
        ->withSession(['auth.password_confirmed_at' => time()]);
});

it('stores an uploaded png which the brand route then serves', function (string $asset, string $getter) {
    $png = adminAssetWidePng();

    $this->post(route('admin.brandingAssets.store', $asset), ['file' => UploadedFile::fake()->createWithContent('logo.png', $png)])
        ->assertRedirect(route('admin.branding.edit'))
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.type', 'success');

    expect(freshInstanceSettings()->{$getter}())->toMatch('/^branding\/[a-z0-9]{40}\.png$/');

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
    'mail logo' => ['logo-mail', 'logoMail'],
]);

it('refuses a logo for e-mails that mail clients cannot draw', function (string $name, Closure $contents) {
    $this->postJson(route('admin.brandingAssets.store', 'logo-mail'), ['file' => UploadedFile::fake()->createWithContent($name, $contents())])
        ->assertUnprocessable()
        ->assertJsonPath('errors.file.0', 'The logo for emails must be a PNG or JPEG image at least 128 px wide.');

    expect(freshInstanceSettings()->logoMail())->toBeNull()
        ->and(Storage::disk('local')->allFiles())->toBeEmpty();
})->with([
    'svg' => ['logo.svg', fn (): string => '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'],
    'webp' => ['logo.webp', fn (): string => "RIFF\x1A\x00\x00\x00WEBPVP8L\x0D\x00\x00\x00\x2F\x00\x00\x00\x10\x07\x10\x11\x11\x88\x88\xFE\x07\x00"],
    'png 127 px wide' => ['logo.png', fn (): string => adminAssetWidePng(127)],
]);

it('tells the branding page when e-mails show the name instead of the logo', function () {
    $this->post(route('admin.brandingAssets.store', 'logo-light'), ['file' => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>')]);

    app()->forgetScopedInstances();
    $this->get(route('admin.branding.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('assets.mailShowsName', true)->where('assets.logoMailUrl', null));

    $this->post(route('admin.brandingAssets.store', 'logo-mail'), ['file' => UploadedFile::fake()->createWithContent('logo.png', adminAssetWidePng())]);

    app()->forgetScopedInstances();
    $this->get(route('admin.branding.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('assets.mailShowsName', false)
            ->where('assets.logoMailUrl', resolve(BrandAssets::class)->url('logo-mail')));
});

it('shows the uploaded images on the branding page', function () {
    $this->post(route('admin.brandingAssets.store', 'logo-light'), ['file' => UploadedFile::fake()->createWithContent('logo.png', pngBytes())]);

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

    expect(freshInstanceSettings()->logoLight())->toBeNull()
        ->and(Storage::disk('local')->allFiles())->toBeEmpty();
});

it('refuses a file whose content is not an image whatever its name', function (string $name, string $contents) {
    $this->postJson(route('admin.brandingAssets.store', 'logo-light'), ['file' => UploadedFile::fake()->createWithContent($name, $contents)])
        ->assertUnprocessable()
        ->assertJsonPath('errors.file.0', 'The image must be a PNG, JPEG, WebP or SVG file.');

    expect(freshInstanceSettings()->logoLight())->toBeNull()
        ->and(Storage::disk('local')->allFiles())->toBeEmpty();
})->with([
    'php renamed png' => ['logo.png', '<?php echo shell_exec($_GET["c"]);'],
    'php renamed svg' => ['logo.svg', '<?php echo 1; ?><svg xmlns="http://www.w3.org/2000/svg"/>'],
    'html page' => ['logo.svg', '<html><body><script>alert(1)</script></body></html>'],
    'gif' => ['logo.gif', "GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"],
]);

it('reports the refusal as a form error to an Inertia visit', function () {
    $this->from(route('admin.branding.edit'))
        ->post(route('admin.brandingAssets.store', 'logo-light'), ['file' => UploadedFile::fake()->createWithContent('logo.png', '<?php echo 1;')])
        ->assertRedirect(route('admin.branding.edit'))
        ->assertSessionHasErrors(['file' => 'The image must be a PNG, JPEG, WebP or SVG file.']);
});

it('refuses a request without a file or with a plain string', function (mixed $file) {
    $this->postJson(route('admin.brandingAssets.store', 'logo-light'), ['file' => $file])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('file');
})->with([null, 'logo.png']);

it('accepts an svg with a script and serves it inert', function () {
    $this->post(route('admin.brandingAssets.store', 'logo-dark'), ['file' => UploadedFile::fake()->createWithContent('logo.svg', AdminAssetHostileSvg)])
        ->assertSessionHasNoErrors();

    app()->forgetScopedInstances();
    $this->get(route('brand.show', 'logo-dark'))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/svg+xml')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; sandbox");

    app()->forgetScopedInstances();
    $html = $this->get(route('admin.branding.edit'))->assertOk()->getContent();

    expect($html)->not->toContain('<script>alert(1)</script>')
        ->not->toContain('onload="alert(1)"');
});

it('keeps the current image when its replacement is refused', function () {
    $this->post(route('admin.brandingAssets.store', 'logo-light'), ['file' => UploadedFile::fake()->createWithContent('logo.png', pngBytes())]);
    $path = freshInstanceSettings()->logoLight();

    $this->postJson(route('admin.brandingAssets.store', 'logo-light'), ['file' => UploadedFile::fake()->createWithContent('logo.png', '<?php echo 1;')])
        ->assertUnprocessable();

    expect(freshInstanceSettings()->logoLight())->toBe($path)
        ->and(Storage::disk('local')->exists($path))->toBeTrue();
});

it('removes the file and the setting of one image only', function () {
    $png = pngBytes();
    $this->post(route('admin.brandingAssets.store', 'logo-light'), ['file' => UploadedFile::fake()->createWithContent('logo.png', $png)]);
    $this->post(route('admin.brandingAssets.store', 'favicon'), ['file' => UploadedFile::fake()->createWithContent('favicon.png', $png)]);
    $path = freshInstanceSettings()->logoLight();
    $faviconPath = freshInstanceSettings()->favicon();

    $this->delete(route('admin.brandingAssets.destroy', 'logo-light'))
        ->assertRedirect(route('admin.branding.edit'))
        ->assertInertiaFlash('toast.type', 'success');

    expect(freshInstanceSettings()->logoLight())->toBeNull()
        ->and(freshInstanceSettings()->favicon())->toBe($faviconPath)
        ->and(Storage::disk('local')->exists($path))->toBeFalse()
        ->and(Storage::disk('local')->exists($faviconPath))->toBeTrue();

    app()->forgetScopedInstances();
    $this->get(route('brand.show', 'logo-light'))->assertNotFound();
});

it('does not route an unknown asset name', function (string $method) {
    $this->{$method}('/admin/branding/assets/banner', ['file' => UploadedFile::fake()->createWithContent('logo.png', pngBytes())])
        ->assertNotFound();
})->with(['post', 'delete']);
