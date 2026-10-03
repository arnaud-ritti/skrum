<?php

namespace App\Models;

use App\Enums\AuditAction;
use Carbon\CarbonInterface;
use Database\Factories\AuditEventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property ?string $actor_user_id
 * @property string $actor_name
 * @property AuditAction $action
 * @property ?string $subject_type
 * @property ?string $subject_id
 * @property ?array<string, mixed> $properties
 * @property ?string $ip_address
 * @property CarbonInterface $created_at
 * @property-read ?User $actor
 */
#[Fillable(['actor_user_id', 'actor_name', 'action', 'subject_type', 'subject_id', 'properties', 'ip_address', 'created_at'])]
class AuditEvent extends Model
{
    /** @use HasFactory<AuditEventFactory> */
    use HasFactory;

    use HasUuids;
    use MassPrunable;

    public const int Retention = 365;

    public const UPDATED_AT = null;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'action' => AuditAction::class,
            'properties' => 'json',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subDays(self::Retention));
    }
}
