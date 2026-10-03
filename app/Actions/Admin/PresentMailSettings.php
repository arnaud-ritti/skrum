<?php

namespace App\Actions\Admin;

use App\Enums\InstanceSettingKey;
use App\Support\InstanceConfiguration\InstanceConfiguration;

class PresentMailSettings
{
    /** @var array<int, string> */
    private const array NonDeliveringMailers = ['log', 'array'];

    public function __construct(private InstanceConfiguration $configuration) {}

    /**
     * The mail configuration in force, never the password's value (rule S5).
     *
     * @return array{
     *     delivering: bool,
     *     fields: array<string, array<string, mixed>>
     * }
     */
    public function handle(): array
    {
        return [
            'delivering' => ! in_array(config('mail.default'), self::NonDeliveringMailers, true),
            'fields' => $this->configuration->describe(InstanceSettingKey::Smtp),
        ];
    }
}
