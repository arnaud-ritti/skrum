<?php

use App\Support\InstanceSettings;
use App\Support\Mail\MailBrand;
use Illuminate\Support\Facades\Blade;

function renderMailLayout(string $body = 'Hello'): string
{
    $brand = resolve(MailBrand::class);

    return Blade::render("@extends('mail.layout')\n@section('content')\n{$body}\n@endsection", [
        'title' => 'A subject',
        'preheader' => 'A preview line',
        'brand' => $brand,
        'colors' => $brand->colors(),
    ]);
}

it('uses hex colours only', function () {
    resolve(InstanceSettings::class)->set('brand_color', '#2B63B0');

    $html = renderMailLayout();

    expect($html)->not->toMatch('/var\(|oklch|color-mix|rgb\(|hsl\(/')
        ->and(preg_match_all('/color:\s*([^;"}]+)/', $html, $matches))->toBeGreaterThan(10)
        ->and(collect($matches[1])->map(fn (string $value) => trim(str_replace('!important', '', $value)))->reject(fn (string $value) => preg_match('/^#[0-9a-f]{6}$/', $value) === 1)->values()->all())->toBe([]);
});

it('keeps the Skrüm palette when no brand colour is stored', function () {
    expect(resolve(MailBrand::class)->colors())->toBe(MailBrand::Palette);
});

it('takes the three brand tokens from the palette of the instance colour', function () {
    resolve(InstanceSettings::class)->set('brand_color', '#2B63B0');

    $colors = resolve(MailBrand::class)->colors();

    expect($colors['light']['primary'])->not->toBe(MailBrand::Palette['light']['primary'])
        ->and($colors['light']['muted'])->toBe(MailBrand::Palette['light']['muted'])
        ->and(renderMailLayout())->toContain($colors['dark']['primary']);
});

it('declares both colour schemes and the Outlook dark selectors', function () {
    $html = renderMailLayout();

    expect($html)->toContain('<meta name="color-scheme" content="light dark">')
        ->toContain('@media (prefers-color-scheme: dark)')
        ->toContain('[data-ogsc]')
        ->toContain('[data-ogsb]')
        ->toContain('role="presentation"')
        ->toContain('<title>A subject</title>');
});

it('sets the language of the document', function (string $locale) {
    app()->setLocale($locale);

    expect(renderMailLayout())->toContain("<html lang=\"{$locale}\"");
})->with(['en', 'fr', 'es', 'de']);

it('escapes the display name', function () {
    resolve(InstanceSettings::class)->set('display_name', '</title><script>alert(1)</script>');

    expect(renderMailLayout())->not->toContain('<script>alert(1)</script>');
});

it('shows the name as text when the instance logo is not a PNG or a JPEG', function () {
    expect(resolve(MailBrand::class)->logoUrl())->toBeNull()
        ->and(renderMailLayout())->not->toContain('<img');
});

it('hides the previews outside local and testing', function () {
    app()->detectEnvironment(fn (): string => 'production');

    $this->get('/dev/mail/magic-link')->assertNotFound();
});

it('answers not found for an unknown preview', function () {
    $this->get('/dev/mail/nope')->assertNotFound();
});
