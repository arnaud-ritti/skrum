<?php

use App\Enums\IntegrationProvider;
use App\Enums\WorkspaceRole;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;

function p18eSettingsWalker(): User
{
    $user = teamMember(Team::factory()->create(['name' => 'Demo Team']));

    $user->forceFill([
        'name' => 'Mona Member',
        'email' => 'mona@example.com',
        'locale' => 'en',
    ])->save();

    return $user;
}

function p18eConfirmPassword(mixed $page, string $path): mixed
{
    return $page->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs($path);
}

it('[P18e-10-01] saves the name and the email, refuses a taken email under its field, and re-sends the verification link of a changed email', function () {
    $member = p18eSettingsWalker();
    User::factory()->create(['email' => 'taken@example.com']);

    $page = $this->signIn($member, '/settings/profile');

    $page->assertSeeIn('nav[aria-label="Settings"] a[aria-current="page"]', 'Profile')
        ->assertValue('#name', 'Mona Member')
        ->assertValue('#email', 'mona@example.com')
        ->assertSeeIn('[data-slot="profile-email-verified"]', 'Verified')
        ->assertNotPresent('[data-slot="profile-card"] [data-slot="alert"]')
        ->fill('#name', 'Mona Lindqvist')
        ->click('@update-profile-button')
        ->assertSee('Profile updated.')
        ->assertValue('#name', 'Mona Lindqvist');

    expect($member->refresh()->name)->toBe('Mona Lindqvist')
        ->and($member->email_verified_at)->not->toBeNull();

    $page->fill('#email', 'taken@example.com')
        ->click('@update-profile-button')
        ->assertSeeIn('[data-slot="profile-card"] [data-slot="field-error"]', 'The email has already been taken.')
        ->assertAttribute('#email', 'aria-invalid', 'true')
        ->assertPathIs('/settings/profile');

    expect($member->refresh()->email)->toBe('mona@example.com');

    $page->fill('#email', 'mona.lindqvist@example.com')
        ->click('@update-profile-button')
        ->assertSee('Your email address is unverified.')
        ->assertNotPresent('[data-slot="profile-email-verified"]')
        ->assertNotPresent('[data-slot="profile-card"] [data-slot="field-error"]')
        ->assertDontSee('A new verification link has been sent to your email address.');

    expect($member->refresh()->email)->toBe('mona.lindqvist@example.com')
        ->and($member->email_verified_at)->toBeNull();

    $page->click('Click here to re-send the verification email.')
        ->assertSee('A new verification link has been sent to your email address.')
        ->assertPathIs('/settings/profile')
        ->assertNoJavaScriptErrors();
});

it('[P18e-10-01b] refuses a wrong password in the deletion dialog, forgets the refusal when the dialog closes, then deletes the account', function () {
    $member = p18eSettingsWalker();

    $page = $this->signIn($member, '/settings/profile');

    $page->assertNotPresent('[role="dialog"]')
        ->click('@delete-user-button')
        ->assertSeeIn('[role="dialog"]', 'Are you sure you want to delete your account?')
        ->fill('[role="dialog"] #password', 'not-my-password')
        ->click('@confirm-delete-user-button')
        ->assertSeeIn('[role="dialog"] [data-slot="field-error"]', 'The password is incorrect.')
        ->assertScript('document.activeElement.id', 'password')
        ->assertPathIs('/settings/profile');

    expect(User::query()->whereKey($member->id)->exists())->toBeTrue();

    $page->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]')
        ->click('@delete-user-button')
        ->assertNotPresent('[role="dialog"] [data-slot="field-error"]')
        ->fill('[role="dialog"] #password', 'password')
        ->click('@confirm-delete-user-button')
        ->assertPathIs('/login')
        ->assertNoJavaScriptErrors();

    expect(User::query()->whereKey($member->id)->exists())->toBeFalse();
});

it('[P18e-10-01c] keeps the account of the only owner of a shared workspace, and of the last instance admin', function (Closure $arrange, string $refusal) {
    $member = p18eSettingsWalker();
    $arrange($member);

    $page = $this->signIn($member, '/settings/profile');

    $page->click('@delete-user-button')
        ->fill('[role="dialog"] #password', 'password')
        ->click('@confirm-delete-user-button')
        ->assertSeeIn('[role="dialog"] [data-slot="field-error"]', $refusal)
        ->assertPathIs('/settings/profile')
        ->assertNoJavaScriptErrors();

    expect(User::query()->whereKey($member->id)->exists())->toBeTrue();
})->with([
    'only owner' => [
        function (User $member): void {
            $workspace = Workspace::factory()->create(['name' => 'Owned']);
            $workspace->members()->attach($member, ['role' => WorkspaceRole::Owner->value]);
            $workspace->members()->attach(User::factory()->create(), ['role' => WorkspaceRole::Member->value]);
        },
        'Transfer ownership of your workspaces before deleting your account.',
    ],
    'last instance admin' => [
        function (User $member): void {
            User::query()->update(['is_instance_admin' => false]);
            $member->forceFill(['is_instance_admin' => true])->save();
        },
        'Name another instance admin before deleting your account.',
    ],
]);

it('[P18e-10-03] empties the password fields and focuses the refused one, then changes the password', function () {
    $member = p18eSettingsWalker();

    $page = p18eConfirmPassword($this->signIn($member, '/settings/security'), '/settings/security');

    $page->assertSeeIn('nav[aria-label="Settings"] a[aria-current="page"]', 'Security')
        ->fill('#current_password', 'not-my-password')
        ->fill('#password', 'a-new-password-2026')
        ->fill('#password_confirmation', 'a-new-password-2026')
        ->click('@update-password-button')
        ->assertSeeIn('[data-slot="password-card"] [data-slot="field-error"]', 'The password is incorrect.')
        ->assertValue('#current_password', '')
        ->assertValue('#password', '')
        ->assertValue('#password_confirmation', '')
        ->assertScript('document.activeElement.id', 'current_password');

    expect(Hash::check('password', $member->refresh()->password))->toBeTrue();

    $page->fill('#current_password', 'password')
        ->fill('#password', 'a-new-password-2026')
        ->fill('#password_confirmation', 'another-password-2026')
        ->click('@update-password-button')
        ->assertSeeIn('[data-slot="password-card"] [data-slot="field-error"]', 'The password field confirmation does not match.')
        ->assertValue('#current_password', '')
        ->assertValue('#password', '')
        ->assertValue('#password_confirmation', '')
        ->assertScript('document.activeElement.id', 'password');

    expect(Hash::check('password', $member->refresh()->password))->toBeTrue();

    $page->fill('#current_password', 'password')
        ->fill('#password', 'a-new-password-2026')
        ->fill('#password_confirmation', 'a-new-password-2026')
        ->click('@update-password-button')
        ->assertSee('Password updated.')
        ->assertNotPresent('[data-slot="password-card"] [data-slot="field-error"]')
        ->assertValue('#current_password', '')
        ->assertValue('#password', '')
        ->assertValue('#password_confirmation', '')
        ->assertNoJavaScriptErrors();

    expect(Hash::check('a-new-password-2026', $member->refresh()->password))->toBeTrue();
});

it('[P18e-10-03b] shows the recovery codes of an enabled second factor, regenerates them, and turns the second factor off after a confirmation', function () {
    $member = p18eSettingsWalker();

    $page = $this->signIn($member, '/settings/security');

    $member->forceFill([
        'two_factor_secret' => encrypt('JBSWY3DPEHPK3PXP'),
        'two_factor_recovery_codes' => encrypt(json_encode(['code-one', 'code-two', 'code-three'])),
        'two_factor_confirmed_at' => '2026-03-12 12:00:00',
    ])->save();

    p18eConfirmPassword($page, '/settings/security')
        ->assertSeeIn('[data-slot="settings-card-header"] [data-slot="badge"]', 'On')
        ->assertSee('Added on March 12, 2026')
        ->assertSee('3 of 8 recovery codes left')
        ->assertNotPresent('ol[aria-label="Recovery codes"]')
        ->click('View recovery codes')
        ->assertSeeIn('ol[aria-label="Recovery codes"] li:nth-child(3)', 'code-three')
        ->assertNotPresent('ol[aria-label="Recovery codes"] li:nth-child(4)')
        ->click('Regenerate codes')
        ->assertPresent('ol[aria-label="Recovery codes"] li:nth-child(8)')
        ->assertSee('8 of 8 recovery codes left')
        ->assertDontSee('code-three');

    expect($member->refresh()->recoveryCodes())->toHaveCount(8)->not->toContain('code-three');

    $page->click('Hide recovery codes')
        ->assertNotPresent('ol[aria-label="Recovery codes"]')
        ->click('Turn off 2FA')
        ->assertSeeIn('[role="alertdialog"]', 'Turn off two-factor authentication?')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]');

    expect($member->refresh()->two_factor_confirmed_at)->not->toBeNull();

    $page->click('Turn off 2FA')
        ->click('[role="alertdialog"] button:has-text("Turn off 2FA")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSeeIn('[data-slot="settings-card-header"] [data-slot="badge"]', 'Off')
        ->assertSee('Enable 2FA')
        ->assertDontSee('recovery codes left')
        ->assertNoJavaScriptErrors();

    expect($member->refresh()->two_factor_secret)->toBeNull()
        ->and($member->two_factor_confirmed_at)->toBeNull();
});

it('[P18e-10-05] lists a passkey after the empty state and removes it after a confirmation', function () {
    $member = p18eSettingsWalker();

    $page = p18eConfirmPassword($this->signIn($member, '/settings/security'), '/settings/security');

    $page->assertSeeIn('[data-slot="passkeys-empty"]', 'No passkeys yet')
        ->assertNotPresent('[data-slot="passkey-row"]');

    $member->passkeys()->create([
        'name' => 'MacBook Pro',
        'credential_id' => 'p18e-credential',
        'credential' => [],
    ]);

    $page->navigate('/settings/security')
        ->assertNotPresent('[data-slot="passkeys-empty"]')
        ->assertCount('ul[aria-label="Passkeys"] [data-slot="passkey-row"]', 1)
        ->assertSeeIn('[data-slot="passkey-row"]', 'MacBook Pro')
        ->assertSeeIn('[data-slot="passkey-row"]', 'Added ')
        ->click('[aria-label="Remove MacBook Pro"]')
        ->assertSeeIn('[role="alertdialog"]', 'Are you sure you want to remove the "MacBook Pro" passkey?')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertCount('[data-slot="passkey-row"]', 1);

    expect($member->passkeys()->count())->toBe(1);

    $page->click('[aria-label="Remove MacBook Pro"]')
        ->click('[role="alertdialog"] button:has-text("Remove passkey")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSeeIn('[data-slot="passkeys-empty"]', 'No passkeys yet')
        ->assertNoJavaScriptErrors();

    expect($member->passkeys()->count())->toBe(0);
});

it('[P18e-10-02] sets up the second factor inside its card, to "Finish", then shows its date and "8 of 8 recovery codes left"', function () {
    $member = p18eSettingsWalker();

    $page = $this->signIn($member, '/settings/security');

    $page->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings/security')
        ->assertSee('Password, two-factor authentication and passkeys.')
        ->assertPresent('#current_password')
        ->assertPresent('#password')
        ->assertPresent('#password_confirmation')
        ->assertPresent('@update-password-button')
        ->assertSeeIn('[aria-labelledby]:has([data-slot="settings-card-header"]) [data-slot="badge"]', 'Off')
        ->click('Enable 2FA')
        ->assertPresent('[data-slot="two-factor-qr"] svg')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Scan the QR code')
        ->assertSee('Enter the 6-digit code')
        ->assertDisabled('[data-slot="two-factor-confirm"] button[type="submit"]');

    $secret = decrypt($member->refresh()->two_factor_secret);

    expect($member->two_factor_confirmed_at)->toBeNull();

    $page->assertSeeIn('[data-slot="two-factor-key"]', substr((string) $secret, 0, 4))
        ->fill('input[name="code"]', '000000')
        ->click('[data-slot="two-factor-confirm"] button[type="submit"]')
        ->assertSeeIn('[data-slot="two-factor-confirm"] [role="alert"]', 'The provided two factor authentication code was invalid.')
        ->fill('input[name="code"]', resolve(Google2FA::class)->getCurrentOtp($secret))
        ->click('[data-slot="two-factor-confirm"] button[type="submit"]')
        ->assertSee('Save your recovery codes')
        ->assertPresent('ol[aria-label="Recovery codes"] li:nth-child(8)')
        ->assertNotPresent('ol[aria-label="Recovery codes"] li:nth-child(9)')
        ->assertSee('Download .txt')
        ->assertDontSee('Print')
        ->assertDisabled('[data-slot="settings-card-footer"] button:has-text("Finish")')
        ->assertSee('I have saved my recovery codes')
        ->click('#recovery-codes-saved')
        ->click('[data-slot="settings-card-footer"] button:has-text("Finish")')
        ->assertSeeIn('[data-slot="settings-card-header"] [data-slot="badge"]', 'On')
        ->assertSee('Added on ')
        ->assertSee('8 of 8 recovery codes left')
        ->assertNotPresent('ol[aria-label="Recovery codes"]')
        ->assertNoJavaScriptErrors();

    expect($member->refresh()->two_factor_confirmed_at)->not->toBeNull()
        ->and($member->recoveryCodes())->toHaveCount(8);
});

it('[P18e-10-04] creates a token from the form of the page, shows it once, copies it and lists it after "Done"; a refused name shows under its field', function () {
    $member = p18eSettingsWalker();
    issueTestMcpToken($member);

    $page = $this->signIn($member, '/settings/api-tokens');

    $page->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings/api-tokens')
        ->assertSeeIn('nav[aria-label="Settings"] a[aria-current="page"]', 'API tokens')
        ->assertNotPresent('[role="dialog"]')
        ->assertVisible('form[aria-label="New API token"] #token-name')
        ->assertCount('[data-slot="token-list"] tbody tr', 1)
        ->fill('#token-name', 'Test client')
        ->click('form[aria-label="New API token"] button:has-text("Create token")')
        ->assertSeeIn('form[aria-label="New API token"] [data-slot="field-error"]', 'You already have a token with this name.')
        ->assertAttribute('#token-name', 'aria-invalid', 'true')
        ->assertPathIs('/settings/api-tokens')
        ->assertNotPresent('[role="dialog"]')
        ->assertNotPresent('[data-slot="new-token-panel"]')
        ->assertValue('#token-name', 'Test client')
        ->assertCount('[data-slot="token-list"] tbody tr', 1);

    expect(PersonalAccessToken::query()->count())->toBe(1);

    $page->fill('#token-name', 'Inline client')
        ->click('#scope-write')
        ->click('form[aria-label="New API token"] button:has-text("Create token")')
        ->assertVisible('[data-slot="new-token-panel"] input[aria-label="API token"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertNotPresent('form[aria-label="New API token"] button:has-text("Create token")')
        ->assertNotPresent('form[aria-label="New API token"] [data-slot="field-error"]')
        ->assertValue('#token-name', '')
        ->assertScript('document.activeElement.getAttribute("aria-label")', 'API token')
        ->assertSee("Copy your token now. You won't be able to see it again.")
        ->assertSeeIn('tbody tr:has-text("Inline client") td:first-child [data-slot="badge"]', 'New');

    $plainText = $page->value('input[aria-label="API token"]');
    $token = PersonalAccessToken::query()->where('name', 'Inline client')->sole();

    expect($plainText)->toStartWith("{$token->id}|skrum_")
        ->and($token->abilities)->toBe(['mcp:read', 'mcp:write']);

    $page->script('() => { navigator.clipboard.writeText = (text) => { window.copiedToken = text; return Promise.resolve(); }; return true; }');

    $page->click('[data-slot="new-token-panel"] button:has-text("Copy"):not(:has-text("configuration"))')
        ->assertSeeIn('[data-slot="new-token-panel"]', 'Copied')
        ->assertScript('window.copiedToken', $plainText)
        ->click('Done')
        ->assertNotPresent('[data-slot="new-token-panel"]')
        ->assertNotPresent('input[aria-label="API token"]')
        ->assertVisible('form[aria-label="New API token"] button:has-text("Create token")')
        ->assertCount('[data-slot="token-list"] tbody tr', 2)
        ->assertSeeIn('tbody tr:has-text("Inline client")', "skrum_…{$token->token_hint}")
        ->assertCount('tbody tr:has-text("Inline client") td:nth-child(2) [data-slot="badge"]', 2)
        ->assertNotPresent('tbody tr:has-text("Inline client") td:first-child [data-slot="badge"]')
        ->assertNoJavaScriptErrors();
});

it('[P18e-10-06] the "Dark" theme card darkens the page and survives a reload; the language control translates the sub-navigation', function () {
    $member = p18eSettingsWalker();

    $page = $this->signIn($member, '/settings/appearance');

    $page->assertPresent('[role="radiogroup"] [role="radio"][aria-checked="true"]:has-text("System")')
        ->assertScript('document.documentElement.classList.contains("dark")', false)
        ->click('[role="radio"]:has-text("Dark")')
        ->assertPresent('[role="radio"][aria-checked="true"]:has-text("Dark")')
        ->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertScript('document.cookie.includes("appearance=dark")', true)
        ->navigate('/settings/appearance')
        ->assertPresent('[role="radio"][aria-checked="true"]:has-text("Dark")')
        ->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertSeeIn('nav[aria-label="Settings"]', 'Appearance')
        ->assertPresent('[role="radiogroup"][aria-label="Language"] [role="radio"][aria-checked="true"]:has-text("English")')
        ->click('[role="radiogroup"][aria-label="Language"] [role="radio"]:has-text("Français")')
        ->assertSeeIn('nav[aria-label="Paramètres"]', 'Apparence')
        ->assertPresent('[role="radiogroup"][aria-label="Langue"] [role="radio"][aria-checked="true"]:has-text("Français")')
        ->assertNoJavaScriptErrors();

    expect($member->refresh()->locale)->toBe('fr');
});

it('[P18e-10-07] the two reminder switches are saved by "Save" only, and stay as saved', function () {
    $member = p18eSettingsWalker();

    $page = $this->signIn($member, '/settings/notifications');

    $page->assertSee('Action item reminders')
        ->assertAttribute('#action-item-reminders-in-app', 'aria-checked', 'true')
        ->assertAttribute('#action-item-reminders-by-email', 'aria-checked', 'true')
        ->click('#action-item-reminders-in-app')
        ->click('#action-item-reminders-by-email')
        ->assertAttribute('#action-item-reminders-in-app', 'aria-checked', 'false')
        ->assertAttribute('#action-item-reminders-by-email', 'aria-checked', 'false');

    expect($member->refresh()->action_item_reminders_in_app)->toBeTrue()
        ->and($member->action_item_reminders_by_email)->toBeTrue();

    $page->click('Save')
        ->assertSee('Notification settings saved.');

    expect($member->refresh()->action_item_reminders_in_app)->toBeFalse()
        ->and($member->action_item_reminders_by_email)->toBeFalse();

    $page->navigate('/settings/notifications')
        ->assertAttribute('#action-item-reminders-in-app', 'aria-checked', 'false')
        ->assertAttribute('#action-item-reminders-by-email', 'aria-checked', 'false')
        ->assertNoJavaScriptErrors();
});

it('[P18e-10-08] marks the current page, and only it, in the settings sub-navigation', function () {
    $member = p18eSettingsWalker();
    $current = 'nav[aria-label="Settings"] a[aria-current="page"]';

    $page = $this->signIn($member, '/settings/profile');

    $page->assertCount('nav[aria-label="Settings"]', 1)
        ->assertCount('nav[aria-label="Settings"] a', 5)
        ->assertCount($current, 1)
        ->assertSeeIn($current, 'Profile')
        ->click('nav[aria-label="Settings"] a:has-text("Security")');

    p18eConfirmPassword($page, '/settings/security')
        ->assertCount($current, 1)
        ->assertSeeIn($current, 'Security')
        ->click('nav[aria-label="Settings"] a:has-text("Appearance")')
        ->assertPathIs('/settings/appearance')
        ->assertCount($current, 1)
        ->assertSeeIn($current, 'Appearance')
        ->click('nav[aria-label="Settings"] a:has-text("Notifications")')
        ->assertPathIs('/settings/notifications')
        ->assertCount($current, 1)
        ->assertSeeIn($current, 'Notifications')
        ->click('nav[aria-label="Settings"] a:has-text("API tokens")')
        ->assertPathIs('/settings/api-tokens')
        ->assertCount($current, 1)
        ->assertSeeIn($current, 'API tokens')
        ->click('nav[aria-label="Settings"] a:has-text("Profile")')
        ->assertPathIs('/settings/profile')
        ->assertSeeIn($current, 'Profile')
        ->assertNoJavaScriptErrors();
});

it('[P18e-10-09] the team switcher of the sidebar still lists the teams of the workspace on the API tokens page', function () {
    $member = p18eSettingsWalker();
    $team = $member->teams()->sole();
    $other = Team::factory()->for($team->workspace)->create(['name' => 'Second Team']);
    $other->members()->attach($member);

    $page = $this->signIn($member, route('teams.show', [$team->workspace, $team], false));

    $page->assertPathIs(route('teams.show', [$team->workspace, $team], false))
        ->navigate('/settings/api-tokens');

    p18eConfirmPassword($page, '/settings/api-tokens')
        ->assertPresent('form[aria-label="New API token"] #token-team')
        ->click('button[aria-haspopup="menu"]:has-text("Demo Team")')
        ->assertCount('[role="menu"] [role="menuitem"]:has-text("Demo Team")', 1)
        ->assertCount('[role="menu"] [role="menuitem"]:has-text("Second Team")', 1)
        ->assertPresent('[role="menu"] a[role="menuitem"][href$="'.route('teams.show', [$team->workspace, $other], false).'"]')
        ->assertNoJavaScriptErrors();
});

it('[P18e-10-10] the team settings name the team in the breadcrumb, mark "Integrations", and "Team" goes back to the team page', function () {
    enableIntegrations(IntegrationProvider::Slack);

    $team = Team::factory()->create(['name' => 'Demo Team']);
    $admin = integrationAdmin($team);
    $teamPath = route('teams.show', [$team->workspace, $team], false);

    $page = $this->signIn($admin, route('teams.integrations.index', [$team->workspace, $team], false));

    $page->assertSeeIn('[data-slot="team-settings-shell"] h1', 'Demo Team')
        ->assertSeeIn('nav[aria-label="Breadcrumb"]', 'Demo Team')
        ->assertSeeIn('nav[aria-label="Breadcrumb"]', 'Team settings')
        ->assertSeeIn('nav[aria-label="Breadcrumb"] [aria-current="page"]', 'Integrations')
        ->assertCount('nav[aria-label="Team settings"] a', 2)
        ->assertCount('nav[aria-label="Team settings"] a[aria-current="page"]', 1)
        ->assertSeeIn('nav[aria-label="Team settings"] a[aria-current="page"]', 'Integrations')
        ->assertAttribute('nav[aria-label="Team settings"] a:not([aria-current])', 'href', "{$teamPath}#settings")
        ->click('nav[aria-label="Team settings"] a:not([aria-current])')
        ->assertPathIs($teamPath)
        ->assertPresent('#settings [data-slot="team-settings"]')
        ->assertNotPresent('[data-slot="team-settings-shell"]')
        ->assertNoJavaScriptErrors();
});
