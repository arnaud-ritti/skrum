<?php

it('shows every component with its state in words, without a session', function () {
    $response = $this->get('/status', ['Accept-Language' => 'fr'])->assertOk();

    expect($response->headers->getCookies())->toBe([])
        ->and($response->headers->get('Cache-Control'))->toContain('no-store');
    $response->assertSee('lang="fr"', false)
        ->assertSee('État de l’instance')
        ->assertSee('Base de données')
        ->assertSee('data-slot="status-component"', false)
        ->assertDontSee('<script', false);
});

it('answers during maintenance and says so', function () {
    config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'array']);
    $this->artisan('down');

    try {
        $this->get('/status')->assertOk()->assertSee('Maintenance in progress');
        $this->get('/')->assertServiceUnavailable();
    } finally {
        $this->artisan('up');
    }
});

it('renders with an unreachable database and a database cache store', function () {
    config(['cache.default' => 'database']);

    withUnreachableDatabase(function (): void {
        $this->get('/status')->assertOk()->assertSee('data-state="down"', false);
    });
});

it('says all systems operational when every configured component answers', function () {
    config(['broadcasting.default' => 'null', 'mail.default' => 'smtp', 'queue.default' => 'sync']);
    $this->artisan('skrum:heartbeat');

    $this->get('/status')->assertOk()->assertSee('All systems operational');
});

it('says some systems are degraded when a component is down', function () {
    $this->get('/status')
        ->assertOk()
        ->assertSee('Some systems are degraded')
        ->assertSee('data-state="down"', false)
        ->assertSee('Unavailable');
});
