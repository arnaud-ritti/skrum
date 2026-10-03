<?php

namespace App\Support\InstanceConfiguration;

use SensitiveParameter;

/**
 * The configuration of every catalogue key as the process booted it (the environment).
 * Captured once in AppServiceProvider::boot(); it never changes.
 */
class InstanceConfigurationBaseline
{
    /** @param array<string, mixed> $values */
    public function __construct(#[SensitiveParameter] private array $values) {}

    public static function capture(ConfigurationCatalogue $catalogue): self
    {
        return new self(collect($catalogue->configKeys())
            ->mapWithKeys(fn (string $key): array => [$key => config($key)])
            ->all());
    }

    public function get(string $configKey): mixed
    {
        return $this->values[$configKey] ?? null;
    }
}
