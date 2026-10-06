<?php

it('asks the installer for three values only', function () {
    preg_match_all('/^([A-Z][A-Z0-9_]*)=/m', (string) file_get_contents(base_path('.env.production.example')), $matches);

    expect($matches[1])->toBe(['APP_URL', 'APP_KEY', 'DB_PASSWORD']);
});

it('lists in the production template only variables the image reads', function () {
    preg_match_all('/^#? ?([A-Z][A-Z0-9_]*)=/m', (string) file_get_contents(base_path('.env.production.example')), $matches);

    $readers = collect([
        ...glob(base_path('config/*.php')),
        ...glob(base_path('compose.production*.yaml')),
        base_path('Dockerfile'),
        base_path('docker/Caddyfile'),
        base_path('docker/healthcheck'),
        base_path('docker/scripts/prepare'),
    ])->map(fn (string $path): string => (string) file_get_contents($path))->implode("\n");

    expect($matches[1])->not->toBeEmpty();

    foreach (array_unique($matches[1]) as $key) {
        expect($readers)->toMatch('/(?<![A-Z0-9_])'.preg_quote($key, '/').'(?![A-Z0-9_])/');
    }
});
