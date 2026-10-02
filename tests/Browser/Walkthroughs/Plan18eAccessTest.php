<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;

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

it('[P18e-11-05] walks an invitation through its states: logged out, another account, the invited account, expired, invalid', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $inviter = workspaceManager($workspace);
    $mona = User::factory()->create(['name' => 'Mona Member', 'email' => 'mona@example.com', 'locale' => 'en']);
    $otto = User::factory()->create(['name' => 'Otto Other', 'email' => 'otto@example.com', 'locale' => 'en']);

    WorkspaceInvitation::factory()->withToken('pending-token')->create([
        'workspace_id' => $workspace->id,
        'email' => $mona->email,
        'invited_by_id' => $inviter->id,
    ]);
    WorkspaceInvitation::factory()->expired()->withToken('expired-token')->create([
        'email' => $mona->email,
        'invited_by_id' => $inviter->id,
    ]);

    $page = visit('/invitations/pending-token');

    $page->assertAttribute('[data-slot="invitation-card"]', 'data-state', 'logged-out')
        ->assertValue('#email', 'mona@example.com')
        ->assertPresent('[data-slot="invitation-card"] a[href$="/register"]')
        ->assertSeeIn('[data-slot="invitation-card"] a[href$="/register"]', 'Create an account')
        ->assertSeeIn('[data-slot="invitation-card"] a[href$="/login"]', 'Log in')
        ->click('[data-slot="invitation-card"] a[href$="/login"]')
        ->assertPathIs('/login')
        ->fill('#email', $otto->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIs('/invitations/pending-token')
        ->assertAttribute('[data-slot="invitation-card"]', 'data-state', 'wrong-account')
        ->assertSee('You are logged in with another email address. Log out and sign in as mona@example.com to accept.')
        ->assertNotPresent('@accept-invitation-button')
        ->click('Log out')
        ->assertPathIsNot('/invitations/pending-token');

    expect($workspace->members()->whereKey($otto->id)->exists())->toBeFalse();

    $page->navigate('/invitations/pending-token')
        ->assertAttribute('[data-slot="invitation-card"]', 'data-state', 'logged-out')
        ->click('[data-slot="invitation-card"] a[href$="/login"]')
        ->assertPathIs('/login')
        ->fill('#email', $mona->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIs('/invitations/pending-token')
        ->assertAttribute('[data-slot="invitation-card"]', 'data-state', 'accept')
        ->assertSee('Join Nordlys as Mona Member?')
        ->assertSeeIn('@accept-invitation-button', 'Join Nordlys')
        ->click('@accept-invitation-button')
        ->assertPathIs("/w/{$workspace->slug}");

    expect($workspace->members()->whereKey($mona->id)->exists())->toBeTrue();

    $page->navigate('/invitations/expired-token')
        ->assertSeeIn('[data-slot="access-notice"]', 'This invitation has expired')
        ->assertSeeIn('[data-slot="access-notice"]', "Ask {$inviter->name} for a new link; nothing else to do.")
        ->assertNotPresent('[data-slot="invitation-card"]')
        ->assertNotPresent('@accept-invitation-button');

    $page->navigate('/invitations/unknown-token')
        ->assertSeeIn('[data-slot="access-notice"]', 'This invitation link is no longer valid.')
        ->assertNotPresent('[data-slot="invitation-card"]');
});

it('[P18e-11-08] shows the inviter, the role and the members, and the SSO buttons only to a logged out visitor of a pending invitation', function () {
    config([
        'services.github.client_id' => 'walkthrough',
        'services.github.client_secret' => 'walkthrough',
    ]);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $inviter = workspaceManager($workspace, WorkspaceRole::Owner);
    $inviter->forceFill(['name' => 'Ada Lovelace'])->save();

    foreach (['Bea Martin', 'Cleo Lopez', 'Dora Schmidt'] as $name) {
        $workspace->members()->attach(User::factory()->create(['name' => $name]), ['role' => WorkspaceRole::Member->value]);
    }

    $mona = User::factory()->create(['name' => 'Mona Member', 'email' => 'mona@example.com', 'locale' => 'en']);

    WorkspaceInvitation::factory()->withToken('pending-token')->create([
        'workspace_id' => $workspace->id,
        'email' => $mona->email,
        'role' => WorkspaceRole::Admin,
        'invited_by_id' => $inviter->id,
    ]);
    WorkspaceInvitation::factory()->expired()->withToken('expired-token')->create([
        'email' => $mona->email,
        'invited_by_id' => $inviter->id,
    ]);

    $page = visit('/invitations/pending-token');

    $page->assertSeeIn('[data-slot="invitation-sentence"]', 'Ada Lovelace invited you to join Nordlys')
        ->assertSeeIn('[data-slot="invitation-members"]', '4 members · you join as Admin')
        ->assertPresent('[data-slot="invitation-members"] [aria-label="Ada Lovelace"]')
        ->assertPresent('[data-slot="invitation-members"] [aria-label="Bea Martin"]')
        ->assertPresent('[data-slot="invitation-members"] [aria-label="Cleo Lopez"]')
        ->assertPresent('[data-slot="invitation-members"] [aria-label="1 more"]')
        ->assertSeeIn('[data-slot="sso-buttons"] a[href$="/auth/github/redirect"]', 'Continue with GitHub');

    $page->navigate('/invitations/expired-token')
        ->assertSeeIn('[data-slot="access-notice"]', 'This invitation has expired')
        ->assertNotPresent('[data-slot="sso-buttons"]')
        ->assertNotPresent('a[href$="/auth/github/redirect"]');

    $page->navigate('/invitations/pending-token')
        ->click('[data-slot="invitation-card"] a[href$="/login"]')
        ->fill('#email', $mona->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIs('/invitations/pending-token')
        ->assertSeeIn('[data-slot="invitation-sentence"]', 'Ada Lovelace invited you to join Nordlys')
        ->assertSeeIn('@accept-invitation-button', 'Join Nordlys')
        ->assertNotPresent('[data-slot="sso-buttons"]')
        ->assertNotPresent('a[href$="/auth/github/redirect"]');
});
