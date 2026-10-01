<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationDeliveryChannel;
use App\Models\IntegrationDelivery;
use App\Models\Team;

class FindWebhookDelivery
{
    /**
     * A delivery of the team's generic webhook log, across reconnections
     * (spec 8 §4.7); anything else is a 404.
     */
    public function handle(Team $team, string $deliveryId): IntegrationDelivery
    {
        return IntegrationDelivery::query()
            ->with('payload')
            ->where('team_id', $team->id)
            ->where('channel', IntegrationDeliveryChannel::Webhook->value)
            ->whereKey($deliveryId)
            ->firstOrFail();
    }
}
