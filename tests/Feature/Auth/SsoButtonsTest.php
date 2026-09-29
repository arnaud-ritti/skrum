<?php

use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config([
        'services.google.client_id' => null,
        'services.google.client_secret' => null,
        'services.github.client_id' => 'github-id',
        'services.github.client_secret' => 'github-secret',
        'oidc.connections.entra.client_id' => null,
        'oidc.connections.entra.client_secret' => null,
        'oidc.connections.generic.base_url' => null,
        'skrum.signup_mode' => 'open',
    ]);
});

it('lists only enabled providers on the login page', function () {
    $this->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('ssoProviders', [['key' => 'github', 'label' => 'GitHub']]));
});

it('lists enabled providers on the register page', function () {
    $this->get(route('register'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('ssoProviders', [['key' => 'github', 'label' => 'GitHub']]));
});

it('lists nothing when no provider is configured', function () {
    config(['services.github.client_id' => null]);

    $this->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page->where('ssoProviders', []));
});
