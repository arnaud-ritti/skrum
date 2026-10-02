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
