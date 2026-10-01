<?php

namespace App\Models;

use App\Enums\InboundEventStatus;
use App\Enums\IntegrationProvider;
use Database\Factories\IntegrationInboundEventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\WithoutTimestamps;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One verified or refused inbound webhook, kept 7 days for de-duplication.
 * The payload is never stored (spec 8 §3, §8.2).
 *
 * @property string $id
 * @property IntegrationProvider $provider
 * @property string|null $team_integration_id
 * @property string $event_key
 * @property string $event_type
 * @property InboundEventStatus $status
 * @property string|null $detail
 * @property Carbon $received_at
 * @property-read TeamIntegration|null $integration
 */
#[Fillable(['provider', 'team_integration_id', 'event_key', 'event_type', 'status', 'detail', 'received_at'])]
#[WithoutTimestamps]
class IntegrationInboundEvent extends Model
{
    /** @use HasFactory<IntegrationInboundEventFactory> */
    use HasFactory;

    use HasUuids;
    use Prunable;

    private const int RetentionDays = 7;

    /** @return BelongsTo<TeamIntegration, $this> */
    public function integration(): BelongsTo
    {
        return $this->belongsTo(TeamIntegration::class, 'team_integration_id');
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('received_at', '<', now()->subDays(self::RetentionDays));
    }

    protected function casts(): array
    {
        return [
            'provider' => IntegrationProvider::class,
            'status' => InboundEventStatus::class,
            'received_at' => 'datetime',
        ];
    }
}
