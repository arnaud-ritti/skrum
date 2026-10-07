<?php

use App\Enums\InstanceSettingKey;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;

beforeEach(fn () => config(['skrum.update_feed' => 'https://releases.example/latest', 'skrum.version' => '1.8.2']));

it('stores the latest version and the date and says a version is available', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 6, 9, 30, 0));
    actingAsConfirmedAdmin($this);
    resolve(InstanceSettings::class)->set(InstanceSettingKey::UpdateCheckEnabled->value, true);
    Http::fake(['releases.example/*' => Http::response(['tag_name' => 'v1.9.0'])]);

    $this->from(route('admin.general.edit'))
        ->post(route('admin.updateChecks.store'))
        ->assertRedirect(route('admin.general.edit'))
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Version 1.9.0 is available.']);

    $settings = freshInstanceSettings();

    expect($settings->latestVersion())->toBe('1.9.0')
        ->and($settings->updateCheckedAt())->toBe('2026-10-06T09:30:00+00:00');

    $this->get(route('admin.general.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('versionStatus', ['state' => 'outdated', 'latest' => '1.9.0', 'checkedAt' => '2026-10-06T09:30:00+00:00', 'releaseUrl' => 'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0']));
});

it('says the instance is up to date', function () {
    actingAsConfirmedAdmin($this);
    Http::fake(['releases.example/*' => Http::response(['tag_name' => 'v1.8.2'])]);

    $this->post(route('admin.updateChecks.store'))
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => "You're on the latest version."]);

    expect(freshInstanceSettings()->latestVersion())->toBe('1.8.2');
});

it('stores nothing and says so when the feed is down', function (Closure $answer) {
    actingAsConfirmedAdmin($this);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::LatestVersion->value => '1.8.0',
        InstanceSettingKey::UpdateCheckedAt->value => '2026-10-03T08:00:00+00:00',
    ]);
    Http::fake(['releases.example/*' => $answer]);

    $this->from(route('admin.general.edit'))
        ->post(route('admin.updateChecks.store'))
        ->assertRedirect(route('admin.general.edit'))
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'The release feed could not be reached. Try again later.']);

    $settings = freshInstanceSettings();

    expect($settings->latestVersion())->toBe('1.8.0')
        ->and($settings->updateCheckedAt())->toBe('2026-10-03T08:00:00+00:00');
})->with([
    'server error' => [fn () => Http::response('', 500)],
    'not a version' => [fn () => Http::response(['tag_name' => '<script>'])],
    'connection refused' => [fn () => throw new ConnectionException('refused')],
]);

it('checks even when the daily check is off', function () {
    config(['skrum.update_check_enabled' => false]);
    $this->travelTo(now()->setDateTime(2026, 10, 6, 9, 30, 0));
    actingAsConfirmedAdmin($this);
    Http::fake(['releases.example/*' => Http::response(['tag_name' => 'v1.9.0'])]);

    expect(resolve(InstanceSettings::class)->updateCheckEnabled())->toBeFalse();

    $this->post(route('admin.updateChecks.store'))
        ->assertInertiaFlash('toast.message', 'Version 1.9.0 is available.');

    Http::assertSentCount(1);

    $this->get(route('admin.general.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('updateCheckEnabled', false)
            ->where('versionStatus', ['state' => 'outdated', 'latest' => '1.9.0', 'checkedAt' => '2026-10-06T09:30:00+00:00', 'releaseUrl' => 'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0']));
});

it('says a build that is not a release is not compared', function () {
    config(['skrum.version' => 'main']);
    actingAsConfirmedAdmin($this);
    Http::fake(['releases.example/*' => Http::response(['tag_name' => 'v1.9.0'])]);

    $this->post(route('admin.updateChecks.store'))
        ->assertInertiaFlash('toast', ['type' => 'info', 'message' => 'This build is not a release: it is not compared with new versions.']);
});

it('refuses a user who is not an instance administrator', function () {
    Http::fake();
    $this->actingAs(User::factory()->create())->withSession(['auth.password_confirmed_at' => time()]);

    $this->post(route('admin.updateChecks.store'))->assertForbidden();

    Http::assertNothingSent();
});

it('refuses the seventh check of a minute', function () {
    actingAsConfirmedAdmin($this);
    Http::fake(['releases.example/*' => Http::response(['tag_name' => 'v1.8.2'])]);

    foreach (range(1, 6) as $attempt) {
        $this->post(route('admin.updateChecks.store'))->assertRedirect();
    }

    $this->post(route('admin.updateChecks.store'))->assertTooManyRequests();

    Http::assertSentCount(6);
});
