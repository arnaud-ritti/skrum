<?php

use App\Models\User;
use Laravel\Fortify\Features;

beforeEach(function () {
    Features::twoFactorAuthentication(['confirm' => true, 'confirmPassword' => true]);
});

function startTwoFactorChallenge(User $user): void
{
    test()->post(route('login'), ['email' => $user->email, 'password' => 'password'])
        ->assertRedirect(route('two-factor.login'));
}

it('tells how many attempts are left after a wrong authenticator code', function () {
    startTwoFactorChallenge(User::factory()->withTwoFactor()->create());

    $this->post(route('two-factor.login.store'), ['code' => '000000'])
        ->assertRedirect(route('two-factor.login'))
        ->assertSessionHasErrors(['code' => 'The provided two factor authentication code was invalid. 4 attempts left.']);

    $this->post(route('two-factor.login.store'), ['code' => '000000'])
        ->assertSessionHasErrors(['code' => 'The provided two factor authentication code was invalid. 3 attempts left.']);
});

it('tells how many attempts are left after a wrong recovery code', function () {
    startTwoFactorChallenge(User::factory()->withTwoFactor()->create());

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'wrong-code'])
        ->assertSessionHasErrors(['recovery_code' => 'The provided two factor recovery code was invalid. 4 attempts left.']);
});

it('says to wait once the last attempt is spent', function () {
    startTwoFactorChallenge(User::factory()->withTwoFactor()->create());

    foreach (range(1, 4) as $attempt) {
        $this->post(route('two-factor.login.store'), ['code' => '000000']);
    }

    $this->post(route('two-factor.login.store'), ['code' => '000000'])
        ->assertSessionHasErrors(['code' => 'The provided two factor authentication code was invalid. Wait a minute before trying again.']);
});

it('counts the attempts of the e-mail code with those of the authenticator', function () {
    config(['mail.default' => 'smtp']);
    startTwoFactorChallenge(User::factory()->withTwoFactor()->withEmailSecondFactor()->create());

    $this->post(route('two-factor.login.store'), ['code' => '000000']);

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => '000000'])
        ->assertSessionHasErrors(['code' => 'The provided two factor authentication code was invalid. 3 attempts left.']);
});
