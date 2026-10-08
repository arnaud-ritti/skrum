<?php

use App\Models\User;
use App\Support\Settings\SecuritySettings;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\Rules\Password;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Actions\GenerateNewRecoveryCodes;
use Laravel\Fortify\Features;

beforeEach(function (): void {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);
});

function securityPagePropsUserWithConfirmedSecondFactor(): User
{
    $user = User::factory()->create();

    resolve(GenerateNewRecoveryCodes::class)($user);

    $user->forceFill([
        'two_factor_secret' => encrypt('SECRETKEYSECRETKEY'),
        'two_factor_confirmed_at' => now()->startOfSecond(),
    ])->save();

    return $user->refresh();
}

function securityPagePropsResponse(User $user): TestResponse
{
    return test()->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('settings.edit'));
}

test('user without second factor has no date and no codes left', function (): void {
    $user = User::factory()->create();

    securityPagePropsResponse($user)->assertInertia(fn (Assert $page) => $page
        ->where('security.protected.twoFactor.confirmedAt', null)
        ->where('security.protected.twoFactor.recoveryCodesRemaining', null)
        ->where('security.protected.twoFactor.recoveryCodesTotal', SecuritySettings::RecoveryCodesTotal),
    );
});

test('user with confirmed second factor gets date and all codes', function (): void {
    $user = securityPagePropsUserWithConfirmedSecondFactor();

    securityPagePropsResponse($user)->assertInertia(fn (Assert $page) => $page
        ->where('security.protected.twoFactor.confirmedAt', $user->two_factor_confirmed_at->toIso8601String())
        ->where('security.protected.twoFactor.recoveryCodesRemaining', 8)
        ->where('security.protected.twoFactor.recoveryCodesTotal', 8),
    );
});

test('recovery codes left drops after one is used to sign in', function (): void {
    $user = securityPagePropsUserWithConfirmedSecondFactor();
    $usedCode = $user->recoveryCodes()[0];

    $this->withSession(['login.id' => $user->id, 'login.remember' => false])
        ->post(route('two-factor.login'), ['recovery_code' => $usedCode])
        ->assertRedirect();

    $this->assertAuthenticatedAs($user);
    expect($user->refresh()->recoveryCodes())->not->toContain($usedCode);

    securityPagePropsResponse($user)->assertInertia(fn (Assert $page) => $page
        ->where('security.protected.twoFactor.recoveryCodesRemaining', 7)
        ->where('security.protected.twoFactor.recoveryCodesTotal', 8),
    );
});

test('a used recovery code cannot sign in again', function (): void {
    $user = securityPagePropsUserWithConfirmedSecondFactor();
    $usedCode = $user->recoveryCodes()[0];

    $user->replaceRecoveryCode($usedCode);

    $this->withSession(['login.id' => $user->id, 'login.remember' => false])
        ->post(route('two-factor.login'), ['recovery_code' => $usedCode])
        ->assertSessionHasErrors('recovery_code');

    $this->assertGuest();
});

test('no recovery code is left after the last one is used', function (): void {
    $user = securityPagePropsUserWithConfirmedSecondFactor();

    foreach ($user->recoveryCodes() as $code) {
        $user->replaceRecoveryCode($code);
    }

    securityPagePropsResponse($user->refresh())->assertInertia(fn (Assert $page) => $page
        ->where('security.protected.twoFactor.recoveryCodesRemaining', 0),
    );
});

test('recovery codes total matches what fortify generates', function (): void {
    $user = User::factory()->create();

    resolve(GenerateNewRecoveryCodes::class)($user);

    expect($user->refresh()->recoveryCodes())->toHaveCount(SecuritySettings::RecoveryCodesTotal);
});

test('props never contain a recovery code or the secret', function (): void {
    $user = securityPagePropsUserWithConfirmedSecondFactor();

    $content = securityPagePropsResponse($user)->getContent();

    foreach ($user->recoveryCodes() as $code) {
        expect($content)->not->toContain($code);
    }

    expect($content)->not->toContain('SECRETKEYSECRETKEY');
});

test('page says when the password rule checks known data breaches', function (): void {
    $user = User::factory()->create();

    securityPagePropsResponse($user)->assertInertia(fn (Assert $page) => $page
        ->where('security.checksCompromisedPasswords', false),
    );

    Password::defaults(fn (): Password => Password::min(12)->uncompromised());

    securityPagePropsResponse($user)->assertInertia(fn (Assert $page) => $page
        ->where('security.checksCompromisedPasswords', true),
    );
});
