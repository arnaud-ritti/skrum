<?php

use App\Models\User;

it('publishes the passkey endpoints of the instance as the well-known document asks', function () {
    $this->getJson('/.well-known/passkey-endpoints')
        ->assertOk()
        ->assertExactJson([
            'enroll' => route('security.edit'),
            'manage' => route('security.edit'),
        ]);
});

it('gives a signed-out visitor the options of a passkey sign-in and keeps them in the session', function () {
    $this->getJson(route('passkey.login-options'))
        ->assertOk()
        ->assertJsonStructure(['options' => ['challenge']])
        ->assertSessionHas('passkey.verification_options');
});

it('refuses the options of a passkey sign-in to a signed-in account', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('passkey.login-options'))
        ->assertRedirect();
});

it('gives a signed-in account the options of a passkey confirmation and refuses them to a visitor', function () {
    $this->actingAs(User::factory()->create())
        ->getJson(route('passkey.confirm-options'))
        ->assertOk()
        ->assertJsonStructure(['options' => ['challenge']]);

    auth()->logout();

    $this->getJson(route('passkey.confirm-options'))->assertUnauthorized();
});
