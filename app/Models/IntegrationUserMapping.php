<?php

namespace App\Models;

use App\Enums\IntegrationUserMatch;
use Database\Factories\IntegrationUserMappingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_integration_id
 * @property string $user_id
 * @property string|null $external_account_id
 * @property string|null $external_display_name
 * @property IntegrationUserMatch $matched_by
 * @property Carbon $checked_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read TeamIntegration $integration
 * @property-read User $user
 */
#[Fillable(['user_id', 'external_account_id', 'external_display_name', 'matched_by', 'checked_at'])]
class IntegrationUserMapping extends Model
{
    /** @use HasFactory<IntegrationUserMappingFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<TeamIntegration, $this> */
    public function integration(): BelongsTo
    {
        return $this->belongsTo(TeamIntegration::class, 'team_integration_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isNeverAssign(): bool
    {
        return $this->matched_by === IntegrationUserMatch::Manual && $this->external_account_id === null;
    }

    protected function casts(): array
    {
        return [
            'matched_by' => IntegrationUserMatch::class,
            'checked_at' => 'datetime',
        ];
    }
}
