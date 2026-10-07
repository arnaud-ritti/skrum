<?php

use Tests\Browser\Support\DocsWorld;

it('shows the status page of a healthy instance whose mail is not configured, signed out', function () {
    DocsWorld::create();

    $this->travelTo(now('UTC')->setTime(9, 30));

    $this->artisan('skrum:heartbeat')->assertSuccessful();

    $page = $this->docsOpen(route('status.show', [], false))
        ->assertPresent('[data-slot="status-overall"][data-overall="operational"]')
        ->assertPresent('[data-slot="status-component"][data-key="scheduler"][data-state="operational"]')
        ->assertPresent('[data-slot="status-component"][data-key="mail"][data-state="not_configured"]')
        ->assertSee('Checked at 09:30 UTC')
        ->resize(1440, 600);

    $this->docShot($page, 'self-hosting/status', '[data-slot="status-page"] main');
});

it('shows the maintenance page with the time of return', function () {
    DocsWorld::create();

    config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'array']);

    $this->artisan('down', ['--retry' => 1800])->assertSuccessful();

    try {
        $page = $this->docsOpen('/')
            ->assertPresent('[data-slot="maintenance-page"] [data-slot="maintenance-back-at"] time')
            ->assertSeeIn('[data-slot="maintenance-back-at-zone"]', 'in about 30 min')
            ->assertVisible('[data-slot="maintenance-reload"]')
            ->resize(1440, 600);

        $page->script(<<<'JS'
            () => {
                document.querySelector('[data-slot="maintenance-back-at"] time').textContent = '2:30 PM';
                document.querySelector('[data-slot="maintenance-back-at-zone"]').textContent = 'your time (UTC) · in about 30 min';

                return true;
            }
            JS);

        $this->docShot($page, 'self-hosting/maintenance', '[data-slot="maintenance-page"] main');
    } finally {
        $this->artisan('up');
    }
});
