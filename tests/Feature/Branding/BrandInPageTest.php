<?php

use App\Models\InstanceSetting;
use App\Models\User;
use App\Support\Branding\BrandAssets;
use App\Support\Branding\BrandPalette;
use App\Support\InstanceSettings;
use Illuminate\Foundation\Vite;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\HtmlString;
use Inertia\Testing\AssertableInertia;
use Tests\Support\MissingTables;

const BrandStylesheetLink = '<link rel="stylesheet" href="/build/assets/app.css">';

function brandStyleTag(string $html): ?string
{
    return preg_match('/<style id="skrum-brand">(.*?)<\/style>/s', $html, $matches) === 1 ? $matches[1] : null;
}

beforeEach(function () {
    config(['app.name' => 'Configured Name']);
    Storage::fake('local');

    $this->swap(Vite::class, new class extends Vite
    {
        public function __invoke($entrypoints, $buildDirectory = null): HtmlString
        {
            return new HtmlString(BrandStylesheetLink);
        }

        public function reactRefresh(): ?HtmlString
        {
            return null;
        }
    });
});

it('renders the page as before when no setting is stored', function () {
    $response = $this->get(route('login'))->assertOk();
    $html = $response->getContent();

    expect($html)->not->toContain('skrum-brand')
        ->toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">')
        ->toContain('>Configured Name</title>')
        ->toContain("<!DOCTYPE html>\n<html lang=\"en\"")
        ->toMatch('/'.preg_quote(BrandStylesheetLink, '/').'\s*<title>Configured Name<\/title>/')
        ->and(str_starts_with($html, '<!DOCTYPE html>'))->toBeTrue();

    $response->assertInertia(fn (AssertableInertia $page) => $page
        ->where('name', 'Configured Name')
        ->where('adminUrl', null)
        ->where('brand', [
            'name' => 'Configured Name',
            'logoLightUrl' => null,
            'logoDarkUrl' => null,
            'faviconUrl' => null,
            'poweredBy' => true,
        ]));
});

it('injects the derived palette after the stylesheet when a colour is stored', function () {
    resolve(InstanceSettings::class)->set('brand_color', '#2B63B0');

    $html = $this->get(route('login'))->assertOk()->getContent();
    $palette = BrandPalette::derive('#2B63B0', 10);

    expect(brandStyleTag($html))->toBe($palette->css())
        ->toContain('--primary: oklch(')
        ->toContain('--radius: 0.625rem;')
        ->and(strpos($html, '<style id="skrum-brand">'))->toBeGreaterThan(strpos($html, BrandStylesheetLink));
});

it('uses the stored radius together with the stored colour', function () {
    resolve(InstanceSettings::class)->setMany(['brand_color' => '#2B63B0', 'brand_radius' => 16]);

    $html = $this->get(route('login'))->assertOk()->getContent();

    expect(brandStyleTag($html))->toBe(BrandPalette::derive('#2B63B0', 16)->css())
        ->toContain('--radius: 1rem;');
});

it('injects only the radius when no colour is stored', function () {
    resolve(InstanceSettings::class)->set('brand_radius', 6);

    $html = $this->get(route('login'))->assertOk()->getContent();

    expect(brandStyleTag($html))->toBe(":root {\n  --radius: 0.375rem;\n}\n");
});

it('ignores a stored colour that is not a hex value', function () {
    resolve(InstanceSettings::class)->set('brand_color', 'red;}</style><script>alert(1)</script>');

    $html = $this->get(route('login'))->assertOk()->getContent();

    expect($html)->not->toContain('skrum-brand')
        ->not->toContain('<script>alert(1)</script>');
});

it('escapes a hostile display name in the title and in the page data', function () {
    $hostile = '</title><script>alert(1)</script>';
    resolve(InstanceSettings::class)->set('display_name', $hostile);

    $response = $this->get(route('login'))->assertOk();
    $html = $response->getContent();

    expect($html)->toContain('&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>')
        ->not->toContain($hostile)
        ->not->toContain('<script>alert(1)</script>')
        ->not->toContain('</title><script>');

    $response->assertInertia(fn (AssertableInertia $page) => $page
        ->where('name', $hostile)
        ->where('brand.name', $hostile));
});

it('shares the stored name, the asset URLs and the powered-by switch', function () {
    $assets = resolve(BrandAssets::class);
    $svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    $assets->store('logo-light', UploadedFile::fake()->createWithContent('logo.svg', $svg));
    $assets->store('logo-dark', UploadedFile::fake()->createWithContent('logo-dark.svg', $svg));
    $assets->store('favicon', UploadedFile::fake()->createWithContent('favicon.svg', $svg));
    resolve(InstanceSettings::class)->setMany(['display_name' => 'Acme Retros', 'powered_by' => false]);

    $response = $this->get(route('login'))->assertOk();

    $response->assertInertia(fn (AssertableInertia $page) => $page
        ->where('name', 'Acme Retros')
        ->where('brand.name', 'Acme Retros')
        ->where('brand.logoLightUrl', $assets->url('logo-light'))
        ->where('brand.logoDarkUrl', $assets->url('logo-dark'))
        ->where('brand.faviconUrl', $assets->url('favicon'))
        ->where('brand.poweredBy', false));

    expect($assets->url('favicon'))->toStartWith('/brand/favicon?v=')
        ->and($response->getContent())
        ->toContain('<link rel="icon" href="'.e($assets->url('favicon')).'" type="image/svg+xml">')
        ->not->toContain('/favicon.svg');
});

it('shows the new brand to another user on the request that follows the save', function () {
    $admin = User::factory()->create();
    $member = User::factory()->create();

    $before = $this->actingAs($member)->get(route('settings.edit'))->assertOk()->getContent();

    expect($before)->not->toContain('skrum-brand');

    $this->actingAs($admin);
    freshInstanceSettings()->setMany(['brand_color' => '#2B63B0', 'display_name' => 'Acme Retros']);
    app()->forgetScopedInstances();

    $after = $this->actingAs($member)->get(route('settings.edit'))->assertOk();

    expect(brandStyleTag($after->getContent()))->toBe(BrandPalette::derive('#2B63B0')->css())
        ->and($after->getContent())->toContain('>Acme Retros</title>');

    $after->assertInertia(fn (AssertableInertia $page) => $page->where('brand.name', 'Acme Retros'));
});

it('returns to the default page once the settings are cleared', function () {
    $settings = resolve(InstanceSettings::class);
    $settings->setMany(['brand_color' => '#2B63B0', 'brand_radius' => 4, 'display_name' => 'Acme Retros']);
    $settings->setMany(['brand_color' => null, 'brand_radius' => null, 'display_name' => null]);
    app()->forgetScopedInstances();

    $html = $this->get(route('login'))->assertOk()->getContent();

    expect($html)->not->toContain('skrum-brand')
        ->toContain('>Configured Name</title>');
});

it('still renders the page while the settings table is missing', function () {
    $response = MissingTables::ofModel(InstanceSetting::class, function () {
        app()->forgetScopedInstances();

        return $this->get(route('login'));
    });

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('name', 'Configured Name')
            ->where('brand.logoLightUrl', null)
            ->where('brand.poweredBy', true));

    expect($response->getContent())->not->toContain('skrum-brand')
        ->toContain('href="/favicon.svg"');
});
