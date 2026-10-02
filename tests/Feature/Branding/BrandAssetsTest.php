<?php

use App\Enums\InstanceSettingKey;
use App\Exceptions\InvalidBrandAsset;
use App\Models\InstanceSetting;
use App\Support\Branding\BrandAssets;
use App\Support\InstanceSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

const HostileBrandSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="1" height="1"/></svg>';

function brandPngBytes(): string
{
    return (string) base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', true);
}

function brandJpegBytes(): string
{
    return "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9";
}

function brandWebpBytes(): string
{
    return "RIFF\x1A\x00\x00\x00WEBPVP8L\x0D\x00\x00\x00\x2F\x00\x00\x00\x10\x07\x10\x11\x11\x88\x88\xFE\x07\x00";
}

function brandUpload(string $name, string $contents): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, $contents);
}

function brandFiles(): array
{
    return Storage::disk('local')->allFiles();
}

beforeEach(function () {
    Storage::fake('local');
});

it('answers 404 for an asset that is not set', function (string $asset) {
    $this->get("/brand/{$asset}")->assertNotFound();

    expect(resolve(BrandAssets::class)->url($asset))->toBeNull();
})->with(['logo-light', 'logo-dark', 'favicon']);

it('does not route an unknown asset name', function (string $asset) {
    $this->get("/brand/{$asset}")->assertNotFound();
})->with(['logo', 'logo-light.png', 'branding', '..']);

it('serves a stored PNG to a guest with safe, cacheable headers', function () {
    $assets = resolve(BrandAssets::class);
    $assets->store('logo-light', brandUpload('logo.png', brandPngBytes()));

    $response = $this->get($assets->url('logo-light'))->assertOk();

    expect($response->getContent())->toBe(brandPngBytes())
        ->and($response->headers->get('Content-Type'))->toBe('image/png')
        ->and($response->headers->get('Content-Security-Policy'))->toBe("default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; sandbox")
        ->and($response->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($response->headers->get('Cache-Control'))->toContain('public')
        ->toContain('max-age=31536000')
        ->toContain('immutable')
        ->and($response->headers->getCookies())->toBe([]);
});

it('serves a stored SVG inert, behind a content security policy', function () {
    $assets = resolve(BrandAssets::class);
    $assets->store('logo-dark', brandUpload('logo.svg', HostileBrandSvg));

    $response = $this->get($assets->url('logo-dark'))->assertOk();

    expect($response->getContent())->toBe(HostileBrandSvg)
        ->and($response->headers->get('Content-Type'))->toBe('image/svg+xml')
        ->and($response->headers->get('Content-Security-Policy'))->toBe("default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; sandbox")
        ->and($response->headers->get('X-Content-Type-Options'))->toBe('nosniff');
});

it('never inlines a stored SVG in a page', function () {
    resolve(BrandAssets::class)->store('logo-light', brandUpload('logo.svg', HostileBrandSvg));

    $html = $this->get(route('login'))->assertOk()->getContent();

    expect($html)->not->toContain('onload=')
        ->not->toContain('<script>alert(1)</script>');
});

it('stores each accepted type under a generated name with the extension of its content', function (string $clientName, Closure $contents, string $extension, string $mime) {
    $assets = resolve(BrandAssets::class);
    $assets->store('favicon', brandUpload($clientName, $contents()));

    $path = resolve(InstanceSettings::class)->favicon();

    expect($path)->toMatch('/^branding\/[a-z0-9]{40}\.'.$extension.'$/')
        ->and(brandFiles())->toBe([$path])
        ->and($assets->mime('favicon'))->toBe($mime)
        ->and($this->get($assets->url('favicon'))->assertOk()->headers->get('Content-Type'))->toBe($mime);
})->with([
    'png' => ['logo.png', brandPngBytes(...), 'png', 'image/png'],
    'jpeg' => ['logo.jpeg', brandJpegBytes(...), 'jpg', 'image/jpeg'],
    'webp' => ['logo.webp', brandWebpBytes(...), 'webp', 'image/webp'],
    'svg' => ['logo.svg', fn () => HostileBrandSvg, 'svg', 'image/svg+xml'],
    'svg with a declaration' => ['logo.svg', fn () => "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!-- logo -->\n<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", 'svg', 'image/svg+xml'],
    'png named as a script' => ['logo.php', brandPngBytes(...), 'png', 'image/png'],
    'svg named as a png' => ['logo.png', fn () => HostileBrandSvg, 'svg', 'image/svg+xml'],
]);

it('refuses a file whose content is not an accepted image', function (string $clientName, Closure $contents) {
    $assets = resolve(BrandAssets::class);

    expect(fn () => $assets->store('logo-light', brandUpload($clientName, $contents())))
        ->toThrow(InvalidBrandAsset::class)
        ->and(brandFiles())->toBeEmpty()
        ->and(resolve(InstanceSettings::class)->logoLight())->toBeNull()
        ->and($assets->url('logo-light'))->toBeNull();
})->with([
    'a 600 KB image' => ['logo.png', fn () => brandPngBytes().str_repeat("\0", 600 * 1024)],
    'a PHP file renamed .png' => ['logo.png', fn () => "<?php echo 'owned';"],
    'a PHP file renamed .svg' => ['logo.svg', fn () => "<?php echo 'owned'; ?><svg xmlns=\"http://www.w3.org/2000/svg\"/>"],
    'a text file' => ['logo.png', fn () => 'just some words'],
    'an HTML page' => ['logo.svg', fn () => '<html><body><svg xmlns="http://www.w3.org/2000/svg"/></body></html>'],
    'an XML file that is not an SVG' => ['logo.svg', fn () => '<?xml version="1.0"?><note>svg</note>'],
    'an SVG declaring entities' => ['logo.svg', fn () => '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>'],
    'a GIF' => ['logo.gif', fn () => 'GIF89a'.str_repeat("\0", 32)],
    'an empty file' => ['logo.png', fn () => ''],
]);

it('accepts an image of exactly 512 KB', function () {
    $contents = brandPngBytes();
    $contents .= str_repeat("\0", 512 * 1024 - strlen($contents));

    resolve(BrandAssets::class)->store('logo-light', brandUpload('logo.png', $contents));

    expect(brandFiles())->toHaveCount(1);
});

it('refuses an unknown asset name', function () {
    $assets = resolve(BrandAssets::class);

    expect(fn () => $assets->store('banner', brandUpload('logo.png', brandPngBytes())))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $assets->remove('banner'))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $assets->url('banner'))->toThrow(InvalidArgumentException::class)
        ->and(brandFiles())->toBeEmpty();
});

it('deletes the previous file when an asset is replaced and changes the version of its URL', function () {
    $assets = resolve(BrandAssets::class);
    $assets->store('logo-light', brandUpload('logo.png', brandPngBytes()));
    $firstPath = resolve(InstanceSettings::class)->logoLight();
    $firstUrl = $assets->url('logo-light');

    $assets->store('logo-light', brandUpload('logo.svg', HostileBrandSvg));
    $secondPath = resolve(InstanceSettings::class)->logoLight();

    expect($secondPath)->not->toBe($firstPath)
        ->and(brandFiles())->toBe([$secondPath])
        ->and($assets->url('logo-light'))->not->toBe($firstUrl)
        ->and($this->get($assets->url('logo-light'))->headers->get('Content-Type'))->toBe('image/svg+xml');
});

it('keeps the current asset when its replacement is refused', function () {
    $assets = resolve(BrandAssets::class);
    $assets->store('logo-light', brandUpload('logo.png', brandPngBytes()));
    $path = resolve(InstanceSettings::class)->logoLight();

    expect(fn () => $assets->store('logo-light', brandUpload('logo.png', 'just some words')))->toThrow(InvalidBrandAsset::class)
        ->and(brandFiles())->toBe([$path])
        ->and(resolve(InstanceSettings::class)->logoLight())->toBe($path);
});

it('deletes the file and the setting when an asset is removed, leaving the others', function () {
    $assets = resolve(BrandAssets::class);
    $assets->store('logo-light', brandUpload('logo.png', brandPngBytes()));
    $assets->store('favicon', brandUpload('favicon.png', brandPngBytes()));
    $faviconPath = resolve(InstanceSettings::class)->favicon();

    $assets->remove('logo-light');

    expect(brandFiles())->toBe([$faviconPath])
        ->and(resolve(InstanceSettings::class)->logoLight())->toBeNull()
        ->and($assets->url('logo-light'))->toBeNull();

    $this->get('/brand/logo-light')->assertNotFound();
    $this->get($assets->url('favicon'))->assertOk();
});

it('never serves or deletes a stored path outside the branding directory', function (string $tampered) {
    Storage::disk('local')->put('secrets/logo.png', brandPngBytes());
    Storage::disk('local')->put('branding/notes.txt', 'private');
    InstanceSetting::factory()->keyed(InstanceSettingKey::LogoLight, $tampered)->create();
    $assets = resolve(BrandAssets::class);

    $this->get('/brand/logo-light')->assertNotFound();

    expect($assets->url('logo-light'))->toBeNull()
        ->and($assets->mime('logo-light'))->toBeNull();

    $assets->remove('logo-light');

    expect(brandFiles())->toBe(['branding/notes.txt', 'secrets/logo.png']);
})->with([
    '../.env',
    '/etc/passwd',
    'secrets/logo.png',
    'branding/../secrets/logo.png',
    'branding/notes.txt',
    'branding/sub/'.'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png',
    "branding/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png\n",
]);

it('falls back to no asset when the stored file has disappeared', function () {
    $assets = resolve(BrandAssets::class);
    $assets->store('logo-light', brandUpload('logo.png', brandPngBytes()));
    Storage::disk('local')->delete(resolve(InstanceSettings::class)->logoLight());

    expect($assets->url('logo-light'))->toBeNull();

    $this->get('/brand/logo-light')->assertNotFound();
});

it('answers without a long-lived cache when the version is missing or is not the current one', function (?string $version) {
    $assets = resolve(BrandAssets::class);
    $assets->store('logo-light', brandUpload('logo.png', brandPngBytes()));

    $response = $this->get(route('brand.show', array_filter(['asset' => 'logo-light', 'v' => $version])))->assertOk();

    expect($response->getContent())->toBe(brandPngBytes())
        ->and($response->headers->get('Cache-Control'))->toContain('no-cache')
        ->not->toContain('immutable')
        ->not->toContain('max-age')
        ->not->toContain('public');
})->with([
    'no version' => [null],
    'another version' => ['0123456789abcdef'],
    'an empty version' => [''],
]);

it('answers without a long-lived cache when the version is not a string', function () {
    $assets = resolve(BrandAssets::class);
    $assets->store('logo-light', brandUpload('logo.png', brandPngBytes()));

    $response = $this->get('/brand/logo-light?v[]=1')->assertOk();

    expect($response->headers->get('Cache-Control'))->toContain('no-cache')
        ->not->toContain('immutable');
});

it('stops caching the address of a replaced asset for a year', function () {
    $assets = resolve(BrandAssets::class);
    $assets->store('logo-light', brandUpload('logo.png', brandPngBytes()));
    $firstUrl = $assets->url('logo-light');

    $assets->store('logo-light', brandUpload('logo.svg', HostileBrandSvg));

    expect($this->get($firstUrl)->assertOk()->headers->get('Cache-Control'))->toContain('no-cache')
        ->not->toContain('immutable')
        ->and($this->get($assets->url('logo-light'))->assertOk()->headers->get('Cache-Control'))->toContain('immutable');
});

it('decides on a file with thousands of leading comments without exhausting the pattern engine', function (string $root, bool $isAccepted) {
    $assets = resolve(BrandAssets::class);
    $contents = str_repeat("<!-- c -->\n", 5000).$root;

    try {
        $assets->store('logo-light', brandUpload('logo.svg', $contents));
        $wasAccepted = true;
    } catch (InvalidBrandAsset) {
        $wasAccepted = false;
    }

    expect(preg_last_error())->toBe(PREG_NO_ERROR)
        ->and($wasAccepted)->toBe($isAccepted)
        ->and($assets->mime('logo-light'))->toBe($isAccepted ? 'image/svg+xml' : null);
})->with([
    'followed by an svg' => ['<svg xmlns="http://www.w3.org/2000/svg"></svg>', true],
    'followed by an html page' => ['<html><body><svg xmlns="http://www.w3.org/2000/svg"/></body></html>', false],
    'followed by a doctype with an internal subset' => ['<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>', false],
]);
