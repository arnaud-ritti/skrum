<?php

namespace Database\Factories;

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<IntegrationDeliveryPayload>
 */
class IntegrationDeliveryPayloadFactory extends Factory
{
    public function definition(): array
    {
        return [
            'integration_delivery_id' => IntegrationDelivery::factory()->state([
                'channel' => IntegrationDeliveryChannel::Webhook,
                'kind' => IntegrationDeliveryKind::Event,
                'event' => 'action_item.completed',
                'requested_by_user_id' => null,
            ]),
            'message' => fn (array $attributes) => [
                'id' => $attributes['integration_delivery_id'],
                'event' => 'action_item.completed',
                'occurredAt' => '2026-10-08T10:00:00Z',
                'data' => ['actionItem' => ['content' => 'Fix the deploy']],
            ],
        ];
    }
}
