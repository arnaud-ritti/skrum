<?php

namespace App\Models;

use App\Enums\TeamActivityKind;
use Database\Factories\TeamActivityFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property TeamActivityKind $kind
 * @property string|null $actor_user_id
 * @property string|null $actor_name
 * @property string|null $subject_id
 * @property string|null $subject_title
 * @property Carbon|null $created_at
 * @property-read Team $team
 * @property-read User|null $actor
 */
#[Fillable(['team_id', 'kind', 'actor_user_id', 'actor_name', 'subject_id', 'subject_title'])]
class TeamActivity extends Model
{
    /** @use HasFactory<TeamActivityFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    protected function casts(): array
    {
        return [
            'kind' => TeamActivityKind::class,
        ];
    }
}
