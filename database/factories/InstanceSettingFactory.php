<?php

namespace Database\Factories;

use App\Enums\InstanceSettingKey;
use App\Models\InstanceSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InstanceSetting>
 */
class InstanceSettingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'key' => InstanceSettingKey::DisplayName->value,
            'value' => fake()->company(),
        ];
    }

    public function keyed(InstanceSettingKey $key, mixed $value): static
    {
        return $this->state(['key' => $key->value, 'value' => $value]);
    }
}
