<?php

it('keeps every port of the production Docker setup out of the privileged range', function (string $file, string $pattern) {
    preg_match_all($pattern, (string) file_get_contents(base_path($file)), $matches);

    $captured = implode(' ', array_merge(...array_slice($matches, 1)));
    preg_match_all('/\d+/', $captured, $ports);

    expect($ports[0])->not->toBeEmpty();

    foreach ($ports[0] as $port) {
        expect((int) $port)->toBeGreaterThanOrEqual(1024);
    }
})->with([
    'the ports the image exposes' => ['Dockerfile', '/^EXPOSE (.+)$/m'],
    'the address the image serves by default' => ['Dockerfile', '/SERVER_NAME=:(\d+)/'],
    'the ports Caddy binds' => ['docker/Caddyfile', '/^\s*https?_port (\d+)$/m'],
    'the address Caddy serves by default' => ['docker/Caddyfile', '/\{\$SERVER_NAME::(\d+)\}/'],
    'the port Octane is started on' => ['docker/s6-rc.d/octane/run', '/--port=(\d+)/'],
    'the address the healthcheck calls by default' => ['docker/healthcheck', '/SERVER_NAME:-:(\d+)\}/'],
    'the port the healthcheck calls for a domain' => ['docker/healthcheck', '/\}:(\d+)(?:\/up|:127\.0\.0\.1)/'],
    'the ports published with PostgreSQL' => ['compose.production.yaml', '/_PORT:-(\d+)\}:(\d+)/'],
    'the ports published with MariaDB' => ['compose.production.mariadb.yaml', '/_PORT:-(\d+)\}:(\d+)/'],
    'the ports published with SQLite' => ['compose.production.sqlite.yaml', '/_PORT:-(\d+)\}:(\d+)/'],
]);

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
