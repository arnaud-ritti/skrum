<?php

namespace Database\Factories;

use App\Enums\InboundEventStatus;
use App\Enums\IntegrationProvider;
use App\Models\IntegrationInboundEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<IntegrationInboundEvent>
 */
class IntegrationInboundEventFactory extends Factory
{
    public function definition(): array
    {
        return [
            'provider' => IntegrationProvider::Jira,
            'team_integration_id' => null,
            'event_key' => fake()->unique()->uuid(),
            'event_type' => 'jira:issue_updated',
            'status' => InboundEventStatus::Applied,
            'detail' => null,
            'received_at' => now(),
        ];
    }
}
