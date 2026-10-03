<?php

use App\Actions\Admin\UpdateInstanceConfiguration;
use App\Enums\InstanceSettingKey;
use App\Models\User;
use App\Support\InstanceSettings;
use Tests\Concurrency\Support\Race;

it('keeps both fields when two admins save different fields of one section at once', function () {
    $first = User::factory()->instanceAdmin()->create()->id;
    $second = User::factory()->instanceAdmin()->create()->id;

    $outcomes = Race::run([
        static function () use ($first): array {
            config(['cache.default' => 'database']);

            return resolve(UpdateInstanceConfiguration::class)->handle(User::query()->findOrFail($first), InstanceSettingKey::IntegrationSlack, ['client_id' => 'from-first'], [], null)->changed;
        },
        static function () use ($second): array {
            config(['cache.default' => 'database']);

            return resolve(UpdateInstanceConfiguration::class)->handle(User::query()->findOrFail($second), InstanceSettingKey::IntegrationSlack, ['client_secret' => 'from-second'], [], null)->changed;
        },
    ]);

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(array_keys(resolve(InstanceSettings::class)->configuration(InstanceSettingKey::IntegrationSlack)))
        ->toEqualCanonicalizing(['client_id', 'client_secret']);
});
