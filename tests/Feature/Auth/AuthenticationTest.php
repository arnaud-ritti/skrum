<?php

use App\Models\User;
use App\Support\Auth\LoginAddress;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Fortify\Features;

it('renders the login screen', function () {
    $this->get(route('login'))->assertOk();
});

it('signs a user in from the login screen', function () {
    $user = User::factory()->create();

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));
});

it('sends a user with two factors to the two-factor challenge', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());
    $user = User::factory()->withTwoFactor()->create();

    $this->post(route('login'), [
        'email' => $user->email,
        'password' => 'password',
    ])
        ->assertRedirect(route('two-factor.login'))
        ->assertSessionHas('login.id', $user->id);

    $this->assertGuest();
});

it('refuses a wrong password', function () {
    $user = User::factory()->create();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});

it('signs a user out', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('logout'))->assertRedirect(route('home'));

    $this->assertGuest();
});

it('rate limits the sign-in attempts', function () {
    $user = User::factory()->create();

    RateLimiter::increment(md5('login'.implode('|', [LoginAddress::throttleKey($user->email), '127.0.0.1'])), amount: 5);

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ])->assertTooManyRequests();
});
