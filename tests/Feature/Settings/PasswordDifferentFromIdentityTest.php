<?php

use App\Models\User;
use Illuminate\Support\Facades\Password;

it('refuses a new password that is the e-mail, its local part or the name of the account', function (string $password) {
    $user = User::factory()->create(['name' => 'Mona Lisa Vinci', 'email' => 'mona.lisa.vinci@example.test']);

    $this->actingAs($user)
        ->from(route('settings.edit'))
        ->put(route('user-password.update'), ['current_password' => 'password', 'password' => $password, 'password_confirmation' => $password])
        ->assertSessionHasErrors(['password' => 'Choose a password different from your email and name.']);
})->with([
    'the e-mail' => ['mona.lisa.vinci@example.test'],
    'the e-mail in capitals' => ['MONA.LISA.VINCI@EXAMPLE.TEST'],
    'the local part of the e-mail' => ['mona.lisa.vinci'],
    'the name' => ['Mona Lisa Vinci'],
]);

it('accepts a password that only contains the name', function () {
    $user = User::factory()->create(['name' => 'Mona', 'email' => 'mona@example.test']);

    $this->actingAs($user)
        ->put(route('user-password.update'), ['current_password' => 'password', 'password' => 'Mona-and-a-long-tail-2026', 'password_confirmation' => 'Mona-and-a-long-tail-2026'])
        ->assertSessionHasNoErrors();
});

it('refuses the e-mail as the password at registration', function () {
    config(['skrum.signup_mode' => 'open']);

    $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test.user.long@example.com',
        'password' => 'test.user.long@example.com',
        'password_confirmation' => 'test.user.long@example.com',
    ])->assertSessionHasErrors(['password' => 'Choose a password different from your email and name.']);
});

it('refuses the name as the password at reset', function () {
    $user = User::factory()->create(['name' => 'Mona Lisa Vinci']);
    $token = Password::broker()->createToken($user);

    $this->post(route('password.update'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'Mona Lisa Vinci',
        'password_confirmation' => 'Mona Lisa Vinci',
    ])->assertSessionHasErrors(['password' => 'Choose a password different from your email and name.']);
});
