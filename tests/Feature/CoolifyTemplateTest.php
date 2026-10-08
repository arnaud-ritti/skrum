<?php

use Symfony\Component\Yaml\Yaml;

beforeEach(function () {
    $this->source = (string) file_get_contents(base_path('docs/coolify/skrum.yaml'));
    $this->template = Yaml::parse($this->source);
    $this->environment = collect($this->template['services']['skrum']['environment'])
        ->mapWithKeys(function (string $entry): array {
            [$name, $value] = array_pad(explode('=', $entry, 2), 2, null);

            return [$name => $value];
        });
});

it('carries the six header comments Coolify reads, with the port the image serves', function () {
    preg_match_all('/^# (\w+): (.+)$/m', $this->source, $matches);
    preg_match('/SERVER_NAME=:(\d+)/', (string) file_get_contents(base_path('Dockerfile')), $served);

    $header = array_combine($matches[1], $matches[2]);

    expect(array_keys($header))->toBe(['documentation', 'slogan', 'category', 'tags', 'logo', 'port'])
        ->and($header['port'])->toBe($served[1])
        ->and($this->environment->keys())->toContain("SERVICE_URL_SKRUM_{$served[1]}");
});

it('uses latest for Skrum, pins the database version and builds nothing', function () {
    expect($this->template['services'])->toHaveKeys(['skrum', 'postgres']);

    expect($this->template['services']['skrum']['image'])->toBe('ghcr.io/arnaud-ritti/skrum:latest')
        ->and($this->template['services']['postgres']['image'])->toMatch('/:\d[\w.-]*$/');

    foreach ($this->template['services'] as $service) {
        expect($service)->not->toHaveKey('build')
            ->and($service)->not->toHaveKey('ports')
            ->and($service)->not->toHaveKey('env_file');
    }
});

it('fills every variable the container refuses to start without', function (string $name) {
    $value = $this->environment->get($name);

    expect($value)->toBeString()
        ->and($value)->not->toBe('')
        ->and($value)->not->toContain(':?')
        ->and($value)->not->toMatch('/^\$\{(?!SERVICE_)[A-Z0-9_]+\}$/');
})->with(['APP_KEY', 'DB_CONNECTION', 'DB_PASSWORD']);

it('leaves the address to the proxy in front', function () {
    $names = $this->environment->keys();

    expect($this->environment->get('APP_URL'))->toBe('${SERVICE_URL_SKRUM}')
        ->and($this->environment->get('TRUSTED_PROXIES'))->toBe('${TRUSTED_PROXIES:-*}')
        ->and($names)->not->toContain('SERVER_NAME')
        ->and($names->filter(fn (string $name): bool => str_starts_with($name, 'REVERB_CLIENT_'))->all())->toBeEmpty();
});

it('offers every Skrum setting the application reads', function () {
    $config = collect(glob(base_path('config/*.php')))
        ->map(fn (string $path): string => (string) file_get_contents($path))
        ->implode("\n");

    preg_match_all("/env\('(SKRUM_[A-Z_]+)'/", $config, $matches);

    $expected = collect($matches[1])->push('SKRUM_RUN_MIGRATIONS')->unique()->diff(['SKRUM_VERSION'])->values();
    $offered = $this->environment->keys();

    expect($expected->all())->not->toBeEmpty()
        ->and($expected->diff($offered)->all())->toBeEmpty()
        ->and($offered)->not->toContain('SKRUM_VERSION')
        ->and($offered)->not->toContain('SKRUM_ALLOW_DEBUG');
});

it('asks for none of the optional settings and always names a sender', function () {
    $optional = $this->environment->filter(
        fn (?string $value): bool => $value !== null && str_starts_with($value, '${') && ! str_starts_with($value, '${SERVICE_'),
    );

    expect($optional->keys())->toContain('MAIL_HOST', 'GOOGLE_CLIENT_ID', 'OIDC_BASE_URL', 'SKRUM_GIF_PROVIDER', 'SLACK_CLIENT_ID', 'GITHUB_APP_PRIVATE_KEY')
        ->and($optional->filter(fn (string $value): bool => str_contains($value, ':?'))->all())->toBeEmpty()
        ->and($this->environment->get('MAIL_FROM_ADDRESS'))->toBe('${MAIL_FROM_ADDRESS:-hello@example.com}');
});

it('keeps uploads on a named volume', function () {
    expect($this->template['services']['skrum']['volumes'])->toContain('skrum-storage:/app/storage/app');
});

it('ships the logo its header names, identical to the brand symbol', function () {
    preg_match('/^# logo: svgs\/(.+)$/m', $this->source, $logo);

    expect(base_path("docs/coolify/{$logo[1]}"))->toBeFile()
        ->and(file_get_contents(base_path("docs/coolify/{$logo[1]}")))
        ->toBe(file_get_contents(base_path('public/brand/skrum-symbol-light.svg')));
});

it('documents the service with the frontmatter the Coolify docs ask for', function () {
    $page = (string) file_get_contents(base_path('docs/coolify/skrum.mdx'));

    preg_match('/\A---\n(.+?)\n---\n/s', $page, $frontmatter);

    $meta = Yaml::parse($frontmatter[1]);

    expect($meta)->toHaveKeys(['title', 'description', 'category', 'icon', 'og'])
        ->and($meta['og'])->toHaveKey('description')
        ->and($meta['title'])->toBe('Skrum')
        ->and($meta['icon'])->toBe('/images/services/skrum.svg')
        ->and($page)->toContain('utm_source=coolify.io');
});

it('offers on Coolify the optional settings the production env template lists, and no other', function () {
    preg_match_all('/^#? ?([A-Z][A-Z0-9_]*)=/m', (string) file_get_contents(base_path('.env.production.example')), $matches);

    $listed = collect($matches[1])->unique()->diff(['SERVER_NAME', 'SKRUM_IMAGE', 'SKRUM_HTTP_PORT', 'SKRUM_HTTPS_PORT'])->values();
    $offered = $this->environment->keys();
    $editable = $this->environment
        ->filter(fn (?string $value): bool => $value !== null && str_starts_with($value, '${') && ! str_starts_with($value, '${SERVICE_'))
        ->keys()
        ->diff(['DB_DATABASE'])
        ->values();

    expect($listed->diff($offered)->all())->toBeEmpty()
        ->and($editable->diff($listed)->all())->toBeEmpty();
});
