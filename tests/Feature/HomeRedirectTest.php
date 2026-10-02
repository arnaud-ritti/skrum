<?php

use App\Models\User;

it('redirects a guest to the login page', function () {
    $this->get('/')->assertRedirect(route('login'));
});

it('redirects a signed-in user to the dashboard', function () {
    $this->actingAs(User::factory()->create())
        ->get('/')
        ->assertRedirect(route('dashboard'));
});

it('keeps the home route name resolvable', function () {
    expect(route('home', absolute: false))->toBe('/');
});

it('has no welcome page left', function () {
    expect(file_exists(resource_path('js/pages/welcome.tsx')))->toBeFalse();
});
