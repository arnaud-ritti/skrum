<?php

namespace App\Models;

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Support\Integrations\IntegrationErrors;
use Database\Factories\IntegrationDeliveryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property IntegrationDeliveryChannel $channel
 * @property IntegrationDeliveryKind $kind
 * @property string $subject_type
 * @property string $subject_id
 * @property string|null $requested_by_user_id
 * @property IntegrationDeliveryStatus $status
 * @property int|null $recipient_count
 * @property string|null $error
 * @property Carbon|null $sent_at
 * @property string|null $team_integration_id
 * @property string|null $event
 * @property int $attempts
 * @property int|null $response_status
 * @property Carbon|null $last_attempt_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read Model|null $subject
 * @property-read User|null $requestedBy
 * @property-read TeamIntegration|null $integration
 */
#[Fillable(['team_id', 'channel', 'kind', 'subject_type', 'subject_id', 'requested_by_user_id', 'status', 'recipient_count', 'error', 'sent_at', 'team_integration_id', 'event', 'attempts', 'response_status', 'last_attempt_at'])]
class IntegrationDelivery extends Model
{
    /** @use HasFactory<IntegrationDeliveryFactory> */
    use HasFactory;

    use HasUuids;
    use Prunable;

    private const RetentionDays = 90;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return MorphTo<Model, $this> */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return BelongsTo<User, $this> */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    /** @return BelongsTo<TeamIntegration, $this> */
    public function integration(): BelongsTo
    {
        return $this->belongsTo(TeamIntegration::class, 'team_integration_id');
    }

    public function markSent(?int $recipientCount = null): void
    {
        $this->forceFill([
            'status' => IntegrationDeliveryStatus::Sent,
            'sent_at' => now(),
            'error' => null,
            'recipient_count' => $recipientCount ?? $this->recipient_count,
        ])->save();
    }

    public function markFailed(string $error): void
    {
        $this->forceFill([
            'status' => IntegrationDeliveryStatus::Failed,
            'error' => IntegrationErrors::sanitize($error),
        ])->save();
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subDays(self::RetentionDays));
    }

    protected function casts(): array
    {
        return [
            'channel' => IntegrationDeliveryChannel::class,
            'kind' => IntegrationDeliveryKind::class,
            'status' => IntegrationDeliveryStatus::class,
            'recipient_count' => 'integer',
            'sent_at' => 'datetime',
            'attempts' => 'integer',
            'response_status' => 'integer',
            'last_attempt_at' => 'datetime',
        ];
    }
}
