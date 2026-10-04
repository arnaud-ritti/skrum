<?php

namespace App\Models;

use Database\Factories\IntegrationDeliveryPayloadFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * What skrum sent for one generic webhook delivery (webhook redelivery
 * spec §3). Every column with content is encrypted; rows are pruned after
 * 30 days while the delivery row itself stays 90 days.
 *
 * @property string $id
 * @property string $integration_delivery_id
 * @property array{id: string, event: string, occurredAt: string, data: array<string, mixed>} $message
 * @property array<string, string>|null $request_headers
 * @property string|null $request_body
 * @property int|null $response_status
 * @property string|null $response_excerpt
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read IntegrationDelivery $delivery
 */
#[Fillable(['integration_delivery_id', 'message', 'request_headers', 'request_body', 'response_status', 'response_excerpt'])]
#[Hidden(['message', 'request_headers', 'request_body', 'response_excerpt'])]
class IntegrationDeliveryPayload extends Model
{
    /** @use HasFactory<IntegrationDeliveryPayloadFactory> */
    use HasFactory;

    use HasUuids;
    use MassPrunable;

    public const RetentionDays = 30;

    /** @return BelongsTo<IntegrationDelivery, $this> */
    public function delivery(): BelongsTo
    {
        return $this->belongsTo(IntegrationDelivery::class, 'integration_delivery_id');
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subDays(self::RetentionDays));
    }

    protected function casts(): array
    {
        return [
            'message' => 'encrypted:array',
            'request_headers' => 'encrypted:array',
            'request_body' => 'encrypted',
            'response_status' => 'integer',
            'response_excerpt' => 'encrypted',
        ];
    }
}
