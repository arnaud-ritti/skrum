<?php

use App\Enums\InstanceSettingKey;
use App\Support\InstanceSettings;
use App\Support\InstanceVersion;

it('reads the configured version without its leading v', function (string $configured, string $expected) {
    config(['skrum.version' => $configured]);

    expect(resolve(InstanceVersion::class)->current())->toBe($expected);
})->with([
    ['1.8.2', '1.8.2'],
    ['v1.8.2', '1.8.2'],
    [' v2.0.0-beta.1 ', '2.0.0-beta.1'],
]);

it('says unknown until a check has stored a version', function (bool $dailyCheck) {
    config(['skrum.version' => '1.8.2']);
    resolve(InstanceSettings::class)->set(InstanceSettingKey::UpdateCheckEnabled->value, $dailyCheck);

    expect(resolve(InstanceVersion::class)->status())->toBe(['state' => 'unknown', 'latest' => null, 'checkedAt' => null, 'releaseUrl' => null]);
})->with(['daily check on' => [true], 'daily check off' => [false]]);

it('compares a version stored by a check on demand while the daily check is off', function () {
    config(['skrum.version' => '1.8.2']);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::LatestVersion->value => '1.9.0',
        InstanceSettingKey::UpdateCheckedAt->value => '2026-10-03T08:00:00+00:00',
    ]);

    expect(resolve(InstanceVersion::class)->status())->toBe([
        'state' => 'outdated',
        'latest' => '1.9.0',
        'checkedAt' => '2026-10-03T08:00:00+00:00',
        'releaseUrl' => 'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0',
    ]);
});

it('compares the stored latest version once the check is on', function (string $latest, string $state) {
    config(['skrum.version' => '1.8.2']);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => $latest,
        InstanceSettingKey::UpdateCheckedAt->value => '2026-10-03T08:00:00+00:00',
    ]);

    expect(resolve(InstanceVersion::class)->status())->toBe([
        'state' => $state,
        'latest' => $latest,
        'checkedAt' => '2026-10-03T08:00:00+00:00',
        'releaseUrl' => $state === 'outdated' ? "https://github.com/arnaud-ritti/skrum/releases/tag/v{$latest}" : null,
    ]);
})->with([
    ['1.9.0', 'outdated'],
    ['1.8.2', 'current'],
    ['1.8.1', 'current'],
]);

it('says unreleased when the running build is not a release', function (string $running) {
    config(['skrum.version' => $running]);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => '1.9.0',
        InstanceSettingKey::UpdateCheckedAt->value => '2026-10-03T08:00:00+00:00',
    ]);

    expect(resolve(InstanceVersion::class)->status()['state'])->toBe('unreleased');
})->with(['main', 'dev', 'pr-12', '']);

it('ignores build metadata when comparing releases', function (string $running, string $latest, string $state) {
    config(['skrum.version' => $running]);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => $latest,
        InstanceSettingKey::UpdateCheckedAt->value => '2026-10-03T08:00:00+00:00',
    ]);

    expect(resolve(InstanceVersion::class)->status()['state'])->toBe($state);
})->with([
    'running build of the latest' => ['1.2.3+abc', '1.2.3', 'current'],
    'latest with metadata' => ['1.2.3', '1.2.3+def', 'current'],
    'newer release' => ['1.2.3+abc', '1.2.4', 'outdated'],
]);

it('links an outdated instance to the notes of the latest release', function (string $latest, string $url) {
    config(['skrum.version' => '1.8.2', 'skrum.repository_url' => 'https://git.example/acme/skrum/']);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::LatestVersion->value => $latest,
        InstanceSettingKey::UpdateCheckedAt->value => '2026-10-03T08:00:00+00:00',
    ]);

    expect(resolve(InstanceVersion::class)->status()['releaseUrl'])->toBe($url);
})->with([
    'a plain release' => ['1.9.0', 'https://git.example/acme/skrum/releases/tag/v1.9.0'],
    'a release with build metadata' => ['1.9.0+build.5', 'https://git.example/acme/skrum/releases/tag/v1.9.0%2Bbuild.5'],
]);
