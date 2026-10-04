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

it('says unknown while the check is off, whatever is stored', function () {
    config(['skrum.version' => '1.8.2']);
    resolve(InstanceSettings::class)->set(InstanceSettingKey::LatestVersion->value, '1.9.0');

    expect(resolve(InstanceVersion::class)->status()['state'])->toBe('unknown');
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
    ]);
})->with([
    ['1.9.0', 'outdated'],
    ['1.8.2', 'current'],
    ['1.8.1', 'current'],
]);

it('says unknown when the running build is not a release', function (string $running) {
    config(['skrum.version' => $running]);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => '1.9.0',
        InstanceSettingKey::UpdateCheckedAt->value => '2026-10-03T08:00:00+00:00',
    ]);

    expect(resolve(InstanceVersion::class)->status()['state'])->toBe('unknown');
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
