<?php

use App\Models\BrowserSession;
use App\Models\User;
use App\Support\Settings\BrowserSessions;
use App\Support\Settings\SecuritySettings;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Inertia\Testing\AssertableInertia;

const FirefoxOnMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15.0; rv:131.0) Gecko/20100101 Firefox/131.0';
const SafariOnIphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

beforeEach(fn () => config(['session.driver' => 'database']));

function browserSession(User $user, string $id, string $agent, int $minutesAgo, ?string $address = '203.0.113.7'): BrowserSession
{
    return BrowserSession::query()->forceCreate([
        'id' => $id,
        'user_id' => $user->id,
        'ip_address' => $address,
        'user_agent' => $agent,
        'payload' => '',
        'last_activity' => now()->subMinutes($minutesAgo)->getTimestamp(),
    ]);
}

it('lists the sessions of the user, newest first, with browser and IP address and without ids', function () {
    $user = User::factory()->create();
    browserSession($user, 'current-session-id', FirefoxOnMac, 0);
    browserSession($user, 'phone-session-id', SafariOnIphone, 120, '2001:db8::7');
    browserSession(User::factory()->create(), 'someone-else', FirefoxOnMac, 1, '198.51.100.9');

    $rows = resolve(BrowserSessions::class)->of($user, 'current-session-id');

    expect($rows)->toHaveCount(2)
        ->and($rows[0])->toMatchArray(['device' => 'Firefox on macOS', 'deviceKind' => 'desktop', 'ipAddress' => '203.0.113.7', 'isCurrent' => true, 'key' => hash('sha256', 'current-session-id')])
        ->and($rows[1])->toMatchArray(['device' => 'Safari on iOS', 'deviceKind' => 'phone', 'ipAddress' => '2001:db8::7', 'isCurrent' => false])
        ->and(json_encode($rows))->not->toContain('phone-session-id')->not->toContain('198.51.100.9');
});

it('gives no address for a session stored without one', function () {
    $user = User::factory()->create();
    browserSession($user, 'current-session-id', FirefoxOnMac, 0, null);

    expect(resolve(BrowserSessions::class)->of($user, 'current-session-id')[0]['ipAddress'])->toBeNull();
});

it('signs out one session and forgets remembered devices', function () {
    $user = User::factory()->create(['remember_token' => 'old-token']);
    browserSession($user, 'current-session-id', FirefoxOnMac, 0);
    browserSession($user, 'phone-session-id', SafariOnIphone, 120);

    $done = resolve(BrowserSessions::class)->signOut($user, hash('sha256', 'phone-session-id'), 'current-session-id');

    expect($done)->toBeTrue()
        ->and(BrowserSession::query()->whereKey('phone-session-id')->exists())->toBeFalse()
        ->and(BrowserSession::query()->whereKey('current-session-id')->exists())->toBeTrue()
        ->and($user->fresh()->remember_token)->not->toBe('old-token');
});

it('never signs out the current session, nor another user\'s', function () {
    $user = User::factory()->create();
    browserSession($user, 'current-session-id', FirefoxOnMac, 0);
    browserSession(User::factory()->create(), 'someone-else', FirefoxOnMac, 1);
    $sessions = resolve(BrowserSessions::class);

    expect($sessions->signOut($user, hash('sha256', 'current-session-id'), 'current-session-id'))->toBeFalse()
        ->and($sessions->signOut($user, hash('sha256', 'someone-else'), 'current-session-id'))->toBeFalse()
        ->and(BrowserSession::query()->count())->toBe(2);
});

it('signs out every other session', function () {
    $user = User::factory()->create();
    browserSession($user, 'current-session-id', FirefoxOnMac, 0);
    browserSession($user, 'phone-session-id', SafariOnIphone, 120);
    browserSession($user, 'old-session-id', FirefoxOnMac, 3000);

    expect(resolve(BrowserSessions::class)->signOutOthers($user, 'current-session-id'))->toBe(2)
        ->and(BrowserSession::query()->where('user_id', $user->id)->pluck('id')->all())->toBe(['current-session-id']);
});

it('sends no session list at all with another driver, so the card is hidden', function () {
    config(['session.driver' => 'file']);

    expect(resolve(BrowserSessions::class)->available())->toBeFalse();

    $this->actingAs(User::factory()->create())->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('settings.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('security.protected.browserSessions', null));
});

it('tells the locked section whether the card exists, before any confirmation', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('settings.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('security.protected', null)
            ->where('security.canListBrowserSessions', true));

    config(['session.driver' => 'file']);

    expect(resolve(SecuritySettings::class)->offered()['canListBrowserSessions'])->toBeFalse();
});

it('signs out through the routes, behind a fresh confirmation', function () {
    $user = User::factory()->create();
    browserSession($user, 'phone-session-id', SafariOnIphone, 30);
    $key = hash('sha256', 'phone-session-id');

    $this->actingAs($user)->deleteJson(route('browserSessions.destroy', $key))->assertStatus(423);

    $this->withSession(['auth.password_confirmed_at' => time()])
        ->delete(route('browserSessions.destroy', $key))
        ->assertRedirect();

    expect(BrowserSession::query()->whereKey('phone-session-id')->exists())->toBeFalse();

    $this->delete(route('browserSessions.destroy', str_repeat('a', 64)))->assertNotFound();

    browserSession($user, 'tablet-session-id', SafariOnIphone, 10);

    $this->delete(route('otherBrowserSessions.destroy'))->assertRedirect();

    expect(BrowserSession::query()->whereKey('tablet-session-id')->exists())->toBeFalse();
});

it('answers 404 on the routes with another driver', function () {
    config(['session.driver' => 'file']);

    $this->actingAs(User::factory()->create())->withSession(['auth.password_confirmed_at' => time()])
        ->delete(route('otherBrowserSessions.destroy'))->assertNotFound();
});

it('keeps the current device remembered after forgetting the others', function () {
    $user = User::factory()->create(['remember_token' => 'old-token']);
    browserSession($user, 'current-session-id', FirefoxOnMac, 0);
    $recaller = Auth::guard()->getRecallerName();
    request()->cookies->set($recaller, "{$user->id}|old-token|hash");

    resolve(BrowserSessions::class)->signOutOthers($user, 'current-session-id');

    $newToken = $user->fresh()->remember_token;

    expect($newToken)->not->toBe('old-token')
        ->and(Cookie::queued($recaller)?->getValue())->toStartWith("{$user->id}|{$newToken}|");
});
