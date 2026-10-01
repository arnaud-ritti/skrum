<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationDeliveryKind;
use App\Models\IntegrationDelivery;
use Illuminate\Database\Eloquent\Model;

/**
 * @phpstan-import-type Delivery from PresentIntegrationDelivery
 */
class LatestDeliveries
{
    public function __construct(private PresentIntegrationDelivery $presentIntegrationDelivery) {}

    /**
     * The newest delivery of each channel, for the delivery lines. Rows are
     * pruned after 90 days, so the scan stays small. A webhook redelivery
     * is an admin's repeat of an old message, not a new share, so it never
     * takes over the line.
     *
     * @param  array<int, IntegrationDeliveryKind>  $kinds
     * @return array<int, Delivery>
     */
    public function handle(Model $subject, array $kinds): array
    {
        return IntegrationDelivery::query()
            ->whereMorphedTo('subject', $subject)
            ->whereNull('redelivery_of_id')
            ->whereIn('kind', array_map(fn (IntegrationDeliveryKind $kind): string => $kind->value, $kinds))
            ->with('requestedBy')
            ->orderByDesc('created_at')
            ->get()
            ->unique(fn (IntegrationDelivery $delivery): string => $delivery->channel->value)
            ->sortBy(fn (IntegrationDelivery $delivery): string => $delivery->channel->value)
            ->map(fn (IntegrationDelivery $delivery): array => $this->presentIntegrationDelivery->handle($delivery))
            ->values()
            ->all();
    }
}
