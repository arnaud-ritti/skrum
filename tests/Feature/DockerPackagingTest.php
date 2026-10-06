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
    'the port the healthcheck calls for a domain' => ['docker/healthcheck', '/\}:(\d+)\/up/'],
    'the ports published with PostgreSQL' => ['compose.production.yaml', '/_PORT:-(\d+)\}:(\d+)/'],
    'the ports published with MariaDB' => ['compose.production.mariadb.yaml', '/_PORT:-(\d+)\}:(\d+)/'],
    'the ports published with SQLite' => ['compose.production.sqlite.yaml', '/_PORT:-(\d+)\}:(\d+)/'],
]);
