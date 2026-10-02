<?php

use App\Models\Team;
use App\Models\User;

function p18eAccessMember(): User
{
    $user = teamMember(Team::factory()->create(['name' => 'Demo Team']));

    $user->forceFill([
        'name' => 'Mona Member',
        'email' => 'mona@example.com',
        'locale' => 'en',
        'remember_token' => null,
    ])->save();

    return $user;
}

it('[P18e-11-01] shows the error of a wrong password under the field, not as a toast', function () {
    $member = p18eAccessMember();

    $page = visit('/login');

    $page->assertSee('Welcome back')
        ->fill('#email', $member->email)
        ->fill('#password', 'not-the-password')
        ->click('@login-button')
        ->assertSeeIn('#email-error', 'These credentials do not match our records.')
        ->assertAttribute('#email', 'aria-invalid', 'true')
        ->assertAttribute('#email', 'aria-describedby', 'email-error')
        ->assertPathIs('/login')
        ->assertNotPresent('[data-sonner-toast]');

    $page->navigate('/dashboard')->assertPathIs('/login');
});

it('[P18e-11-02] signs a member in with "Remember me" and leaves a remember token', function () {
    $member = p18eAccessMember();

    $page = visit('/login');

    $page->fill('#email', $member->email)
        ->fill('#password', 'password')
        ->click('#remember')
        ->assertAriaAttribute('#remember', 'checked', 'true')
        ->click('@login-button')
        ->assertPathIsNot('/login')
        ->assertSee('Mona Member');

    expect($member->fresh()->remember_token)->not->toBeNull();
});

it('[P18e-11-03] switching to a recovery code and back clears the field', function () {
    $member = p18eAccessMember();

    $member->forceFill([
        'two_factor_secret' => encrypt('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
        'two_factor_recovery_codes' => encrypt(json_encode(['recovery-code-1'])),
        'two_factor_confirmed_at' => now(),
    ])->save();

    $page = visit('/login');

    $page->fill('#email', $member->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIs('/two-factor-challenge')
        ->assertSee('Enter the authentication code provided by your authenticator application.')
        ->assertDisabled('[data-slot="two-factor-form"] button[type="submit"]')
        ->fill('input[name="code"]', '000000')
        ->assertSeeIn('[data-slot="two-factor-code"] [role="alert"]', 'The provided two factor authentication code was invalid.')
        ->assertValue('input[name="code"]', '000000')
        ->assertPathIs('/two-factor-challenge')
        ->fill('input[name="code"]', '123')
        ->assertValue('input[name="code"]', '123')
        ->click('login using a recovery code')
        ->assertSee('Please confirm access to your account by entering one of your emergency recovery codes.')
        ->assertDontSee('Enter the authentication code provided by your authenticator application.')
        ->assertNotPresent('input[name="code"]')
        ->assertValue('input[name="recovery_code"]', '')
        ->fill('input[name="recovery_code"]', 'not-a-code')
        ->click('login using an authentication code')
        ->assertSee('Enter the authentication code provided by your authenticator application.')
        ->assertNotPresent('input[name="recovery_code"]')
        ->assertValue('input[name="code"]', '')
        ->click('login using a recovery code')
        ->assertValue('input[name="recovery_code"]', '')
        ->fill('input[name="recovery_code"]', 'wrong-code')
        ->click('Continue')
        ->assertSee('The provided two factor recovery code was invalid.')
        ->assertPathIs('/two-factor-challenge')
        ->fill('input[name="recovery_code"]', 'recovery-code-1')
        ->click('Continue')
        ->assertPathIsNot('/two-factor-challenge')
        ->assertSee('Mona Member');
});

it('[P18e-11-04] shows the status of a requested reset link as an alert above the form', function () {
    $member = p18eAccessMember();

    $page = visit('/forgot-password');

    $page->assertSee('Forgot password')
        ->assertNotPresent('[data-slot="forgot-password-form"] [role="status"]')
        ->fill('#email', $member->email)
        ->click('@email-password-reset-link-button')
        ->assertSeeIn('[data-slot="forgot-password-form"] [role="status"]', 'We have emailed your password reset link.')
        ->assertPathIs('/forgot-password')
        ->assertNotPresent('[data-sonner-toast]')
        ->click('log in')
        ->assertPathIs('/login');
});
