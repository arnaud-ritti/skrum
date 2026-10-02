<?php

use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
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
