<?php

use App\Support\ReverbClientConfig;

it('falls back to the page origin when no client address is configured', function () {
    config([
        'broadcasting.connections.reverb.key' => 'public-key',
        'broadcasting.connections.reverb.client' => ['host' => null, 'port' => null, 'scheme' => null],
    ]);

    expect(ReverbClientConfig::toArray())->toBe([
        'key' => 'public-key',
        'host' => null,
        'port' => null,
        'scheme' => null,
    ]);
});

it('uses an explicit client address when configured', function () {
    config([
        'broadcasting.connections.reverb.key' => 'public-key',
        'broadcasting.connections.reverb.client' => ['host' => 'localhost', 'port' => '8080', 'scheme' => 'http'],
    ]);

    expect(ReverbClientConfig::toArray())->toBe([
        'key' => 'public-key',
        'host' => 'localhost',
        'port' => 8080,
        'scheme' => 'http',
    ]);
});

it('renders the client config on pages without leaking the reverb secret', function () {
    config([
        'broadcasting.connections.reverb.key' => 'public-key',
        'broadcasting.connections.reverb.secret' => 'top-secret-value',
    ]);

    $this->get(route('login'))
        ->assertOk()
        ->assertSee('name="reverb-config"', false)
        ->assertSee('public-key')
        ->assertDontSee('top-secret-value');
});
