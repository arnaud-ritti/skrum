<?php

namespace Database\Factories;

use App\Enums\IntegrationUserMatch;
use App\Models\IntegrationUserMapping;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<IntegrationUserMapping>
 */
class IntegrationUserMappingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_integration_id' => TeamIntegration::factory()->jira(),
            'user_id' => User::factory(),
            'external_account_id' => 'account-'.Str::lower(Str::random(12)),
            'external_display_name' => fake()->name(),
            'matched_by' => IntegrationUserMatch::Email,
            'checked_at' => now(),
        ];
    }

    public function manual(): static
    {
        return $this->state(fn () => ['matched_by' => IntegrationUserMatch::Manual]);
    }

    public function neverAssign(): static
    {
        return $this->state(fn () => [
            'matched_by' => IntegrationUserMatch::Manual,
            'external_account_id' => null,
            'external_display_name' => null,
        ]);
    }
}
