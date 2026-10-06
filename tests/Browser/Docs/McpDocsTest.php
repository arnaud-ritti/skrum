<?php

use Tests\Browser\Support\DocsWorld;

it('shows the form that creates an API token with its three scopes', function () {
    config(['skrum.mcp.enabled' => true]);

    $world = DocsWorld::create();

    $page = $this->docsVisit($world->person('Camille'), route('apiTokens.index', [], false))
        ->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings')
        ->assertPresent('[data-slot="create-token-form"] #token-name')
        ->assertPresent('[data-slot="token-list-empty"]')
        ->fill('#token-name', 'Claude Code')
        ->click('#token-team')
        ->click('[role="option"]:has-text("Atlas")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#token-team', 'Atlas')
        ->click('#scope-write')
        ->assertAriaAttribute('#scope-write', 'checked', 'true')
        ->assertSeeIn('#token-expiration', '90 days');

    $this->docShot($page, 'mcp/token-scopes', '[data-slot="create-token-form"]');
});
