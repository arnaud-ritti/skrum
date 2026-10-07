<?php

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\BrowserSession;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SocialAccount;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\InstanceSettings;
use App\Support\Sessions\JoinCodes;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

const AccountBreachedPassword = 'correct-horse-battery-2026';

const AccountCleanPassword = 'Marmot-glacier-2026';

beforeEach(function () {
    RateLimiter::for('login', fn (): Limit => Limit::none());
    RateLimiter::for('passwordConfirmations', fn (): Limit => Limit::none());
});

afterEach(function () {
    File::delete(File::glob(accountImageFile('*')));
});

function accountMember(): User
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);

    $member = User::factory()->create([
        'name' => 'Mona Member',
        'email' => 'mona@nordlys.example',
        'locale' => 'en',
    ]);
    $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($member);

    return $member;
}

function accountConfirmPassword(mixed $page): mixed
{
    return $page->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings')
        ->assertScript('window.location.hash', '#security');
}

function accountEnableGoogleAndGitHub(): void
{
    config([
        'services.google.client_id' => 'walkthrough-google-client',
        'services.google.client_secret' => 'walkthrough-google-secret',
        'services.github.client_id' => 'walkthrough-github-client',
        'services.github.client_secret' => 'walkthrough-github-secret',
    ]);
}

function accountImageFile(string $name, ?string $bytes = null): string
{
    $path = sys_get_temp_dir().'/skrum-account-'.getmypid().'-'.$name;

    if ($bytes !== null) {
        file_put_contents($path, $bytes);
    }

    return $path;
}

/**
 * A Windows desktop two hours ago and an iPhone three days ago, beside the browser of the test.
 */
function accountOtherDevices(User $member): void
{
    $devices = [
        ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', '203.0.113.42', now()->subHours(2)],
        ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', '2001:db8:85a3::8a2e:370:7334', now()->subDays(3)],
    ];

    foreach ($devices as $index => [$userAgent, $ipAddress, $lastActivity]) {
        (new BrowserSession)->forceFill([
            'id' => "other-device-{$index}-".str_repeat('x', 24),
            'user_id' => $member->id,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'payload' => base64_encode(serialize([])),
            'last_activity' => $lastActivity->getTimestamp(),
        ])->save();
    }
}

function accountHorizontalOverflow(): string
{
    return 'document.documentElement.scrollWidth > window.innerWidth';
}

it('picks one of the twelve presence colours, saves it with the profile and keeps it after a reload', function () {
    $member = accountMember();
    $colours = '[data-slot="presence-colour-picker"] [role="radio"]';

    $page = $this->signIn($member, '/settings/profile');

    $page->assertCount($colours, 12)
        ->assertCount("{$colours}[aria-checked=\"true\"]", 1)
        ->assertSee('Used for your avatar and your live cursor.')
        ->click('[data-slot="presence-colour-picker"] [role="radio"][aria-label="Colour 9"]')
        ->assertAttribute('[data-slot="presence-colour-picker"] [role="radio"][aria-label="Colour 9"]', 'aria-checked', 'true')
        ->assertCount("{$colours}[aria-checked=\"true\"]", 1);

    expect($member->refresh()->presence_color)->not->toBe(9);

    $page->click('@update-profile-button')
        ->assertSee('Profile updated.');

    expect($member->refresh()->presence_color)->toBe(9);

    $page->navigate('/settings/profile')
        ->assertAttribute('[data-slot="presence-colour-picker"] [role="radio"][aria-label="Colour 9"]', 'aria-checked', 'true')
        ->assertNoJavaScriptErrors();
});

it('uploads a photo that replaces the avatar, refuses a GIF under the buttons, and goes back to initials', function () {
    Storage::fake('local');
    $this->acceptUploads();
    resolve(InstanceSettings::class)->set('profile_photos', true);
    resolve(InstanceSettings::class)->set('avatar_member_choice', true);

    $member = accountMember();

    $page = $this->signIn($member, '/settings/profile');

    $page->assertSeeIn('[data-slot="profile-photo"]', 'Upload photo')
        ->assertNotPresent('[data-slot="settings-shell"] img[src*="/avatar-photos/"]')
        ->attach('[data-slot="profile-photo-input"]', accountImageFile('animated.gif', "GIF89a\x01\x00\x01\x00\x00\x00\x00;"))
        ->assertPresent('[data-slot="profile-photo-error"]')
        ->assertNotPresent('[data-slot="settings-shell"] img[src*="/avatar-photos/"]');

    expect($member->refresh()->avatar_photo_path)->toBeNull();

    $page->attach('[data-slot="profile-photo-input"]', accountImageFile('portrait.png', pngBytes(['Author' => 'Mona'])))
        ->assertSee('Photo updated.')
        ->assertPresent('[data-slot="settings-shell"] img[src*="/avatar-photos/"]')
        ->assertNotPresent('[data-slot="profile-photo-error"]');

    $photoPath = $member->refresh()->avatar_photo_path;

    expect($photoPath)->not->toBeNull();
    Storage::disk('local')->assertExists($photoPath);

    $page->click('[data-slot="profile-photo"] button:has-text("Use initials")')
        ->assertSee('Photo removed.')
        ->assertNotPresent('[data-slot="settings-shell"] img[src*="/avatar-photos/"]')
        ->assertNoJavaScriptErrors();

    expect($member->refresh()->avatar_photo_path)->toBeNull();
    Storage::disk('local')->assertMissing($photoPath);
});

it('keeps the colours but shows no photo control while the instance has profile photos off', function () {
    $member = accountMember();

    $page = $this->signIn($member, '/settings/profile');

    $page->assertCount('[data-slot="presence-colour-picker"] [role="radio"]', 12)
        ->assertNotPresent('[data-slot="profile-photo"]')
        ->assertDontSee('Upload photo')
        ->assertNoJavaScriptErrors();
});

it('reduces the animations at once and marks the page with reduce-motion from the next visit', function () {
    $member = accountMember();
    $switch = '[data-slot="reduce-motion-field"] [role="switch"]';

    $page = $this->signIn($member, '/settings/appearance');

    $page->assertAttribute($switch, 'aria-checked', 'false')
        ->assertScript('document.documentElement.classList.contains("reduce-motion")', false)
        ->assertSee('Replaces card flips, confetti and drag tilts with simple fades.')
        ->click($switch)
        ->assertSee('Appearance saved.')
        ->assertAttribute($switch, 'aria-checked', 'true');

    expect($member->refresh()->reduce_motion)->toBeTrue();

    $page->navigate('/dashboard')
        ->assertScript('document.documentElement.classList.contains("reduce-motion")', true)
        ->navigate('/settings/appearance')
        ->click($switch)
        ->assertSee('Appearance saved.')
        ->navigate('/dashboard')
        ->assertScript('document.documentElement.classList.contains("reduce-motion")', false)
        ->assertNoJavaScriptErrors();

    expect($member->refresh()->reduce_motion)->toBeFalse();
});

it('marks a breached new password before the save and a clean one as met', function () {
    Password::defaults(fn (): Password => Password::min(12)->uncompromised());

    $breachedHash = strtoupper(sha1(AccountBreachedPassword));
    $cleanHash = strtoupper(sha1(AccountCleanPassword));

    Http::fake([
        'api.pwnedpasswords.com/range/'.substr($breachedHash, 0, 5) => Http::response(substr($breachedHash, 5).":4210\r\n0018A45C4D1DEF81644B54AB7F969B88D65:10"),
        'api.pwnedpasswords.com/range/'.substr($cleanHash, 0, 5) => Http::response("0018A45C4D1DEF81644B54AB7F969B88D65:10\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:3"),
    ]);

    $member = accountMember();

    $page = accountConfirmPassword($this->signIn($member, '/settings/security'));

    $page->assertAttribute('[data-slot="password-breach-line"]', 'data-state', 'idle')
        ->fill('#password', AccountBreachedPassword)
        ->assertAttribute('[data-slot="password-breach-line"]', 'data-state', 'breached')
        ->assertSeeIn('[data-slot="password-breach-line"]', 'Found in known data breaches: choose another one')
        ->fill('#password', AccountCleanPassword)
        ->assertAttribute('[data-slot="password-breach-line"]', 'data-state', 'clear')
        ->assertSeeIn('[data-slot="password-breach-line"]', 'Not found in known data breaches')
        ->assertNoJavaScriptErrors();

    Http::assertSentCount(2);
    Http::assertNotSent(fn ($request): bool => str_contains((string) $request->url(), substr($breachedHash, 0, 6)));
});

it('lists the devices of the account, signs one out after a confirmation, then every other one', function () {
    config(['session.driver' => 'database', 'session.lottery' => [0, 100]]);

    $member = accountMember();
    accountOtherDevices($member);

    $page = accountConfirmPassword($this->signIn($member, '/settings/security'));
    $rows = '[data-slot="active-sessions"] tbody tr';

    $page->assertSeeIn('[data-slot="active-sessions"]', 'Devices signed in to your account.')
        ->assertCount($rows, 3)
        ->assertSeeIn("{$rows}:first-child", 'This device')
        ->assertSeeIn("{$rows}:first-child", 'Active now')
        ->assertNotPresent("{$rows}:first-child button:has-text(\"Sign out\")")
        ->assertSeeIn("{$rows}:has-text(\"Chrome on Windows\")", '203.0.113.42')
        ->assertSeeIn("{$rows}:has-text(\"Safari on iOS\")", '2001:db8:85a3::8a2e:370:7334')
        ->click("{$rows}:has-text(\"Chrome on Windows\") button:has-text(\"Sign out\")")
        ->assertSeeIn('[role="alertdialog"]', 'Sign out this device?')
        ->click('[role="alertdialog"] button:has-text("Sign out")')
        ->assertSee('Device signed out.')
        ->assertCount($rows, 2)
        ->assertNotPresent("{$rows}:has-text(\"Chrome on Windows\")");

    expect(BrowserSession::query()->whereKey('other-device-0-'.str_repeat('x', 24))->exists())->toBeFalse()
        ->and(BrowserSession::query()->whereKey('other-device-1-'.str_repeat('x', 24))->exists())->toBeTrue();

    $page->click('[data-slot="active-sessions"] button:has-text("Sign out other sessions")')
        ->assertSeeIn('[role="alertdialog"]', 'Sign out every other device?')
        ->click('[role="alertdialog"] button:has-text("Sign out")')
        ->assertSee('Other sessions signed out.')
        ->assertCount($rows, 1)
        ->assertSeeIn($rows, 'This device')
        ->assertDisabled('[data-slot="active-sessions"] button:has-text("Sign out other sessions")')
        ->assertNoJavaScriptErrors();

    expect(BrowserSession::query()->where('user_id', $member->id)->count())->toBe(1);
});

it('links Google from the security section and comes back to the linked row, then unlinks it after a confirmation', function () {
    accountEnableGoogleAndGitHub();
    Socialite::fake('google', SocialiteUser::fake(['id' => 'google-mona', 'email' => 'mona@gmail.example', 'name' => 'Mona Member']));

    $member = accountMember();
    $google = '[data-slot="linked-accounts"] [data-linked-provider="google"]';

    $page = accountConfirmPassword($this->signIn($member, '/settings/security'));

    $page->assertSeeIn('[data-slot="linked-accounts"]', 'Sign in with your company SSO or an existing account. Keep at least one way in.')
        ->assertSeeIn($google, 'Not linked')
        ->assertSeeIn('[data-slot="linked-accounts"] [data-linked-provider="github"]', 'Not linked')
        ->assertNotPresent('[data-slot="linked-accounts-note"]')
        ->click("{$google} button:has-text(\"Link Google\")")
        ->assertScript('window.location.hostname !== "127.0.0.1"', true);

    $page->navigate('/auth/google/callback')
        ->assertPathIs('/settings')
        ->assertSeeIn($google, 'Linked')
        ->assertPresent("{$google} button:has-text(\"Unlink\")");

    expect($member->socialAccounts()->where('provider', 'google')->value('provider_user_id'))->toBe('google-mona');

    $page->click("{$google} button:has-text(\"Unlink\")")
        ->assertSeeIn('[role="alertdialog"]', 'Unlink Google?')
        ->click('[role="alertdialog"] button:has-text("Unlink")')
        ->assertSee('Google is unlinked.')
        ->assertSeeIn($google, 'Not linked')
        ->assertNoJavaScriptErrors();

    expect($member->socialAccounts()->count())->toBe(0);
});

it('opens the security section of an account without a known password with no confirmation, keeps its only identity, and sets a password', function () {
    accountEnableGoogleAndGitHub();

    $member = accountMember();
    $member->forceFill(['password_set_at' => null])->save();
    SocialAccount::factory()->for($member)->create(['provider' => 'google', 'created_at' => '2026-03-12 09:14:00']);

    $page = $this->signIn($member, '/settings/security');
    $google = '[data-slot="linked-accounts"] [data-linked-provider="google"]';

    $page->assertPathIs('/settings')
        ->assertScript('window.location.hash', '#security')
        ->assertNotPresent('@confirm-password-button')
        ->assertSeeIn('[data-slot="password-card"]', 'Set a password')
        ->assertNotPresent('[data-slot="password-card"] #current_password')
        ->assertSeeIn('[data-slot="linked-accounts-note"]', "You can't unlink your last sign-in method: set a password or link another account first.")
        ->assertDisabled("{$google} button:has-text(\"Unlink\")")
        ->fill('#password', 'a-new-password-2026')
        ->fill('#password_confirmation', 'a-new-password-2026')
        ->click('[data-slot="password-card"] button:has-text("Set the password")')
        ->assertSee('Password updated.');

    expect($member->refresh()->password_set_at)->not->toBeNull()
        ->and(Hash::check('a-new-password-2026', $member->password))->toBeTrue();

    $page->navigate('/settings/security')
        ->assertPathIs('/user/confirm-password')
        ->fill('#password', 'a-new-password-2026')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings')
        ->assertSeeIn('[data-slot="password-card"]', 'Update password')
        ->assertPresent('[data-slot="password-card"] #current_password')
        ->assertNotPresent('[data-slot="linked-accounts-note"]')
        ->assertEnabled("{$google} button:has-text(\"Unlink\")")
        ->assertNoJavaScriptErrors();
});

it('marks the identities of an instance that requires single sign-on as managed by the admin, with no unlink and no password card', function () {
    accountEnableGoogleAndGitHub();
    resolve(InstanceSettings::class)->set('sso_required', true);

    $member = accountMember();
    $member->forceFill(['password_set_at' => null])->save();
    SocialAccount::factory()->for($member)->create(['provider' => 'google', 'provider_user_id' => 'google-mona']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'google-mona', 'email' => $member->email, 'name' => 'Mona Member']));

    $page = browserVisit('/login');
    $google = '[data-slot="linked-accounts"] [data-linked-provider="google"]';

    $page->click('Continue with Google')
        ->assertScript('window.location.hostname !== "127.0.0.1"', true)
        ->navigate('/auth/google/callback')
        ->assertPathIsNot('/login')
        ->navigate('/settings/security')
        ->assertPathIs('/settings')
        ->assertSeeIn($google, 'Managed by your admin')
        ->assertNotPresent("{$google} button:has-text(\"Unlink\")")
        ->assertNotPresent('[data-slot="password-card"]')
        ->assertNoJavaScriptErrors();
});

it('a guest picks a free colour at the join page and each side sees the other\'s cursor in its presence colour, live', function () {
    $retro = Retro::factory()->withGuestAccess()->inPhase(RetroPhase::Grouping)->create(['title' => 'Sprint 12']);
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);
    [$bob, $bobParticipant] = retroFacilitator($retro);
    $bob->forceFill(['name' => 'Bob Stone', 'locale' => 'en', 'presence_color' => 9])->save();
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $bobParticipant->id, 'content' => 'Slow CI', 'position' => 0]);

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $guestPage = browserVisit("/join/{$retro->guest_token}");

    $guestPage->assertPresent('[data-slot="guest-join"] [role="radio"][aria-label="Colour 9 (taken)"][aria-disabled="true"]')
        ->assertPresent('[data-slot="guest-join"] [data-slot="presence-swatch-taken"]')
        ->fill('#name', 'Gus Guest')
        ->click('[data-slot="guest-join"] [role="radio"][aria-label="Colour 7"]')
        ->assertAttribute('[data-slot="guest-join"] [role="radio"][aria-label="Colour 7"]', 'aria-checked', 'true')
        ->click('Join the session')
        ->assertPathIs("/retros/{$retro->id}");

    $this->awaitRealtime($guestPage);

    expect(Participant::query()->where('retro_id', $retro->id)->where('guest_name', 'Gus Guest')->value('presence_color'))->toBe(7);

    $bobPage->assertPresent('.lc-overlay');
    $guestPage->assertPresent('.lc-overlay');

    $bobPage->hover("#card-{$card->id}")->hover('[data-slot="retro-columns"]')->hover("#card-{$card->id}");

    $guestPage->assertSeeIn('.lc-overlay', 'Bob Stone')
        ->assertScript('document.querySelector(".lc-cursor svg").style.color', 'var(--skrum-presence-9)');

    $guestPage->hover('[data-slot="retro-columns"]')->hover("#card-{$card->id}")->hover('[data-slot="retro-columns"]');

    $bobPage->assertSeeIn('.lc-overlay', 'Gus Guest')
        ->assertScript('document.querySelector(".lc-cursor svg").style.color', 'var(--skrum-presence-7)');

    browserVisit("/join/{$retro->guest_token}")
        ->assertPresent('[data-slot="guest-join"] [role="radio"][aria-label="Colour 7 (taken)"]')
        ->assertPresent('[data-slot="guest-join"] [role="radio"][aria-label="Colour 9 (taken)"]');
});

it('shows the session code in the share dialog and leads a visitor who types it, in any case and without the hyphen, to the join page', function () {
    $retro = Retro::factory()->withGuestAccess()->inPhase(RetroPhase::Grouping)->create(['title' => 'Sprint 12']);
    [$alice] = retroFacilitator($retro);
    $alice->forceFill(['name' => 'Alice Martin', 'locale' => 'en'])->save();

    $code = resolve(JoinCodes::class)->for($retro);

    expect($code)->toMatch('/^[A-Z0-9]{3}-[A-Z0-9]{4}$/');

    $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"))
        ->click('Share')
        ->assertSeeIn('[data-slot="share-code"]', $code)
        ->assertSee('Copy the code');

    $visitor = browserVisit('/login');

    $visitor->click('Join a session with a code')
        ->assertPathIs('/join')
        ->fill('#code', 'ZZZ-9999')
        ->click('[data-slot="join-code-action"]')
        ->assertSee('No session matches this code.')
        ->assertPathIs('/join')
        ->fill('#code', strtolower(str_replace('-', '', $code)))
        ->click('[data-slot="join-code-action"]')
        ->assertPathIs("/join/{$retro->guest_token}")
        ->assertPresent('[data-slot="guest-join"]')
        ->assertNoJavaScriptErrors();
});

it('fits the settings page at phone width, with the devices as cards', function () {
    config(['session.driver' => 'database', 'session.lottery' => [0, 100]]);

    $member = accountMember();
    accountOtherDevices($member);

    $page = $this->signIn($member, '/settings/security');
    $page->resize(390, 844);

    accountConfirmPassword($page)
        ->assertScript(accountHorizontalOverflow(), false)
        ->assertCount('ul[aria-label="Active sessions"] li', 3)
        ->assertNotPresent('[data-slot="active-sessions"] table')
        ->navigate('/settings/profile')
        ->assertScript(accountHorizontalOverflow(), false)
        ->assertVisible('[data-slot="presence-colour-picker"]')
        ->assertNoJavaScriptErrors();
});

it('draws the settings page on a dark background when the system asks for it', function () {
    $member = accountMember();

    $page = $this->signIn($member, '/settings/profile', ['colorScheme' => 'dark']);

    $page->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertScript('getComputedStyle(document.body).backgroundColor', 'oklch(0.165 0.008 55)')
        ->assertCount('[data-slot="presence-colour-picker"] [role="radio"]', 12)
        ->assertNoJavaScriptErrors();
});

it('reads the settings in English for an English member of a French instance', function () {
    config(['app.locale' => 'fr']);

    $member = accountMember();

    $page = $this->signIn($member, '/settings/profile');

    $page->assertScript('document.documentElement.lang', 'en')
        ->assertSeeIn('nav[aria-label="Settings"]', 'Profile')
        ->assertSeeIn('nav[aria-label="Settings"]', 'Appearance')
        ->assertSee('Avatar & presence colour')
        ->assertDontSee('Paramètres')
        ->assertNoJavaScriptErrors();
});
