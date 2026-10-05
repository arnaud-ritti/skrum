<?php

use App\Models\User;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::registration());
});

function openSignupPayload(): array
{
    return [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ];
}

it('renders the registration screen', function () {
    $this->get(route('register'))->assertOk();
});

it('registers the first user of the instance', function () {
    $this->post(route('register.store'), openSignupPayload())->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticated();
});

it('registers a new user when sign-up is open', function () {
    config(['skrum.signup_mode' => 'open']);
    User::factory()->create();

    $this->post(route('register.store'), openSignupPayload())->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticatedAs(User::query()->where('email', 'test@example.com')->sole());
});
