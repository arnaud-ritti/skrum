<?php

use App\Enums\InstanceSettingKey;
use App\Jobs\CheckForUpdate;
use App\Support\InstanceSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => config(['skrum.update_feed' => 'https://releases.example/latest']));

it('makes no request while the check is off', function () {
    Http::fake();

    $this->artisan('skrum:check-for-update')->assertSuccessful();

    Http::assertNothingSent();
});

it('stores the latest release without its v and the time of the check', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 8, 0, 0));
    resolve(InstanceSettings::class)->set(InstanceSettingKey::UpdateCheckEnabled->value, true);
    Http::fake(['releases.example/*' => Http::response(['tag_name' => 'v1.9.0'])]);

    $this->artisan('skrum:check-for-update')->assertSuccessful();

    $settings = resolve(InstanceSettings::class);
    expect($settings->latestVersion())->toBe('1.9.0')
        ->and($settings->updateCheckedAt())->toBe('2026-10-03T08:00:00+00:00');
});

it('keeps what it had when the feed fails or answers nonsense', function (Closure $answer) {
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => '1.8.0',
    ]);
    Http::fake(['releases.example/*' => $answer]);

    $this->artisan('skrum:check-for-update')->assertSuccessful();

    expect(resolve(InstanceSettings::class)->latestVersion())->toBe('1.8.0');
})->with([
    'server error' => [fn () => Http::response('', 500)],
    'no tag' => [fn () => Http::response(['name' => 'x'])],
    'not a version' => [fn () => Http::response(['tag_name' => '<script>'])],
    'not json' => [fn () => Http::response('<html>rate limited</html>', 200, ['Content-Type' => 'text/html'])],
    'connection refused' => [fn () => throw new ConnectionException('refused')],
]);

it('runs the check from the queued job', function () {
    resolve(InstanceSettings::class)->set(InstanceSettingKey::UpdateCheckEnabled->value, true);
    Http::fake(['releases.example/*' => Http::response(['tag_name' => '2.0.0'])]);

    CheckForUpdate::dispatchSync();

    expect(resolve(InstanceSettings::class)->latestVersion())->toBe('2.0.0');
});
