<?php

namespace App\Models;

use App\Enums\TeamAccessRequestStatus;
use Carbon\CarbonInterface;
use Database\Factories\TeamAccessRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $team_id
 * @property string $user_id
 * @property ?string $message
 * @property TeamAccessRequestStatus $status
 * @property ?string $decided_by_user_id
 * @property ?CarbonInterface $decided_at
 * @property CarbonInterface $created_at
 * @property CarbonInterface $updated_at
 * @property-read Team $team
 * @property-read User $user
 * @property-read ?User $decidedBy
 */
#[Fillable(['team_id', 'user_id', 'message', 'status', 'decided_by_user_id', 'decided_at'])]
class TeamAccessRequest extends Model
{
    /** @use HasFactory<TeamAccessRequestFactory> */
    use HasFactory;

    use HasUuids;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => TeamAccessRequestStatus::class,
            'decided_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by_user_id');
    }
}
